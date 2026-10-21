// End-to-end checks against the real app (macOS).   npm run e2e   — takes about a minute, uses a throwaway profile,
// never touches your camera or your installed copy.
import { launch, reporter, sleep, onScreenWindows } from "./lib/e2e.mjs";

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
  app.stop();
}

process.exit(r.done());
