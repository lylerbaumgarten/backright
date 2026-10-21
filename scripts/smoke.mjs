// Boot smoke test: starts the real app on a throwaway profile and checks that the window actually renders and that
// nothing threw while starting. Unit tests can't catch "the page is blank because a module crashed at startup" —
// this does.   npm run smoke   (macOS; needs a built bundle: it builds one without launching your installed copy)
//
// Options: --seed=<file.json>   copy a settings.json into the throwaway profile first
//          --history=<file.json> copy a history.json into the throwaway profile first
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, copyFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { root, APP_NAME } from "./lib/bundle.mjs";

const arg = k => (process.argv.find(a => a.startsWith(`--${k}=`)) || "").split("=").slice(1).join("=");
execFileSync("node", [path.join(root, "scripts/dev-app.mjs"), "--no-launch"], { stdio: "ignore" });
const profile = mkdtempSync(path.join(os.tmpdir(), "backright-smoke-"));
const settings = arg("seed"), history = arg("history");
writeFileSync(path.join(profile, "settings.json"), JSON.stringify({ onboarded: true, baselines: { sit: { neck: 0.7, size: 0.42, tilt: 0, v: 2 }, stand: null }, setupDone: { sit: true, stand: false } }));
if (settings) copyFileSync(settings, path.join(profile, "settings.json"));
if (history) copyFileSync(history, path.join(profile, "history.json"));
const PORT = 9360, logs = [];
const child = spawn(path.join(root, `build/${APP_NAME}.app/Contents/MacOS/Electron`), [`--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`], { stdio: "ignore" });
const cleanup = () => { child.kill(); rmSync(profile, { recursive: true, force: true }); };
process.on("exit", cleanup);
const sleep = ms => new Promise(r => setTimeout(r, ms));

let target;
for (let i = 0; i < 60 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.url.endsWith("index.html")); } catch {} if (!target) await sleep(500); }
if (!target) { console.error("FAIL: the app window never appeared"); process.exit(1); }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => (ws.onopen = r));
ws.addEventListener("message", e => { const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") logs.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split("\n")[0]);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") logs.push("console.error: " + m.params.args.map(a => a.value ?? a.description).join(" ").slice(0, 200)); });
let id = 0; const call = (method, params = {}) => new Promise(res => { const i = ++id; const h = e => { const m = JSON.parse(e.data); if (m.id === i) { ws.removeEventListener("message", h); res(m); } }; ws.addEventListener("message", h); ws.send(JSON.stringify({ id: i, method, params })); });
await call("Runtime.enable"); await call("Page.reload", { ignoreCache: true }); await sleep(2500);   // reload so startup errors are captured from the beginning
const ev = async x => (await call("Runtime.evaluate", { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value;

const checks = {
  "page title is BackRight": (await ev("document.title")) === APP_NAME,
  "status card rendered": !!(await ev('document.getElementById("statusText")?.textContent')),
  "Move card rendered": ((await ev('document.querySelector("#moveCard h2")?.textContent')) || "") === "Move",
  "no startup errors": logs.length === 0,
};
for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "✓" : "✗"} ${name}`);
if (logs.length) console.log(logs.map(l => "  " + l).join("\n"));
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
