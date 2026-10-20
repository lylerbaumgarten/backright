const { app, BrowserWindow, Tray, Menu, screen, ipcMain, session, protocol, powerMonitor, nativeImage, systemPreferences, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "../..");
const RENDERER = path.join(ROOT, "src/renderer");
const VENDOR = path.join(ROOT, "vendor");

// Everything is served from app:// so ES modules, WASM and the model load without a network
// and without file:// quirks. Nothing else is reachable (see lockDownNetwork).
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

const CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "base-uri 'none'", "form-action 'none'",
].join("; ");

const DEFAULTS = {
  mode: "sit",                 // "sit" | "stand"
  baselines: { sit: null, stand: null },
  setupDone: { sit: false, stand: false },
  onboarded: false,            // first-run walkthrough finished or closed
  setupBannerDismissed: { sit: false, stand: false },
  sensitivity: 1,
  delaySec: 4,
  checkEverySec: 0.5,          // sampling interval — posture moves slowly, so no need for full video rate
  glow: true,
  pill: true,
  monitoring: false,
};

let settings = { ...DEFAULTS };
let panel, tray;
const overlays = new Map(); // displayId -> { sig, wins: BrowserWindow[] } (edge strips)
let warning = false;

// ---- settings: numbers and toggles only. Never any image data. ----
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
function loadSettings() {
  try { settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) }; } catch { settings = { ...DEFAULTS }; }
}
function saveSettings() {
  try { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2)); } catch (e) { console.error("settings save failed", e); }
}

// ---- privacy: block every request that isn't our own app:// content ----
function lockDownNetwork(ses) {
  ses.webRequest.onBeforeRequest((details, cb) => {
    const ok = details.url.startsWith("app://") || details.url.startsWith("devtools://") || details.url.startsWith("blob:") || details.url.startsWith("data:");
    if (!ok) console.warn("[privacy] blocked network request:", details.url);
    cb({ cancel: !ok });
  });
  ses.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [CSP] } });
  });
  // Only the camera, only for our own pages.
  ses.setPermissionRequestHandler((wc, permission, cb, details) => cb(permission === "media" && details.requestingUrl.startsWith("app://") && !(details.mediaTypes || []).includes("audio")));
  ses.setPermissionCheckHandler((wc, permission) => permission === "media");
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".wasm": "application/wasm", ".json": "application/json" };

function registerAppProtocol() {
  protocol.handle("app", req => {
    const url = new URL(req.url);
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const isVendor = rel.startsWith("vendor/");          // same origin (app://local) so modules/wasm load under CSP 'self'
    if (isVendor) rel = rel.slice("vendor/".length);
    const base = isVendor ? VENDOR : RENDERER;
    const file = path.normalize(path.join(base, rel));
    if (!file.startsWith(base + path.sep)) return new Response("forbidden", { status: 403 });
    // Read from disk directly (not net.fetch): all network-layer requests, even file://, go through the block list.
    return fs.promises.readFile(file).then(
      body => new Response(body, { headers: { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" } }),
      () => new Response("not found", { status: 404 }));
  });
}

// ---- overlay ----
// The nudge is drawn with four thin edge strips per display instead of one full-screen window. A full-screen
// window is what macOS's window-capture mode (⇧⌘4 then Space) and screenshot tools pick as "the window under
// the cursor" — and then refuse to capture. With strips, the middle of the screen has no overlay window at all,
// so ordinary windows there stay capturable. (Strips also stay out of screenshots/recordings via content protection.)
const STRIP = 120;   // px; the glow fades out within this
function stripsFor(b) {
  const { x, y, width: w, height: h } = b, T = STRIP;
  return [
    { x, y, width: w, height: T, ox: 0, oy: 0, pill: 1 },                              // top (also carries the pill)
    { x, y: y + h - T, width: w, height: T, ox: 0, oy: h - T, pill: 0 },               // bottom
    { x, y: y + T, width: T, height: h - 2 * T, ox: 0, oy: T, pill: 0 },               // left
    { x: x + w - T, y: y + T, width: T, height: h - 2 * T, ox: w - T, oy: T, pill: 0 },// right
  ].map(r => ({ ...r, sw: w, sh: h }));
}

function overlayStrip(r) {
  const win = new BrowserWindow({
    x: r.x, y: r.y, width: r.width, height: r.height, transparent: true, frame: false, hasShadow: false, resizable: false, movable: false,
    focusable: false, skipTaskbar: true, show: false, alwaysOnTop: true, fullscreenable: false, enableLargerThanScreen: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setContentProtection(true);   // keep it out of screenshots / screen recordings / screen shares (macOS + Windows)
  win.loadURL(`app://local/overlay.html?sw=${r.sw}&sh=${r.sh}&ox=${r.ox}&oy=${r.oy}&pill=${r.pill}`);
  win.webContents.once("did-finish-load", () => { pushOverlayState(win); if (warning) win.showInactive(); });
  return win;
}

const allOverlayWins = () => [...overlays.values()].flatMap(o => o.wins).filter(w => !w.isDestroyed());

function syncOverlays() {
  const displays = screen.getAllDisplays(), live = new Set(displays.map(d => d.id));
  for (const [id, o] of overlays) if (!live.has(id)) { o.wins.forEach(w => !w.isDestroyed() && w.destroy()); overlays.delete(id); }
  for (const d of displays) {
    const sig = JSON.stringify(d.bounds), existing = overlays.get(d.id);
    if (existing?.sig === sig) continue;
    existing?.wins.forEach(w => !w.isDestroyed() && w.destroy());
    overlays.set(d.id, { sig, wins: stripsFor(d.bounds).map(overlayStrip) });
  }
}

function pushOverlayState(win) {
  if (!win.isDestroyed()) win.webContents.send("overlay:state", { warning, glow: settings.glow, pill: settings.pill });
}
const pushAllOverlays = () => allOverlayWins().forEach(pushOverlayState);

// Overlay windows are only on screen while a nudge is showing; the rest of the time they're hidden.
let hideTimer = null, snoozeUntil = 0, snoozeTimer = null;
function setWarning(on) {
  if (on && Date.now() < snoozeUntil) on = false;      // snoozed
  if (warning === on) return;
  warning = on;
  clearTimeout(hideTimer);
  if (on) {
    allOverlayWins().forEach(w => w.showInactive());
    setTimeout(pushAllOverlays, 30);                    // let the window paint hidden-state first so the fade plays
  } else {
    pushAllOverlays();                                  // fade out…
    hideTimer = setTimeout(() => allOverlayWins().forEach(w => { if (!warning) w.hide(); }), 2200);   // …then hide
  }
}

function snooze(minutes) {
  clearTimeout(snoozeTimer);
  snoozeUntil = minutes ? Date.now() + minutes * 60000 : 0;
  setWarning(false);
  if (minutes) snoozeTimer = setTimeout(() => { snoozeUntil = 0; rebuildTray(); }, minutes * 60000);
  rebuildTray();
}

// ---- panel (control window; also hosts detection, so it must keep running when hidden) ----
function createPanel() {
  panel = new BrowserWindow({
    width: 760, height: 820, show: false, title: "Posture", backgroundColor: "#f6f5f2",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  panel.loadURL("app://local/index.html");
  panel.once("ready-to-show", () => panel.show());
  panel.on("close", e => { if (!app.isQuitting) { e.preventDefault(); panel.hide(); } });
}
const showPanel = () => { if (panel) { panel.show(); panel.focus(); } };

// ---- tray ----
function trayIcon() {
  // 16px template glyph drawn in code so there are no image assets to ship yet.
  const size = 16, buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const head = (x - 8) ** 2 + (y - 4) ** 2 <= 9;                 // head
    const body = y >= 9 && Math.abs(x - 8) <= 3 + (y - 9) * 0.4;     // shoulders
    const i = (y * size + x) * 4;
    if (head || body) { buf[i] = buf[i + 1] = buf[i + 2] = 0; buf[i + 3] = 255; }
  }
  const img = nativeImage.createFromBitmap(buf, { width: size, height: size });
  img.setTemplateImage(true);
  return img;
}

function rebuildTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: settings.monitoring ? "Monitoring: on" : "Monitoring: off", enabled: false },
    { label: settings.monitoring ? "Pause monitoring" : "Start monitoring", click: () => sendToPanel("cmd:toggle-monitoring") },
    { type: "separator" },
    snoozeUntil > Date.now()
      ? { label: `Nudges snoozed until ${new Date(snoozeUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} — resume`, click: () => snooze(0) }
      : { label: "Snooze nudges", submenu: [5, 30, 60].map(m => ({ label: m === 60 ? "1 hour" : `${m} minutes`, click: () => snooze(m) })) },
    { type: "separator" },
    { label: "Sitting", type: "radio", checked: settings.mode === "sit", click: () => setMode("sit") },
    { label: "Standing", type: "radio", checked: settings.mode === "stand", click: () => setMode("stand") },
    { type: "separator" },
    { label: "Open Posture…", click: showPanel },
    { label: "Quit", click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

function setMode(mode) { settings.mode = mode; saveSettings(); rebuildTray(); sendToPanel("settings:changed", settings); }
function sendToPanel(ch, payload) { if (panel && !panel.isDestroyed()) panel.webContents.send(ch, payload); }

// ---- IPC ----
ipcMain.handle("settings:get", () => settings);
ipcMain.handle("settings:set", (_e, patch) => {
  settings = { ...settings, ...patch };
  saveSettings(); rebuildTray(); pushAllOverlays();
  return settings;
});
ipcMain.handle("camera:request", async () => {
  if (process.platform !== "darwin") return "granted";
  const status = systemPreferences.getMediaAccessStatus("camera");   // granted | denied | restricted | not-determined
  if (status === "not-determined") return (await systemPreferences.askForMediaAccess("camera")) ? "granted" : "denied";
  return status;
});
ipcMain.on("camera:open-settings", () => {
  // Fixed OS settings deep links only — nothing from the renderer is interpolated.
  shell.openExternal(process.platform === "darwin" ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera" : "ms-settings:privacy-webcam");
});
ipcMain.on("app:relaunch", () => { app.isQuitting = true; app.relaunch(); app.quit(); });
ipcMain.on("posture:warning", (_e, on) => setWarning(!!on));
ipcMain.on("overlay:preview", () => { setWarning(true); setTimeout(() => setWarning(false), 3500); });

// ---- lifecycle ----
app.whenReady().then(() => {
  loadSettings();
  registerAppProtocol();
  lockDownNetwork(session.defaultSession);
  if (process.platform === "darwin") app.dock?.hide();   // menu-bar style app

  tray = new Tray(trayIcon());
  tray.setToolTip("Posture");
  tray.on("click", showPanel);
  rebuildTray();

  createPanel();
  syncOverlays();
  for (const ev of ["display-added", "display-removed", "display-metrics-changed"]) screen.on(ev, syncOverlays);

  // No point watching an empty chair: stop sampling while the screen is locked / asleep.
  powerMonitor.on("lock-screen", () => sendToPanel("system:idle", true));
  powerMonitor.on("suspend", () => sendToPanel("system:idle", true));
  powerMonitor.on("unlock-screen", () => sendToPanel("system:idle", false));
  powerMonitor.on("resume", () => sendToPanel("system:idle", false));
});

app.on("before-quit", () => { app.isQuitting = true; });
app.on("window-all-closed", e => e.preventDefault()); // keep running in the tray
app.on("activate", showPanel);
