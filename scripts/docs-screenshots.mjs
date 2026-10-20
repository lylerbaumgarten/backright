// Regenerates the README screenshots in docs/screenshots/ from the real app. macOS only.
//
//   npm run docs:screenshots
//
// Builds the app bundle (without launching your installed copy), starts a throwaway copy on a blank profile
// (so your own settings are untouched), walks through the screens and saves 2× (retina) PNGs. It never turns the camera
// on, so nothing of you or your room can end up in a screenshot, and it never invents posture readings: states
// that need a live camera (the Monitor tab "Good posture" readout, the camera preview) are not captured here.
//
// Two figures are illustrations rather than captures, because a real screen capture needs OS permissions:
// the status-icon strip (the real icon files, composed on a page) and the nudge (the real overlay CSS over a
// mock desktop). They are labelled as illustrations in the README.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs/screenshots");
const binary = path.join(root, "build/BackRight.app/Contents/MacOS/Electron");
const PORT = 9341, DPR = 2, VIEW_W = 760, VIEW_H = 820;   // fixed viewport + pixel density → identical output on any display
mkdirSync(outDir, { recursive: true });

execFileSync("node", [path.join(root, "scripts/dev-app.mjs"), "--no-launch"], { stdio: "inherit" });

const profile = mkdtempSync(path.join(os.tmpdir(), "posture-docs-"));
const child = spawn(binary, [`--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`], { stdio: "ignore" });
const cleanup = () => { child.kill(); rmSync(profile, { recursive: true, force: true }); for (const f of tempPages) rmSync(f, { force: true }); };
process.on("exit", cleanup);
const tempPages = [];

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function targets() { try { return await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { return []; } }
let panelTarget;
for (let i = 0; i < 60 && !panelTarget; i++) { panelTarget = (await targets()).find(t => t.url.endsWith("index.html")); if (!panelTarget) await sleep(500); }
if (!panelTarget) throw new Error("app did not start");

const ws = new WebSocket(panelTarget.webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let nextId = 0;
const call = (method, params = {}) => new Promise(res => { const id = ++nextId; const h = e => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener("message", h); res(m); } }; ws.addEventListener("message", h); ws.send(JSON.stringify({ id, method, params })); });
const ev = async expr => (await call("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const click = async sel => { const r = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return "missing"; e.click(); return "ok"})()`); if (r !== "ok") throw new Error(`no element ${sel}`); await sleep(350); };
const reload = async () => { await call("Page.reload", { ignoreCache: true }); await sleep(1500); };

async function shot(name, { maxHeight = 2400, selector = null, until = null } = {}) {
  // crop to the content (the fixed-height viewport would otherwise leave a blank strip under short screens)
  const bottom = await ev(`Math.ceil(document.querySelector(${JSON.stringify(until || "main")}).getBoundingClientRect().bottom + scrollY + ${until ? 24 : 28})`);
  let clip = { x: 0, y: 0, width: VIEW_W, height: Math.min(bottom, maxHeight) };
  if (selector) {   // crop to one element (with a little breathing room)
    const r = await ev(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return JSON.stringify({x:b.left+scrollX,y:b.top+scrollY,w:b.width,h:b.height})})()`);
    const b = JSON.parse(r); clip = { x: Math.max(0, b.x - 16), y: Math.max(0, b.y - 16), width: b.w + 32, height: b.h + 32 };
  }
  const res = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { ...clip, scale: 1 } });
  const file = path.join(outDir, `${name}.png`);
  writeFileSync(file, Buffer.from(res.result.data, "base64"));
  console.log("saved", path.relative(root, file));
}
await call("Emulation.setDeviceMetricsOverride", { width: VIEW_W, height: VIEW_H, deviceScaleFactor: DPR, mobile: false });
await sleep(800);
const setSettings = patch => ev(`window.posture.setSettings(${JSON.stringify(patch)})`);

// ---------- 1. first-run walkthrough (blank profile → onboarding appears) ----------
await shot("01-welcome");
await click("[data-act=next]");           await shot("02-camera-privacy");
await click("[data-act=privacyNext]");    await shot("03-calibrate");
await click("[data-act=openGuide]");      await shot("04-guide-overview");
await click(".guide-nav button[data-sub='0']"); await shot("05-guide-chair-feet");
await click(".guide-nav button[data-sub='2']"); await shot("06-guide-arms");
await click(".guide-nav button[data-sub='3']"); await shot("07-guide-screen");
await click(".guide-nav button[data-sub='4']"); await shot("08-guide-check");

// ---------- 2. standing guide ----------
await setSettings({ mode: "stand" }); await reload();
await click("[data-act=next]"); await click("[data-act=privacyNext]"); await click("[data-act=openGuide]");
await click(".guide-nav button[data-sub='3']"); await shot("09-guide-standing-spine");

// ---------- 3. the everyday app: calibrated, onboarding finished ----------
await setSettings({ mode: "sit", onboarded: true, baselines: { sit: { neck: 0.7, size: 0.42, tilt: 0, v: 2 }, stand: null }, setupDone: { sit: true, stand: false } });
await reload();
await shot("10-monitor", { maxHeight: 1500 });
await click("#tabs button[data-tab=setup]"); await shot("11-desk-setup-tab", { until: "#steps .gcard:nth-child(2)" });   // heading, overview, first step — then a clean cut
await click("#tabs button[data-tab=privacy]"); await shot("12-privacy-tab", { maxHeight: 900 });

// ---------- 4. illustrations composed from the real assets ----------
const b64 = f => readFileSync(path.join(root, "assets", f)).toString("base64");
const css = (file, re) => (readFileSync(path.join(root, "src/renderer", file), "utf8").match(re) || [])[1] || "";
const glowShadow = css("overlay.html", /box-shadow:\s*([^;]+);/), pillCss = css("pill.html", /#pill \{([^}]*)\}/);

async function composite(name, html, { width, height }) {
  // the app serves pages from inside its own bundle, so the temporary page has to live there (not in src/)
  const page = path.join(root, `build/BackRight.app/Contents/Resources/app/src/renderer/_docs-${name}.html`);
  writeFileSync(page, html); tempPages.push(page);
  await call("Page.navigate", { url: `app://local/_docs-${name}.html` }); await sleep(1200);
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: DPR, mobile: false });
  const res = await call("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(res.result.data, "base64"));
  await call("Emulation.setDeviceMetricsOverride", { width: VIEW_W, height: VIEW_H, deviceScaleFactor: DPR, mobile: false });
  console.log("saved", `docs/screenshots/${name}.png`);
}

const stateCell = (menuIcon, dockIcon, label, sub) => `<div class="cell">
  <div class="bar light"><img class="m" src="data:image/png;base64,${b64(menuIcon)}"></div>
  <div class="bar dark"><img class="m${menuIcon.includes("Template") ? " tpl" : ""}" src="data:image/png;base64,${b64(menuIcon)}"></div>
  <img class="d" src="data:image/png;base64,${b64(dockIcon)}"><b>${label}</b><span>${sub}</span></div>`;
await composite("13-status-icons", `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;width:880px;height:330px;background:#f6f5f2;font:15px system-ui,sans-serif;color:#1f2421;display:flex;align-items:center;justify-content:center}
  .row{display:flex;gap:28px}.cell{width:190px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
  .bar{width:120px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center}
  .bar.light{background:#e9e9ec}.bar.dark{background:#2b2b30}
  .bar.dark img.tpl{filter:invert(1)}   /* macOS tints black-and-white template icons for dark menu bars */
  img.m{width:22px;height:22px}img.d{width:84px;height:84px;margin-top:6px}b{font-size:16px}span{font-size:13px;color:#6b726d}
</style><div class="row">
${stateCell("trayActive@2x.png", "dock-active.png", "Monitoring", "Posture is fine")}
${stateCell("trayWarn@2x.png", "dock-warn.png", "Nudging", "You're slipping")}
${stateCell("traySnoozeTemplate@2x.png", "dock-snooze.png", "Snoozed", "Nudges paused")}
${stateCell("trayOffTemplate@2x.png", "dock-off.png", "Off", "Paused / not calibrated")}
</div>`, { width: 880, height: 330 });

await composite("14-nudge-illustration", `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0}body{width:1100px;height:660px;position:relative;overflow:hidden;font:14px system-ui,sans-serif;
    background:linear-gradient(135deg,#d9e4ee,#eef2f6 55%,#e7e1f0)}
  .win{position:absolute;left:150px;top:120px;width:560px;height:360px;background:#fff;border-radius:12px;box-shadow:0 18px 50px #0003}
  .win i,.win2 i{position:absolute;left:14px;top:14px;width:11px;height:11px;border-radius:50%;background:#ff5f57;box-shadow:18px 0 #febc2e,36px 0 #28c840}
  .win u,.win2 u{position:absolute;left:28px;height:12px;border-radius:6px;background:#e6e9ee}
  .win2{position:absolute;left:560px;top:260px;width:380px;height:250px;background:#fff;border-radius:12px;box-shadow:0 14px 40px #0003}
  #glow{position:absolute;inset:0;pointer-events:none;box-shadow:${glowShadow}}
  #pill{${pillCss.replace(/transform:[^;]+;/, "").replace(/opacity:[^;]+;/, "").replace(/transition:[^;]+;/, "")}
    position:absolute;top:18px;left:50%;margin-left:-240px;width:480px;height:46px;display:flex;align-items:center;gap:10px;box-sizing:border-box;padding:0 8px 0 18px}
  #pill .msg{flex:1;white-space:nowrap;font-weight:600}#pill button{font:inherit;font-size:13px;font-weight:600;border:0;border-radius:999px;padding:8px 14px;background:rgba(26,18,0,.12)}
  #pill button.primary{background:#1a1200;color:#fbe9cc}
  .tag{position:absolute;right:16px;bottom:12px;font-size:12px;color:#6b726d}
</style>
<div class="win"><i></i><u style="top:56px;width:300px"></u><u style="top:84px;width:420px"></u><u style="top:112px;width:360px"></u><u style="top:160px;width:440px"></u><u style="top:188px;width:280px"></u><u style="top:216px;width:400px"></u></div>
<div class="win2"><i></i><u style="top:56px;width:240px"></u><u style="top:84px;width:300px"></u><u style="top:112px;width:200px"></u></div>
<div id="glow"></div>
<div id="pill"><span class="msg">Sit tall — head back, shoulders down</span><button>Pause</button><button class="primary">Settings</button></div>
<div class="tag">Illustration: the app's real overlay styling over a mock desktop</div>`, { width: 1100, height: 660 });

ws.close();
cleanup();
process.exit(0);
