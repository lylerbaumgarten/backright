import test from "node:test";
import assert from "node:assert/strict";
import { createRecorder, emptyHistory, sanitize, prune, summarize, today, lastDays, trend, sensitivityChanged, toCSV, dateKey, shiftKey, formatDuration, MIN_TREND_SEC } from "../src/renderer/history.js";

const T0 = Date.UTC(2026, 9, 21, 9, 0, 0);          // 2026-10-21 09:00 UTC; tests use tz offset 0 unless stated
const rec = () => createRecorder(emptyHistory(), { tzOffsetMin: 0 });
/** feed n one-second samples starting at t0 */
const feed = (r, t0, n, opts, step = 1000) => { for (let i = 0; i <= n; i++) r.record(t0 + i * step, opts); return t0 + n * step; };
const good = { present: true, warned: false, mode: "sit", sensitivity: 1 };
const bad = { ...good, warned: true };

test("dates are local-calendar days and shift correctly across months and years", () => {
  assert.equal(dateKey(Date.UTC(2026, 9, 21, 23, 30), 0), "2026-10-21");
  assert.equal(dateKey(Date.UTC(2026, 9, 21, 23, 30), 120), "2026-10-22", "2 h east of UTC is already tomorrow");
  assert.equal(shiftKey("2026-03-01", -1), "2026-02-28"); assert.equal(shiftKey("2026-12-31", 1), "2027-01-01");
});

test("monitored and slipping seconds accumulate; absence and gaps credit nothing", () => {
  const r = rec(); let t = feed(r, T0, 60, good);                                  // 60 s good
  t = feed(r, t + 1000, 30, bad);                                                  // 30 s slipping
  r.record(t + 5000, { ...good, present: false }); r.record(t + 6000, { ...good, present: false });   // away: nothing
  r.record(t + 3600000, good); r.record(t + 3601000, good);                        // an hour-long gap, then 1 s of real time
  const row = r.data().days["2026-10-21"].sit;
  assert.ok(Math.abs(row.monitoredSec - 92) < 2, `monitored ${row.monitoredSec}`);
  assert.ok(Math.abs(row.slippingSec - 30) < 2, `slipping ${row.slippingSec}`);
});

test("a slip is counted once, when it starts — not per sample, and again only after recovering", () => {
  const r = rec(); let t = feed(r, T0, 10, good);
  t = feed(r, t + 1000, 20, bad);           // slip #1 lasting 20 s
  t = feed(r, t + 1000, 10, good);
  t = feed(r, t + 1000, 5, bad);            // slip #2
  assert.equal(r.data().days["2026-10-21"].sit.slips, 2);
});

test("best streak is the longest run of good seconds, broken by slips", () => {
  const r = rec(); let t = feed(r, T0, 40, good);
  t = feed(r, t + 1000, 3, bad); t = feed(r, t + 1000, 25, good);
  assert.ok(Math.abs(r.data().days["2026-10-21"].sit.bestStreakSec - 40) < 2);
});

test("sit and stand are kept separately, and days roll over at local midnight", () => {
  const r = rec();
  feed(r, T0, 10, good); feed(r, T0 + 100000, 10, { ...good, mode: "stand" });
  const midnight = Date.UTC(2026, 9, 21, 23, 59, 55); feed(r, midnight, 12, good);
  const d = r.data().days;
  assert.ok(d["2026-10-21"].sit && d["2026-10-21"].stand && d["2026-10-22"].sit, JSON.stringify(Object.keys(d)));
});

test("breaks are counted per day and mode", () => {
  const r = rec(); r.addBreak(T0, "sit"); r.addBreak(T0 + 1000, "sit"); r.addBreak(T0, "stand");
  assert.equal(r.data().days["2026-10-21"].sit.breaks, 2); assert.equal(r.data().days["2026-10-21"].stand.breaks, 1);
});

test("dirty tracking: recording sets it, markSaved clears it", () => {
  const r = rec(); assert.equal(r.isDirty(), false);
  feed(r, T0, 3, good); assert.equal(r.isDirty(), true); r.markSaved(); assert.equal(r.isDirty(), false);
});

test("sanitize keeps good rows, drops junk, clamps impossible numbers, and never throws", () => {
  assert.deepEqual(sanitize(null), emptyHistory()); assert.deepEqual(sanitize("x"), emptyHistory()); assert.deepEqual(sanitize({ days: 5 }), emptyHistory());
  const h = sanitize({ days: { "2026-10-21": { sit: { monitoredSec: 100, slippingSec: 999, slips: -4, bestStreakSec: 5000, breaks: 2.7, sens: "x" }, stand: "nope" }, "garbage": { sit: {} } } });
  assert.deepEqual(Object.keys(h.days), ["2026-10-21"]);
  const r = h.days["2026-10-21"].sit;
  assert.equal(r.slippingSec, 100, "slipping can't exceed monitored"); assert.equal(r.slips, 0); assert.equal(r.bestStreakSec, 100); assert.equal(r.breaks, 2); assert.equal(r.sens, 1);
  assert.equal(h.days["2026-10-21"].stand, undefined);
});

test("prune drops days older than a year but keeps the rest", () => {
  const h = { version: 1, days: { "2025-01-01": { sit: {} }, "2026-10-01": { sit: {} } } };
  prune(h, "2026-10-21", 365); assert.deepEqual(Object.keys(h.days), ["2026-10-01"]);
});

// ---- aggregation over synthetic weeks ----
function week(endKey, offset, { monitoredMin, slippingMin, slips, breaks = 0, sens = 1, mode = "sit" }) {
  const days = {}; for (let i = 0; i < 7; i++) days[shiftKey(endKey, -(offset + i))] = { [mode]: { monitoredSec: monitoredMin * 60, slippingSec: slippingMin * 60, slips, bestStreakSec: 900, breaks, sens } };
  return days;
}
const make = (...weeks) => ({ version: 1, days: Object.assign({}, ...weeks) });
const END = "2026-10-21";

test("summaries: good % and slips per hour", () => {
  const s = summarize([{ monitoredSec: 3600, slippingSec: 360, slips: 6, bestStreakSec: 500, breaks: 1 }, { monitoredSec: 3600, slippingSec: 0, slips: 0, bestStreakSec: 900, breaks: 2 }]);
  assert.equal(s.goodPct, 95); assert.equal(s.slipsPerHour, 3); assert.equal(s.breaks, 3); assert.equal(s.bestStreakSec, 900);
  assert.equal(summarize([]).goodPct, null, "no data → no percentage, not 100%");
});

test("lastDays returns one entry per day, oldest first, with empty days included", () => {
  const h = make({ [END]: { sit: { monitoredSec: 60, slippingSec: 0, slips: 0, bestStreakSec: 60, breaks: 0, sens: 1 } } });
  const d = lastDays(h, END, 14);
  assert.equal(d.length, 14); assert.equal(d[13].date, END); assert.equal(d[0].date, "2026-10-08"); assert.equal(d[0].goodPct, null); assert.equal(d[13].goodPct, 100);
});

test("trend: improving week → better, with the deltas", () => {
  const h = make(week(END, 0, { monitoredMin: 240, slippingMin: 24, slips: 20 }), week(END, 7, { monitoredMin: 240, slippingMin: 60, slips: 40 }));   // 90% vs 75%
  const t = trend(h, END); assert.equal(t.enough, true); assert.equal(t.verdict, "better");
  assert.ok(Math.abs(t.goodDelta - 15) < 0.01); assert.ok(t.slipsChange < -0.4);
});

test("trend: worse, steady, and the slips-per-hour tie-break", () => {
  assert.equal(trend(make(week(END, 0, { monitoredMin: 240, slippingMin: 80, slips: 20 }), week(END, 7, { monitoredMin: 240, slippingMin: 40, slips: 20 })), END).verdict, "worse");
  assert.equal(trend(make(week(END, 0, { monitoredMin: 240, slippingMin: 40, slips: 20 }), week(END, 7, { monitoredMin: 240, slippingMin: 40, slips: 20 })), END).verdict, "steady");
  assert.equal(trend(make(week(END, 0, { monitoredMin: 240, slippingMin: 40, slips: 10 }), week(END, 7, { monitoredMin: 240, slippingMin: 41, slips: 20 })), END).verdict, "better", "same %, but far fewer slips");
});

test("trend refuses to call it without enough data in BOTH weeks", () => {
  const thin = { monitoredMin: (MIN_TREND_SEC / 60 - 1) / 7, slippingMin: 0, slips: 0 };
  assert.equal(trend(make(week(END, 0, thin), week(END, 7, { monitoredMin: 240, slippingMin: 0, slips: 0 })), END).verdict, "unknown");
  assert.equal(trend(make(week(END, 0, { monitoredMin: 240, slippingMin: 0, slips: 0 })), END).verdict, "unknown", "no previous week at all");
  assert.equal(trend(emptyHistory(), END).enough, false);
});

test("sensitivity changes inside the window are detected (so the chart can warn)", () => {
  assert.equal(sensitivityChanged(make(week(END, 0, { monitoredMin: 60, slippingMin: 0, slips: 0, sens: 1 })), END, 14), false);
  assert.equal(sensitivityChanged(make(week(END, 0, { monitoredMin: 60, slippingMin: 0, slips: 0, sens: 1 }), week(END, 7, { monitoredMin: 60, slippingMin: 0, slips: 0, sens: 1.5 })), END, 14), true);
});

test("CSV export: header, one row per day+mode, sorted by date, numbers only", () => {
  const h = make({ "2026-10-21": { sit: { monitoredSec: 3600, slippingSec: 360, slips: 4, bestStreakSec: 1200, breaks: 2, sens: 1 } }, "2026-10-20": { stand: { monitoredSec: 600, slippingSec: 0, slips: 0, bestStreakSec: 600, breaks: 0, sens: 1.25 } } });
  const lines = toCSV(h).trim().split("\n");
  assert.equal(lines[0], "date,mode,monitored_minutes,slipping_minutes,good_posture_percent,slips,best_streak_minutes,breaks,sensitivity");
  assert.equal(lines[1], "2026-10-20,stand,10.0,0.0,100.0,0,10.0,0,1.25"); assert.equal(lines[2], "2026-10-21,sit,60.0,6.0,90.0,4,20.0,2,1");
  assert.equal(lines.length, 3);
});

test("durations read naturally", () => { assert.equal(formatDuration(40 * 60), "40 min"); assert.equal(formatDuration(95 * 60), "1 h 35 min"); });
