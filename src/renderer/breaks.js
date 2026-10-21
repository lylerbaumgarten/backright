// "Time to move" scheduler — pure: no timers, no DOM, time is passed in, so every rule is unit-tested.
//
// What counts: minutes you're actually at the desk (monitoring on AND a person detected) — not wall-clock time.
//  • stepping away for `awayMin` minutes counts as a break (timer resets, and an "away-break" event is reported once);
//  • a short absence just pauses the count;
//  • a gap in ticks (monitoring paused, laptop asleep) is not "time at the desk" and not a break either;
//  • when it's due but a posture nudge is on screen (`blocked`), the reminder waits its turn.

const MIN = 60000;
const MAX_STEP_MS = 15000;   // a tick further than this from the last one is a gap, not 15+ seconds of sitting

export function createBreakScheduler({ intervalMin = 30, awayMin = 5, snoozeMin = 10 } = {}) {
  let interval = intervalMin * MIN, activeMs = 0, awayMs = 0, last = null, awayCredited = false, snoozedUntil = 0;

  const state = (now, blocked, events) => ({
    activeMs, minutesActive: Math.floor(activeMs / MIN),
    due: activeMs >= interval,
    dueNow: activeMs >= interval && now >= snoozedUntil && !blocked,
    events,
  });

  return {
    /** Call on every sample. present = a person was detected this sample; monitoring = the camera is running. */
    tick(now, { present, monitoring = true, blocked = false } = {}) {
      const events = [];
      if (last === null) { last = now; return state(now, blocked, events); }
      const dt = now - last; last = now;
      if (dt > MAX_STEP_MS) {                                   // a gap: nothing is known about it
        if (dt >= awayMin * MIN) { activeMs = 0; awayMs = 0; awayCredited = false; }   // long → fresh start (but no break credit)
        return state(now, blocked, events);
      }
      if (!monitoring) return state(now, blocked, events);
      if (present) { activeMs += dt; awayMs = 0; awayCredited = false; }
      else {
        awayMs += dt;
        if (awayMs >= awayMin * MIN && !awayCredited) { awayCredited = true; if (activeMs > 0) events.push("away-break"); activeMs = 0; }
      }
      return state(now, blocked, events);
    },

    /** The user responded to a reminder: "taken" and "skipped" both start a fresh interval; "snoozed" asks again later. */
    acknowledge(now, kind) {
      if (kind === "snoozed") snoozedUntil = now + snoozeMin * MIN;
      else { activeMs = 0; awayMs = 0; snoozedUntil = 0; }
    },

    configure({ intervalMin: m }) { if (m > 0) interval = m * MIN; },
    snapshot: () => ({ activeMs, awayMs, snoozedUntil }),
  };
}

export const INTERVAL_CHOICES = [20, 30, 45, 60];
