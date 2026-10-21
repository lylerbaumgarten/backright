import test from "node:test";
import assert from "node:assert/strict";
import { createBreakScheduler } from "../src/renderer/breaks.js";

const MIN = 60000;
/** Feed the scheduler samples every `step` ms for `ms` ms starting at `t0`; returns [lastState, endTime, allEvents]. */
function run(s, t0, ms, opts, step = 1000) {
  let st, t = t0, events = [];
  for (; t < t0 + ms; t += step) { st = s.tick(t, opts); events.push(...st.events); }
  return [st, t, events];
}
const present = { present: true, monitoring: true };

test("counts only time at the desk and becomes due at the interval", () => {
  const s = createBreakScheduler({ intervalMin: 30 });
  let [st, t] = run(s, 0, 29 * MIN, present);
  assert.equal(st.due, false); assert.equal(st.minutesActive, 28, "first sample sets the reference");
  [st] = run(s, t, 2 * MIN, present);
  assert.equal(st.due, true); assert.equal(st.dueNow, true);
});

test("a short absence pauses the count without resetting it", () => {
  const s = createBreakScheduler({ intervalMin: 30, awayMin: 5 });
  let [, t] = run(s, 0, 10 * MIN, present);
  let [st, , events] = run(s, t, 3 * MIN, { present: false, monitoring: true });   // 3 min away: under the threshold
  assert.equal(events.length, 0); assert.ok(st.minutesActive >= 9, "progress kept");
  [st] = run(s, t + 3 * MIN, 5 * MIN, present);
  assert.ok(st.minutesActive >= 14, "and carries on from where it was");
});

test("stepping away 5+ minutes is a break: timer resets and the event fires exactly once", () => {
  const s = createBreakScheduler({ intervalMin: 30, awayMin: 5 });
  let [, t] = run(s, 0, 20 * MIN, present);
  const [st, , events] = run(s, t, 12 * MIN, { present: false, monitoring: true });
  assert.deepEqual(events, ["away-break"]); assert.equal(st.activeMs, 0);
});

test("being away when nothing had accumulated is not reported as a break", () => {
  const s = createBreakScheduler(); s.tick(0, present);
  const [, , events] = run(s, 1000, 10 * MIN, { present: false, monitoring: true });
  assert.deepEqual(events, []);
});

test("a gap in samples (monitoring paused, laptop asleep) is neither desk time nor a break", () => {
  const s = createBreakScheduler({ intervalMin: 30, awayMin: 5 });
  let [, t] = run(s, 0, 10 * MIN, present);
  const before = s.snapshot().activeMs;
  let st = s.tick(t + 3 * MIN, present);                       // 3 min gap: ignored, nothing credited
  assert.equal(st.activeMs, before); assert.deepEqual(st.events, []);
  st = s.tick(t + 3 * MIN + 1000 + 60 * MIN, present);          // an hour gap: fresh start, still no break credit
  assert.equal(st.activeMs, 0); assert.deepEqual(st.events, []);
});

test("when a posture nudge is showing the reminder waits, then fires", () => {
  const s = createBreakScheduler({ intervalMin: 1 });
  let [st, t] = run(s, 0, 2 * MIN, { ...present, blocked: true });
  assert.equal(st.due, true); assert.equal(st.dueNow, false);
  st = s.tick(t, present); assert.equal(st.dueNow, true);
});

test("taking or skipping a break starts a fresh interval", () => {
  for (const kind of ["taken", "skipped"]) {
    const s = createBreakScheduler({ intervalMin: 1 });
    let [st, t] = run(s, 0, 90000, present); assert.equal(st.dueNow, true);
    s.acknowledge(t, kind);
    st = s.tick(t + 1000, present); assert.equal(st.due, false, kind);
  }
});

test("snooze hides the reminder for the snooze period, then asks again — progress isn't lost", () => {
  const s = createBreakScheduler({ intervalMin: 1, snoozeMin: 10 });
  let [st, t] = run(s, 0, 90000, present);
  s.acknowledge(t, "snoozed");
  [st, t] = run(s, t, 9 * MIN, present); assert.equal(st.dueNow, false); assert.equal(st.due, true);
  [st] = run(s, t, 2 * MIN, present); assert.equal(st.dueNow, true);
});

test("changing the interval applies immediately", () => {
  const s = createBreakScheduler({ intervalMin: 60 });
  let [st] = run(s, 0, 25 * MIN, present); assert.equal(st.due, false);
  s.configure({ intervalMin: 20 }); st = s.tick(25 * MIN + 1000, present);
  assert.equal(st.due, true);
});

test("monitoring off freezes the clock", () => {
  const s = createBreakScheduler({ intervalMin: 30 });
  let [, t] = run(s, 0, 5 * MIN, present);
  const a = s.snapshot().activeMs;
  run(s, t, 5 * MIN, { present: true, monitoring: false });
  assert.equal(s.snapshot().activeMs, a);
});
