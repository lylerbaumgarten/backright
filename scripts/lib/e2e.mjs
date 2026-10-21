// Tiny end-to-end harness: launches the real app on a throwaway profile with test hooks on, and lets a script
// drive and inspect it over DevTools. macOS only. Used by scripts/e2e.mjs.
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { root, APP_NAME } from "./bundle.mjs";

export { existsSync, readFileSync };
export const sleep = ms => new Promise(r => setTimeout(r, ms));
const DEFAULT_SETTINGS = { onboarded: true, baselines: { sit: { neck: 0.7, size: 0.42, tilt: 0, v: 2 }, stand: null }, setupDone: { sit: true, stand: false } };

async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r));
  let id = 0; const errors = [];
  ws.addEventListener("message", e => { const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console.error: " + m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 160)); });
  const call = (method, params = {}) => new Promise(res => { const i = ++id; const h = e => { const m = JSON.parse(e.data); if (m.id === i) { ws.removeEventListener("message", h); res(m); } }; ws.addEventListener("message", h); ws.send(JSON.stringify({ id: i, method, params })); });
  await call("Runtime.enable");
  const ev = async expr => { const r = await call("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description?.split("\n")[0] || "evaluate failed"); return r.result?.result?.value; };
  const click = async sel => { const r = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return "missing"; e.click(); return "ok"})()`); if (r !== "ok") throw new Error(`click: no element ${sel}`); };
  return { call, ev, click, errors, close: () => ws.close() };
}

/**
 * Number of this app's windows of (about) a given size currently on screen — about, because macOS reports on-screen windows
 * scaled by the display's scaling (a 500×48 pill can show up as 450×44) (to see the pill / glow strips appear and vanish).
 * Throws if the window list can't be read, so a broken check can never pass silently. (osascript prints to stderr.)
 *
 * Only trust this for "did it appear". For "did it go away" ask the app (window.__backright.overlays()): when a second copy of
 * the app is launched next to a running one, macOS keeps listing its hidden overlay windows as on-screen (and reports them
 * at 90% size), while Electron's isVisible() and the real, single-instance app behave correctly.
 */
export function onScreenWindows(w, h) {
  const js = `ObjC.import('CoreGraphics');
    const arr = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly, 0)));
    console.log("COUNT=" + arr.filter(x => x.kCGWindowBounds.Width >= ${w} * 0.8 && x.kCGWindowBounds.Width <= ${w} * 1.05 && x.kCGWindowBounds.Height >= ${h} * 0.8 && x.kCGWindowBounds.Height <= ${h} * 1.05 && x.kCGWindowIsOnscreen && x.kCGWindowOwnerPID === ${"${PID}"}).length);`;
  return countFor(js);
}
let appPid = null;
function countFor(js) {
  const r = spawnSync("osascript", ["-l", "JavaScript", "-e", js.replace("${PID}", String(appPid))], { encoding: "utf8" });
  const m = /COUNT=(\d+)/.exec((r.stderr || "") + (r.stdout || ""));
  if (!m) throw new Error("couldn't read the window list: " + ((r.stderr || "") + (r.stdout || "")).slice(0, 200));
  return parseInt(m[1], 10);
}

export async function launch({ settings = {}, history = null, port = 9370, reuseProfile = null } = {}) {
  execFileSync("node", [path.join(root, "scripts/dev-app.mjs"), "--no-launch"], { stdio: "ignore" });
  const profile = reuseProfile ?? mkdtempSync(path.join(os.tmpdir(), "backright-e2e-"));   // reuseProfile: restart the app on the same data
  if (!reuseProfile) {
    writeFileSync(path.join(profile, "settings.json"), JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
    if (history) writeFileSync(path.join(profile, "history.json"), JSON.stringify(history));
  }
  // Launch the way a user does (through macOS, `open`), not by executing the binary directly: a directly-executed
  // app isn't a proper foreground GUI app, and window hide/show then behaves differently — which would make the
  // overlay checks below lie.
  const logFile = path.join(profile, "app.log");
  writeFileSync(logFile, "");
  const appPath = path.join(root, `build/${APP_NAME}.app`);
  const openArgs = ["-n", ...(process.env.E2E_FOREGROUND ? [] : ["-g"]), "--env", "BACKRIGHT_DEBUG=1", "--stdout", logFile, "--stderr", logFile, appPath, "--args", `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`];
  execFileSync("open", openArgs);
  const findPid = () => { const r = spawnSync("pgrep", ["-f", `remote-debugging-port=${port}`], { encoding: "utf8" }); return parseInt(r.stdout.split("\n")[0], 10) || null; };
  for (let i = 0; i < 40 && !appPid; i++) { appPid = findPid(); if (!appPid) await sleep(250); }
  const child = { kill: () => { try { process.kill(findPid() ?? appPid); } catch {} } };
  const targets = async () => { try { return await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { return []; } };
  let panelTarget; for (let i = 0; i < 60 && !panelTarget; i++) { panelTarget = (await targets()).find(t => t.url.endsWith("index.html")); if (!panelTarget) await sleep(500); }
  if (!panelTarget) { child.kill(); throw new Error("app window never appeared"); }
  const panel = await connect(panelTarget);
  await sleep(1500);   // let the renderer finish booting
  const app = {
    profile, panel, sleep, log: () => readFileSync(logFile, "utf8"),
    /** DevTools handle for the first window whose URL ends with `suffix` (e.g. "pill.html"). */
    async page(suffix) { const t = (await targets()).find(t => t.url.includes(suffix)); if (!t) throw new Error(`no window ${suffix}`); return connect(t); },
    /** Quit the app, wait for its helper processes to let go of the profile folder, then (unless asked not to) delete it. */
    async stop({ keepProfile = false } = {}) {
      try { panel.close(); } catch {}
      child.kill(); await sleep(1200);
      if (!keepProfile) try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* temp folder; the OS will tidy it */ }
    },
  };
  process.on("exit", () => { child.kill(); if (!reuseProfile) try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }); } catch {} });
  return app;
}

/** Tiny assertion reporter so a script reads as a list of ✓/✗ lines and exits non-zero on any failure. */
export function reporter() {
  let failed = 0;
  return {
    check(name, ok, detail = "") { console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? `   (${detail})` : ""}`); if (!ok) failed++; },
    done() { console.log(failed ? `\n${failed} check(s) failed` : "\nall checks passed"); return failed ? 1 : 0; },
  };
}
