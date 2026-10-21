// Posture history — pure (no DOM, no storage, no clock): numbers only, never images.
//
// Shape (what ends up in history.json):
//   { version: 1, days: { "2026-10-21": { sit: Row, stand: Row } } }
//   Row = { monitoredSec, slippingSec, slips, bestStreakSec, breaks, sens }
//
// "monitored" = time a person was detected while monitoring; "slipping" = the part of it spent in the warned state;
// a "slip" = the moment a slip became a warning (the glow would appear); "streak" = consecutive good seconds.

export const VERSION = 1;
const MAX_STEP_SEC = 15;                  // a gap longer than this between samples is "unknown", not time at the desk
export const MIN_TREND_SEC = 600;         // each of the two weeks needs ≥ 10 monitored minutes before we call a trend
const KEEP_DAYS = 365;

export const emptyHistory = () => ({ version: VERSION, days: {} });
const emptyRow = () => ({ monitoredSec: 0, slippingSec: 0, slips: 0, bestStreakSec: 0, breaks: 0, sens: 1 });

/** Local calendar date for a timestamp. tzOffsetMin is injectable for tests (minutes east of UTC); default = this machine. */
export function dateKey(ms, tzOffsetMin = -new Date(ms).getTimezoneOffset()) {
  return new Date(ms + tzOffsetMin * 60000).toISOString().slice(0, 10);
}
const dayMs = 86400000;
export const shiftKey = (key, days) => new Date(Date.parse(key + "T00:00:00Z") + days * dayMs).toISOString().slice(0, 10);

// ---------- recording ----------
export function createRecorder(initial = emptyHistory(), { tzOffsetMin } = {}) {
  const data = initial;
  let last = null, prevWarned = false, streak = 0, dirty = false;
  const row = (key, mode) => ((data.days[key] ??= {})[mode] ??= emptyRow());
  const key = now => dateKey(now, tzOffsetMin);

  return {
    /** One camera sample. present = a person was detected. Only present time counts as monitored time. */
    record(now, { present, warned = false, mode = "sit", sensitivity = 1 }) {
      const dt = last === null ? 0 : (now - last) / 1000;
      last = now;
      if (dt <= 0 || dt > MAX_STEP_SEC) { streak = 0; prevWarned = false; return; }    // first sample or a gap: nothing to credit
      if (!present) { streak = 0; prevWarned = false; return; }
      const r = row(key(now), mode);
      r.monitoredSec += dt; r.sens = Math.round(sensitivity * 20) / 20; dirty = true;
      if (warned) { r.slippingSec += dt; streak = 0; if (!prevWarned) r.slips++; }
      else { streak += dt; if (streak > r.bestStreakSec) r.bestStreakSec = streak; }
      prevWarned = warned;
    },
    addBreak(now, mode = "sit") { row(key(now), mode).breaks++; dirty = true; },
    data: () => data,
    isDirty: () => dirty, markSaved: () => { dirty = false; },
  };
}

// ---------- loading / pruning ----------
const num = (v, max = 1e9) => (Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0);
/** Accept whatever was on disk; keep only well-formed rows. Garbage → empty history (never throws). */
export function sanitize(raw) {
  const out = emptyHistory();
  if (!raw || typeof raw !== "object" || typeof raw.days !== "object" || !raw.days) return out;
  for (const [k, modes] of Object.entries(raw.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !modes || typeof modes !== "object") continue;
    for (const mode of ["sit", "stand"]) {
      const r = modes[mode]; if (!r || typeof r !== "object") continue;
      const monitored = num(r.monitoredSec, dayMs / 1000);
      (out.days[k] ??= {})[mode] = { monitoredSec: monitored, slippingSec: Math.min(num(r.slippingSec), monitored), slips: Math.floor(num(r.slips, 1e5)),
        bestStreakSec: Math.min(num(r.bestStreakSec), monitored), breaks: Math.floor(num(r.breaks, 1e4)), sens: Number.isFinite(r.sens) && r.sens > 0 ? r.sens : 1 };
    }
  }
  return out;
}
export function prune(data, todayKey, keepDays = KEEP_DAYS) {
  const cutoff = shiftKey(todayKey, -keepDays);
  for (const k of Object.keys(data.days)) if (k < cutoff) delete data.days[k];
  return data;
}

// ---------- aggregation ----------
const rowsIn = (data, keys, mode) => keys.flatMap(k => ["sit", "stand"].filter(m => !mode || m === mode).map(m => data.days[k]?.[m]).filter(Boolean));

export function summarize(rows) {
  const t = rows.reduce((a, r) => ({ monitoredSec: a.monitoredSec + r.monitoredSec, slippingSec: a.slippingSec + r.slippingSec, slips: a.slips + r.slips,
    breaks: a.breaks + r.breaks, bestStreakSec: Math.max(a.bestStreakSec, r.bestStreakSec) }), { monitoredSec: 0, slippingSec: 0, slips: 0, breaks: 0, bestStreakSec: 0 });
  const hours = t.monitoredSec / 3600;
  return { ...t, goodPct: t.monitoredSec > 0 ? 100 * (1 - t.slippingSec / t.monitoredSec) : null, slipsPerHour: hours > 0 ? t.slips / hours : null };
}

export const today = (data, todayKey, mode) => summarize(rowsIn(data, [todayKey], mode));

/** The last n days ending at endKey, oldest first — one entry per day, empty days included, for the chart. */
export function lastDays(data, endKey, n, mode) {
  return Array.from({ length: n }, (_, i) => { const date = shiftKey(endKey, i - (n - 1)); return { date, ...summarize(rowsIn(data, [date], mode)) }; });
}

/** This week (last 7 days) vs the one before it. `verdict`: better | worse | steady | unknown (not enough data yet). */
export function trend(data, endKey, mode) {
  const week = offset => Array.from({ length: 7 }, (_, i) => shiftKey(endKey, -(offset + i)));
  const a = summarize(rowsIn(data, week(0), mode)), b = summarize(rowsIn(data, week(7), mode));
  const enough = a.monitoredSec >= MIN_TREND_SEC && b.monitoredSec >= MIN_TREND_SEC;
  if (!enough) return { enough, thisWeek: a, lastWeek: b, verdict: "unknown", goodDelta: null, slipsChange: null };
  const goodDelta = a.goodPct - b.goodPct;
  const slipsChange = b.slipsPerHour > 0 ? (a.slipsPerHour - b.slipsPerHour) / b.slipsPerHour : null;
  const verdict = goodDelta >= 3 ? "better" : goodDelta <= -3 ? "worse" : slipsChange !== null && slipsChange <= -0.15 ? "better" : slipsChange !== null && slipsChange >= 0.15 ? "worse" : "steady";
  return { enough, thisWeek: a, lastWeek: b, verdict, goodDelta, slipsChange };
}

/** Distinct sensitivity settings used within the window — more than one means "slipping" meant different things on different days. */
export function sensitivityChanged(data, endKey, n, mode) {
  const keys = Array.from({ length: n }, (_, i) => shiftKey(endKey, -i));
  return new Set(rowsIn(data, keys, mode).filter(r => r.monitoredSec > 0).map(r => r.sens)).size > 1;
}

// ---------- export ----------
export function toCSV(data) {
  const lines = ["date,mode,monitored_minutes,slipping_minutes,good_posture_percent,slips,best_streak_minutes,breaks,sensitivity"];
  for (const date of Object.keys(data.days).sort()) for (const mode of ["sit", "stand"]) {
    const r = data.days[date][mode]; if (!r) continue;
    const good = r.monitoredSec > 0 ? (100 * (1 - r.slippingSec / r.monitoredSec)).toFixed(1) : "";
    lines.push([date, mode, (r.monitoredSec / 60).toFixed(1), (r.slippingSec / 60).toFixed(1), good, r.slips, (r.bestStreakSec / 60).toFixed(1), r.breaks, r.sens].join(","));
  }
  return lines.join("\n") + "\n";
}

export const formatDuration = sec => { const m = Math.round(sec / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`; };
