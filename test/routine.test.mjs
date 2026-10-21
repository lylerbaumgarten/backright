import test from "node:test";
import assert from "node:assert/strict";
import { createRoutine, countsAsBreak } from "../src/renderer/routine.js";

const steps = [{ id: "a", seconds: 3 }, { id: "b", seconds: 2 }, { id: "c", seconds: 2 }];
const run = (r, ms, step = 250) => { let s; for (let t = 0; t < ms; t += step) s = r.tick(step); return s; };

test("starts on the first stretch with its full time", () => {
  const s = createRoutine(steps).snapshot();
  assert.equal(s.index, 0); assert.equal(s.step.id, "a"); assert.equal(s.secondsLeft, 3); assert.equal(s.total, 3); assert.equal(s.done, false);
});

test("counts down and moves to the next stretch exactly when time runs out", () => {
  const r = createRoutine(steps);
  assert.equal(run(r, 2500).step.id, "a");
  assert.equal(r.snapshot().secondsLeft, 1);
  const s = run(r, 500);
  assert.equal(s.step.id, "b"); assert.equal(s.secondsLeft, 2);
});

test("finishes after the last stretch and stops counting", () => {
  const r = createRoutine(steps), s = run(r, 7000);
  assert.equal(s.done, true); assert.equal(s.step, null); assert.equal(s.progress, 1);
  assert.equal(r.tick(1000).elapsedMs, 7000, "elapsed time freezes when finished");
});

test("pause freezes the clock; resume continues from the same point", () => {
  const r = createRoutine(steps); run(r, 1000);
  r.pause(); const before = r.snapshot().remainingMs; run(r, 5000);
  assert.equal(r.snapshot().remainingMs, before); assert.equal(r.snapshot().paused, true);
  r.resume(); run(r, 500); assert.equal(r.snapshot().remainingMs, before - 500);
});

test("skip jumps ahead and can finish the routine", () => {
  const r = createRoutine(steps);
  assert.equal(r.skip().step.id, "b"); r.skip();
  assert.equal(r.skip().done, true);
  assert.equal(r.skip().done, true, "skipping when done is harmless");
});

test("back restarts a stretch you're well into, goes to the previous one near the start, and stops at the first", () => {
  const r = createRoutine([{ id: "a", seconds: 6 }, { id: "b", seconds: 6 }]);
  r.skip(); run(r, 4500);
  const restarted = r.back(); assert.equal(restarted.step.id, "b"); assert.equal(restarted.secondsLeft, 6);
  assert.equal(r.back().step.id, "a", "right at the start of b → previous stretch");
  assert.equal(r.back().step.id, "a"); assert.equal(r.snapshot().secondsLeft, 6, "can't go before the first");
});

test("a huge gap between ticks (laptop asleep) can't skip you through the routine", () => {
  const r = createRoutine(steps);
  const s = r.tick(10 * 60 * 1000);
  assert.equal(s.step.id, "a"); assert.equal(s.elapsedMs, 1000);
});

test("progress runs 0 → 1 within a stretch", () => {
  const r = createRoutine([{ id: "x", seconds: 4 }, { id: "y", seconds: 4 }]);
  assert.equal(r.snapshot().progress, 0); run(r, 2000); assert.equal(r.snapshot().progress, 0.5);
});

test("an empty routine is rejected; a break needs at least 30 s of real movement", () => {
  assert.throws(() => createRoutine([]), /at least one/);
  assert.equal(countsAsBreak(29999), false); assert.equal(countsAsBreak(30000), true);
});
