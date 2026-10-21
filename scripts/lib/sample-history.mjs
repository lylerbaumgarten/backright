// Three weeks of plausible posture history for tests and README screenshots: last week ≈ 75% good posture, this week ≈ 90%
// (an improving trend). SAMPLE DATA — it is never shipped in the app or written to a real profile.
import { shiftKey } from "../../src/renderer/history.js";

export function sampleHistory(todayKey) {
  const days = {};
  // "this week" in the app = the last 7 days including today, so days 1–6 are this week (today is filled in live by the caller)
  for (let i = 1; i <= 21; i++) {
    const thisWeek = i <= 6, monitored = 3 * 3600 + (i % 3) * 600 + (i % 5) * 240;
    days[shiftKey(todayKey, -i)] = { sit: { monitoredSec: monitored, slippingSec: Math.round(monitored * ((thisWeek ? 0.10 : 0.25) + ((i * 7) % 5 - 2) * 0.012)), slips: thisWeek ? 9 : 18,
      bestStreakSec: 1500, breaks: thisWeek ? 5 : 3, sens: thisWeek ? 1 : 1.25 } };
  }
  return { version: 1, days };
}
