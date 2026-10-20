import test from "node:test";
import assert from "node:assert/strict";
import { measure, average, deviation, createMonitor, setupChecks, LM } from "../src/renderer/posture.js";

// Build a 33-point pose; only the points posture.js reads are meaningful.
function pose({ noseY = 0.3, shoulderY = 0.6, half = 0.2, tiltY = 0 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  lm[LM.NOSE] = { x: 0.5, y: noseY, visibility: 1 };
  lm[LM.L_SHOULDER] = { x: 0.5 - half, y: shoulderY, visibility: 1 };
  lm[LM.R_SHOULDER] = { x: 0.5 + half, y: shoulderY + tiltY, visibility: 1 };
  return lm;
}

test("measure returns null when shoulders aren't visible", () => {
  const lm = pose(); lm[LM.L_SHOULDER].visibility = 0.1;
  assert.equal(measure(lm), null);
});

test("good posture matches baseline → no deviation", () => {
  const base = measure(pose());
  const d = deviation(base, measure(pose()));
  assert.ok(Math.abs(d.slouch) < 1e-9 && Math.abs(d.lean) < 1e-9 && d.tilt < 1e-9);
});

test("slouching (head drops toward shoulders) is positive slouch", () => {
  const base = measure(pose());
  assert.ok(deviation(base, measure(pose({ noseY: 0.45 }))).slouch > 0.3);
});

test("leaning in (wider shoulders) is positive lean", () => {
  const base = measure(pose());
  assert.ok(deviation(base, measure(pose({ half: 0.26 }))).lean > 0.2);
});

test("monitor warns only after the delay, and recovers after a good stretch", () => {
  const base = measure(pose());
  const slump = measure(pose({ noseY: 0.5 }));
  const mon = createMonitor({ alpha: 1 });
  let r = mon.update(base, slump, 0);
  assert.equal(r.bad, true); assert.equal(r.warned, false);
  r = mon.update(base, slump, 3000); assert.equal(r.warned, false);
  r = mon.update(base, slump, 4000); assert.equal(r.warned, true);
  r = mon.update(base, base, 4500); assert.equal(r.warned, true);   // not cleared yet
  r = mon.update(base, base, 6100); assert.equal(r.warned, false);
});

test("a brief slouch never warns", () => {
  const base = measure(pose());
  const mon = createMonitor({ alpha: 1 });
  mon.update(base, measure(pose({ noseY: 0.5 })), 0);
  const r = mon.update(base, base, 1000);
  assert.equal(r.bad, false);
  assert.equal(r.warned, false);
});

test("higher sensitivity catches smaller slumps", () => {
  const base = measure(pose());
  const small = measure(pose({ noseY: 0.324 }));
  assert.equal(createMonitor({ alpha: 1 }).update(base, small, 0, { sensitivity: 1 }).bad, false);
  assert.equal(createMonitor({ alpha: 1 }).update(base, small, 0, { sensitivity: 2 }).bad, true);
});

test("average of samples", () => {
  assert.deepEqual(average([{ a: 1 }, { a: 3 }]), { a: 2 });
});

test("setupChecks falls back to unknown for body parts not in frame", () => {
  const c = setupChecks(pose());
  assert.equal(c.elbows.status, "unknown");
  assert.equal(c.knees.status, "unknown");
  assert.equal(c.shoulders.status, "ok");
});

test("setupChecks flags too-close and uneven shoulders", () => {
  const c = setupChecks(pose({ half: 0.4, tiltY: 0.08 }));
  assert.equal(c.distance.status, "adjust");
  assert.equal(c.shoulders.status, "adjust");
});

test("shoulder tilt doesn't wrap near ±180° when the 'left' shoulder is on the image's right", () => {
  // MediaPipe's left shoulder is the person's left, which appears on the image's right side.
  const flipped = (tiltY = 0) => {
    const lm = pose({ tiltY });
    const [l, r] = [lm[LM.L_SHOULDER], lm[LM.R_SHOULDER]];
    lm[LM.L_SHOULDER] = { ...r, y: l.y + 0 }; lm[LM.R_SHOULDER] = { ...l, y: l.y + tiltY };
    return lm;
  };
  const base = measure(flipped(0));
  assert.ok(Math.abs(base.tilt) < 1, `baseline tilt ${base.tilt}`);
  // sensor noise nudging one shoulder a hair either way must not look like ~360° of tilt
  for (const noise of [-0.002, 0.002]) assert.ok(deviation(base, measure(flipped(noise))).tilt < 2);
});

test("steady, upright posture never triggers a warning, even with landmark jitter", () => {
  const base = measure(pose());
  const mon = createMonitor();
  let warned = false;
  for (let i = 0; i < 200; i++) {
    const j = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.004;     // ±0.4% of frame
    warned ||= mon.update(base, measure(pose({ noseY: 0.3 + j, shoulderY: 0.6 - j, tiltY: j })), i * 500).warned;
  }
  assert.equal(warned, false);
});
