// End-to-end checks against the real app (macOS).   npm run e2e   — takes about a minute, uses a throwaway profile,
// never touches your camera or your installed copy.
import { launch, reporter, sleep, onScreenWindows, existsSync, readFileSync } from "./lib/e2e.mjs";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { dateKey, shiftKey } from "../src/renderer/history.js";

const r = reporter();
const PILL = [500, 48];
// "Hidden" is asserted from Electron's own isVisible() (via the debug hook): the macOS window list is only trusted for
// "did it appear" — extra instances launched next to a running copy keep stale entries in it (see scripts/lib/e2e.mjs).
const pillHidden = async P => (await P.ev("window.__backright.overlays()")).pill.every(v => v === false);

// ============ movement-break reminders ============
{
  const app = await launch({ settings: { breaks: { enabled: true, intervalMin: 1 } } });
  const P = app.panel, hook = (expr) => P.ev(`window.__backright.${expr}`);
  r.check("test hook is available (debug mode)", await P.ev("!!window.__backright"));

  await hook("sample(true, false, 50)");                      // 50 s at the desk, interval is 1 min
  await sleep(400);
  r.check("no reminder before the interval", !(await hook("state().breakShowing")) && (await pillHidden(P)));

  await hook("sample(true, false, 15)");                      // → 65 s: due
  await sleep(900);
  r.check("reminder appears once the interval of desk time has passed", (await hook("state().breakShowing")) === true && onScreenWindows(...PILL) >= 1, `windows=${onScreenWindows(...PILL)}`);
  let pill = await app.page("pill.html");
  r.check("pill says it's time to move, with the three break buttons", (await pill.ev(`document.getElementById("msg").textContent`)).startsWith("Time to move") && (await pill.ev(`!document.getElementById("breakBtns").hidden && document.getElementById("postureBtns").hidden`)));

  await hook("sample(true, true, 2)"); await sleep(500);       // a posture nudge arrives while the reminder is up
  r.check("a posture nudge takes over the pill", (await pill.ev(`document.getElementById("msg").textContent`)).startsWith("Sit tall"));
  await hook("sample(true, false, 2)"); await sleep(3000);     // …and when it clears, the reminder is still waiting
  r.check("…and the reminder is shown again once the nudge clears", (await pill.ev(`document.getElementById("msg").textContent`)).startsWith("Time to move"));

  await pill.click("#breakSnooze"); await sleep(3000);
  r.check("Snooze hides the pill", (await pillHidden(P)) && (await hook("state().breakShowing")) === false);
  await hook("sample(true, false, 300)"); await sleep(600);
  r.check("it stays quiet for 10 minutes after Snooze", (await hook("state().breakShowing")) === false);
  await hook("sample(true, false, 400)"); await sleep(900);
  r.check("…then asks again", (await hook("state().breakShowing")) === true);

  await pill.click("#breakShow"); await sleep(3000);
  r.check("“Show me” hides the pill", await pillHidden(P));
  r.check("“Show me” starts a stretch routine in the app", !!(await P.ev(`document.querySelector("#moveCard .routine")`)), "routine view missing");
  r.check("…and the pill is dismissed and the timer restarted", (await hook("state().breakShowing")) === false && (await hook("state().activeMs")) === 0);
  await P.click('#moveCard [data-act="stop"]'); await sleep(300);

  await hook("sample(true, false, 70)"); await sleep(900);
  pill = await app.page("pill.html");
  await pill.click("#breakSkip"); await sleep(600);
  r.check("Skip starts a fresh interval", (await hook("state().breakShowing")) === false && (await hook("state().activeMs")) === 0);

  await hook("sample(true, false, 70)"); await sleep(900);
  await P.click("#breakOn"); await sleep(3000);               // turn reminders off while one is showing
  r.check("switching reminders off dismisses a showing reminder", (await pillHidden(P)) && (await hook("state().breakShowing")) === false);

  r.check("no errors anywhere in the app window", P.errors.length === 0, P.errors.join(" | "));
  await app.stop();
}

// ============ posture history + Progress tab ============
{
  // Three weeks of plausible data: last week ~75% good posture, this week ~90% (an improving trend).
  const todayKey = dateKey(Date.now()), days = {};
  // "this week" in the app = the last 7 days including today, so seed days 1–6 as this week (today is filled in live below)
  for (let i = 1; i <= 21; i++) {
    const thisWeek = i <= 6, monitored = 3 * 3600 + (i % 3) * 600;
    days[shiftKey(todayKey, -i)] = { sit: { monitoredSec: monitored, slippingSec: monitored * (thisWeek ? 0.10 : 0.25), slips: thisWeek ? 9 : 18, bestStreakSec: 1500, breaks: thisWeek ? 5 : 3, sens: thisWeek ? 1 : 1.25 } };
  }
  const seeded = { version: 1, days };
  let app = await launch({ history: seeded, port: 9371 });
  let P = app.panel;
  await P.click('#tabs button[data-tab="progress"]'); await sleep(500);
  const text = sel => P.ev(`document.querySelector(${JSON.stringify(sel)})?.textContent || ""`);
  r.check("Progress tab shows the seeded history: verdict says it's better", (await text(".verdict")).startsWith("Yes — your posture is better"), await text(".verdict"));
  r.check("…with the numbers behind it (90% vs 75%)", /90%/.test(await text(".trend-rows")) && /last week 75%/.test(await text(".trend-rows")), await text(".trend-rows"));
  r.check("the 14-day chart has one bar per day", (await P.ev(`document.querySelectorAll(".chart .c-bar").length`)) === 14);
  await P.click('#tab-progress [data-range="30"]'); await sleep(200);
  r.check("switching to 30 days draws 30 bars", (await P.ev(`document.querySelectorAll(".chart .c-bar").length`)) === 30);
  r.check("it warns that sensitivity changed during the period", /changed the sensitivity/.test(await text("#tab-progress")));
  r.check("export and delete are enabled when there is data", (await P.ev(`!document.querySelector('[data-act="export"]').disabled && !document.querySelector('[data-act="delete"]').disabled`)));

  // Record live: 5 min at the desk with one 20 s slip in the middle
  await P.ev("window.__backright.sample(true, false, 150)"); await P.ev("window.__backright.sample(true, true, 20)"); await P.ev("window.__backright.sample(true, false, 130)");
  const row = (await P.ev(`window.__backright.history()`)).days[todayKey]?.sit;
  r.check("simulated desk time is recorded: ~5 minutes, one slip of ~20 s", row && Math.abs(row.monitoredSec - 300) < 5 && row.slips === 1 && Math.abs(row.slippingSec - 20) < 3, JSON.stringify(row));
  await P.click('#tabs button[data-tab="monitor"]'); await P.click('#tabs button[data-tab="progress"]'); await sleep(300);   // re-open the tab (it also refreshes itself every 5 s)
  const stats = await text(".stats");
  r.check("Today's numbers appear on the Progress tab: 5 min monitored, 1 slip", /5 min/.test(stats) && /1\s*slip/.test(stats), stats);

  await P.ev("window.__backright.saveHistory()"); await sleep(600);
  const onDisk = JSON.parse(readFileSync(path.join(app.profile, "history.json"), "utf8"));
  r.check("history was saved to disk, numbers only", onDisk.days[todayKey]?.sit?.slips === 1 && !JSON.stringify(onDisk).match(/data:image|base64/));
  r.check("the saved file holds nothing but the documented fields", Object.keys(onDisk).sort().join() === "days,version" && Object.keys(onDisk.days[todayKey].sit).sort().join() === "bestStreakSec,breaks,monitoredSec,sens,slippingSec,slips");

  // Restart on the same data
  const profile = app.profile; await app.stop({ keepProfile: true }); await sleep(1500);
  app = await launch({ reuseProfile: profile, port: 9372 }); P = app.panel;
  const again = (await P.ev(`window.__backright.history()`)).days[todayKey]?.sit;
  r.check("after a restart the history is still there", again?.slips === 1 && Math.abs(again.monitoredSec - 300) < 5, JSON.stringify(again));

  // Delete
  await P.click('#tabs button[data-tab="progress"]'); await sleep(400);
  await P.click('#tab-progress [data-act="delete"]'); await sleep(300);
  r.check("Delete asks for confirmation first", /Delete all your posture history/.test(await text("#tab-progress")) && existsSync(path.join(profile, "history.json")));
  await P.click('#tab-progress [data-act="cancel"]'); await sleep(300);
  r.check("Cancel keeps everything", existsSync(path.join(profile, "history.json")) && !/Delete all your posture history/.test(await text("#tab-progress")));
  await P.click('#tab-progress [data-act="delete"]'); await P.click('#tab-progress [data-act="really"]'); await sleep(600);
  r.check("confirming deletes the file and empties the tab", !existsSync(path.join(profile, "history.json")) && /Nothing here yet/.test(await text("#tab-progress")));
  r.check("no errors anywhere in the app window", P.errors.length === 0, P.errors.join(" | "));
  await app.stop();
}

process.exit(r.done());
