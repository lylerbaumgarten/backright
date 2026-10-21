// A guided stretch routine as a pure state machine: no timers, no DOM. The UI calls tick(dtMs) from an interval;
// tests call it with whatever dt they like. Time only moves while the routine is running (not paused or done).

/** Any single tick moves the clock by at most this much, so a sleeping laptop can't skip you through the routine. */
const MAX_TICK_MS = 1000;
const RESTART_AFTER_MS = 3000;   // "Back" restarts the current stretch once you're this far into it

export function createRoutine(steps) {
  if (!steps.length) throw new Error("a routine needs at least one stretch");
  let index = 0, remainingMs = steps[0].seconds * 1000, paused = false, done = false, elapsedMs = 0;

  const snapshot = () => ({
    index, total: steps.length, step: done ? null : steps[index], paused, done,
    remainingMs: done ? 0 : remainingMs, secondsLeft: done ? 0 : Math.ceil(remainingMs / 1000),
    progress: done ? 1 : 1 - remainingMs / (steps[index].seconds * 1000),     // 0..1 within the current stretch
    elapsedMs,                                                                 // time actually spent moving
  });
  const enter = i => {
    if (i >= steps.length) { done = true; return; }
    index = Math.max(0, i); remainingMs = steps[index].seconds * 1000;
  };

  return {
    snapshot,
    tick(dtMs) {
      if (paused || done) return snapshot();
      const dt = Math.max(0, Math.min(dtMs, MAX_TICK_MS));
      elapsedMs += dt; remainingMs -= dt;
      if (remainingMs <= 0) enter(index + 1);
      return snapshot();
    },
    skip() { if (!done) enter(index + 1); return snapshot(); },
    // Like a music player: well into a stretch → restart it; right at the start → go to the previous one.
    back() {
      if (done) return snapshot();
      const spent = steps[index].seconds * 1000 - remainingMs;
      enter(spent > RESTART_AFTER_MS ? index : index - 1);
      return snapshot();
    },
    pause() { paused = true; return snapshot(); },
    resume() { paused = false; return snapshot(); },
  };
}

/** Whether a routine that ran for `elapsedMs` is worth logging as a movement break. */
export const countsAsBreak = elapsedMs => elapsedMs >= 30000;
