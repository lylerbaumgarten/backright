const { app, BrowserWindow, Tray, Menu, screen, ipcMain, session, protocol, powerMonitor, nativeImage, systemPreferences, shell } = require("electron");
const path = require("node:path");
const { BASELINE_VERSION, trayState, trayText, ICON, DOCK } = require("./tray-state");
const fs = require("node:fs");
const { createStorage } = require("./storage");

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
  moveWhere: null,             // "desk" | "stand" — where you want movement suggestions; null = follow the sit/stand mode
  breaks: { enabled: true, intervalMin: 30 },   // "time to move" reminders, counted in minutes spent at the desk
};

let settings = { ...DEFAULTS };
let panel, tray;
const overlays = new Map(); // displayId -> { sig, strips: BrowserWindow[], pill: BrowserWindow }

// ---- settings: numbers and toggles only. Never any image data. (All disk access: see storage.js.) ----
let storage;
function loadSettings() { settings = storage.loadSettings(DEFAULTS); }
function saveSettings() { try { storage.saveSettings(settings); } catch (e) { console.error("settings save failed", e); } }

// ---- privacy: block every request that isn't our own app:// content ----
let blockedRequests = 0;   // outside connections the app tried to make (all blocked) — shown in the onboarding privacy step
function lockDownNetwork(ses) {
  ses.webRequest.onBeforeRequest((details, cb) => {
    const ok = details.url.startsWith("app://") || details.url.startsWith("devtools://") || details.url.startsWith("blob:") || details.url.startsWith("data:");
    if (!ok) { blockedRequests++; console.warn("[privacy] blocked network request:", details.url); }
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
    { x, y, width: w, height: T, ox: 0, oy: 0, pill: 0 },                              // top
    { x, y: y + h - T, width: w, height: T, ox: 0, oy: h - T, pill: 0 },               // bottom
    { x, y: y + T, width: T, height: h - 2 * T, ox: 0, oy: T, pill: 0 },               // left
    { x: x + w - T, y: y + T, width: T, height: h - 2 * T, ox: w - T, oy: T, pill: 0 },// right
  ].map(r => ({ ...r, sw: w, sh: h }));
}

/**
 * What's on screen. Two independent groups of windows per display:
 *   strips — the soft glow, only while a posture nudge is active;
 *   pill   — a small bar with buttons, for a posture nudge OR a "time to move" reminder (posture wins if both).
 */
let warning = false, breakReminder = false;
const visible = { strips: false, pill: false };
const hideTimers = {};
const pillKind = () => (warning ? "posture" : breakReminder ? "break" : null);

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
  win.webContents.once("did-finish-load", () => { pushOverlayState(win); if (visible.strips) win.showInactive(); });
  return win;
}

// The pill is its own small window so it can have buttons (the glow strips stay click-through).
// focusable:false → clicking it never steals focus from whatever you're working in.
const PILL_W = 500, PILL_H = 48;
function overlayPill(b) {
  const win = new BrowserWindow({
    x: Math.round(b.x + (b.width - PILL_W) / 2), y: b.y + 12, width: PILL_W, height: PILL_H, transparent: true, frame: false, hasShadow: false,
    resizable: false, movable: false, focusable: false, skipTaskbar: true, show: false, alwaysOnTop: true, fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setContentProtection(true);
  win.loadURL("app://local/pill.html");
  win.webContents.once("did-finish-load", () => { pushOverlayState(win); if (visible.pill) win.showInactive(); });
  return win;
}

const live = w => !w.isDestroyed();
const stripWins = () => [...overlays.values()].flatMap(o => o.strips).filter(live);
const pillWins = () => [...overlays.values()].map(o => o.pill).filter(live);
const allOverlayWins = () => [...stripWins(), ...pillWins()];

function syncOverlays() {
  const displays = screen.getAllDisplays(), liveIds = new Set(displays.map(d => d.id));
  const destroy = o => [...o.strips, o.pill].forEach(w => live(w) && w.destroy());
  for (const [id, o] of overlays) if (!liveIds.has(id)) { destroy(o); overlays.delete(id); }
  for (const d of displays) {
    const sig = JSON.stringify(d.bounds), existing = overlays.get(d.id);
    if (existing?.sig === sig) continue;
    if (existing) destroy(existing);
    overlays.set(d.id, { sig, strips: stripsFor(d.bounds).map(overlayStrip), pill: overlayPill(d.bounds) });
  }
  // setVisibleOnAllWorkspaces(…, { visibleOnFullScreen: true }) quietly turns a macOS app into a menu-bar-only
  // "accessory" and removes its Dock icon. We want the Dock icon (it's how you reopen a closed window), so restore it.
  if (process.platform === "darwin") Promise.resolve(app.dock?.show()).then(updateTray);   // show() can reset the Dock icon; re-apply the status one
}

function pushOverlayState(win) {
  if (!win.isDestroyed()) win.webContents.send("overlay:state", { warning, kind: pillKind(), glow: settings.glow, pill: settings.pill });
}
const pushAllOverlays = () => allOverlayWins().forEach(pushOverlayState);

/** Show/hide each group to match the state. Turning on: show, then (a beat later) tell the page so the fade plays. Turning off: fade, then hide. */
function refreshOverlays() {
  const want = { strips: warning, pill: warning || breakReminder }, groups = { strips: stripWins, pill: pillWins };
  for (const key of ["strips", "pill"]) {
    if (want[key] && !visible[key]) {
      clearTimeout(hideTimers[key]); visible[key] = true;
      groups[key]().forEach(w => w.showInactive());
      setTimeout(pushAllOverlays, 30);                   // let the window paint its hidden state first so the fade plays
    } else if (!want[key] && visible[key]) {
      visible[key] = false;
      pushAllOverlays();                                 // fade out…
      hideTimers[key] = setTimeout(() => { if (!visible[key]) groups[key]().forEach(w => w.hide()); }, 2200);   // …then hide
    } else pushAllOverlays();                            // same windows, maybe a different message
  }
}

// Overlay windows are only on screen while there is something to show.
let snoozeUntil = 0, snoozeTimer = null;
const snoozed = () => Date.now() < snoozeUntil;
function setWarning(on) {
  if (on && snoozed()) on = false;
  if (warning === on) return;
  warning = on;
  updateTray();
  refreshOverlays();
}
/** A "time to move" reminder. Refused (false) while nudges/reminders are snoozed or breaks are switched off. */
function setBreak(on) {
  if (on && (snoozed() || !settings.breaks?.enabled)) return false;
  if (breakReminder !== on) { breakReminder = on; refreshOverlays(); }
  return true;
}

function snooze(minutes) {
  clearTimeout(snoozeTimer);
  snoozeUntil = minutes ? Date.now() + minutes * 60000 : 0;
  setWarning(false); setBreak(false);
  if (minutes) snoozeTimer = setTimeout(() => { snoozeUntil = 0; rebuildTray(); }, minutes * 60000);
  rebuildTray();
}

// ---- panel (control window; also hosts detection, so it must keep running when hidden) ----
function createPanel() {
  panel = new BrowserWindow({
    width: 760, height: 820, show: false, title: "BackRight", backgroundColor: "#f6f5f2",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, backgroundThrottling: false,
                      additionalArguments: process.env.BACKRIGHT_DEBUG ? ["--backright-debug"] : [] },
  });
  // BACKRIGHT_DEBUG=1: print the window's console messages (model load time, GPU/CPU delegate, errors) to the terminal.
  if (process.env.BACKRIGHT_DEBUG) panel.webContents.on("console-message", (e, ...old) => console.log("[renderer]", e.message ?? old[1]));
  panel.loadURL("app://local/index.html");
  panel.once("ready-to-show", () => panel.show());
  panel.on("close", e => { if (!app.isQuitting) { e.preventDefault(); panel.hide(); } });
}
const showPanel = () => {
  if (!panel || panel.isDestroyed()) { createPanel(); return; }   // closed for real (or crashed) → rebuild; it shows itself when ready
  if (panel.isMinimized()) panel.restore();
  panel.show(); panel.focus();
  if (process.platform === "darwin") app.focus({ steal: true });   // we're a menu-bar app; make sure it comes to the front
};
/** Bring the window forward and then tell it to do something (waits for a rebuilt window to finish loading). */
function openPanelAnd(channel) {
  const rebuilt = !panel || panel.isDestroyed();
  showPanel();
  if (rebuilt) panel.webContents.once("did-finish-load", () => setTimeout(() => sendToPanel(channel), 800));
  else sendToPanel(channel);
}
const openSettings = () => openPanelAnd("cmd:show-settings");
function pauseMonitoring() {
  settings.monitoring = false; saveSettings(); rebuildTray();
  setWarning(false); setBreak(false);
  sendToPanel("settings:changed", settings);   // the panel stops the camera and updates its buttons
}

// ---- tray ----
const trayImages = {};
function trayImage(name) {
  // black-and-transparent "template" glyphs (…Template.png + @2x): macOS tints them for light/dark menu bars.
  // trayWarn is amber and deliberately NOT a template, so it keeps its colour.
  return trayImages[name] ??= (() => {
    const img = nativeImage.createFromPath(path.join(ROOT, `assets/${name}.png`));
    img.setTemplateImage(name.endsWith("Template"));
    return img;
  })();
}

const dockImages = {};
const dockImage = name => dockImages[name] ??= nativeImage.createFromPath(path.join(ROOT, `assets/${name}.png`));

let idle = false;   // screen locked / asleep
const isCalibrated = () => settings.baselines?.[settings.mode]?.v === BASELINE_VERSION;
const snoozeLabel = () => new Date(snoozeUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function currentTray() {
  const snoozed = snoozeUntil > Date.now();
  const state = trayState({ warning, monitoring: settings.monitoring, calibrated: isCalibrated(), idle, snoozed });
  return { state, ...trayText(state, { monitoring: settings.monitoring, calibrated: isCalibrated(), idle, snoozeUntilLabel: snoozed ? snoozeLabel() : "" }) };
}
/** Icon + tooltip follow the app's state; cheap enough to call on every change. */
function updateTray() {
  if (!tray) return;
  const { state, tip } = currentTray();
  const __img = trayImage(ICON[state]);
  if (process.env.BACKRIGHT_DEBUG) console.log(`[tray] ${state} — ${tip} | image ${ICON[state]} empty=${__img.isEmpty()} size=${JSON.stringify(__img.getSize())} template=${__img.isTemplateImage()}`);
  tray.setImage(__img);
  tray.setToolTip(tip);
  // Dock icon = app icon + status dot (green monitoring · amber nudging · grey snoozed · none off).
  if (process.platform === "darwin") {
    const dock = dockImage(DOCK[state]);
    if (process.env.BACKRIGHT_DEBUG) console.log(`[dock] ${DOCK[state]} empty=${dock.isEmpty()} size=${JSON.stringify(dock.getSize())}`);
    app.dock?.setIcon(dock);
  }
}

function rebuildTray() {
  if (!tray) return;
  updateTray();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: currentTray().label, enabled: false },
    { label: settings.monitoring ? "Pause monitoring" : "Start monitoring", click: () => sendToPanel("cmd:toggle-monitoring") },
    { type: "separator" },
    snoozeUntil > Date.now()
      ? { label: `Resume nudges (snoozed until ${snoozeLabel()})`, click: () => snooze(0) }
      : { label: "Snooze nudges & reminders", submenu: [5, 30, 60].map(m => ({ label: m === 60 ? "1 hour" : `${m} minutes`, click: () => snooze(m) })) },
    { type: "separator" },
    { label: "Take a movement break…", click: () => openPanelAnd("cmd:start-break") },
    { type: "separator" },
    { label: "Sitting", type: "radio", checked: settings.mode === "sit", click: () => setMode("sit") },
    { label: "Standing", type: "radio", checked: settings.mode === "stand", click: () => setMode("stand") },
    { type: "separator" },
    { label: "Open BackRight…", click: showPanel },
    { label: "Quit", click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

function setMode(mode) { settings.mode = mode; saveSettings(); rebuildTray(); sendToPanel("settings:changed", settings); }
function sendToPanel(ch, payload) { if (panel && !panel.isDestroyed()) panel.webContents.send(ch, payload); }

// ---- IPC ----
ipcMain.handle("settings:get", () => settings);
ipcMain.handle("settings:set", (_e, patch) => {
  if (process.env.BACKRIGHT_DEBUG) console.log(`[settings:set] ${Date.now() % 100000} ${JSON.stringify(patch).slice(0, 120)}`);
  settings = { ...settings, ...patch };
  saveSettings(); rebuildTray(); pushAllOverlays();
  return settings;
});
ipcMain.handle("privacy:stats", () => ({ blocked: blockedRequests }));
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
ipcMain.on("pill:action", (_e, action) => {
  if (action === "pause") pauseMonitoring();
  else if (action === "settings") openSettings();
  else if (action === "break-show") { setBreak(false); openPanelAnd("cmd:break-show"); }                      // open the window and start a routine
  else if (action === "break-snooze" || action === "break-skip") { setBreak(false); sendToPanel("cmd:break-" + action.slice(6)); }
});
ipcMain.handle("break:show", () => setBreak(true));
if (process.env.BACKRIGHT_DEBUG) ipcMain.handle("debug:overlays", () => ({ strips: stripWins().map(w => w.isVisible()), pill: pillWins().map(w => w.isVisible()), state: { warning, breakReminder, ...visible } }));
ipcMain.on("break:hide", () => setBreak(false));
ipcMain.on("overlay:preview", () => { setWarning(true); setTimeout(() => setWarning(false), 3500); });

// ---- lifecycle ----
app.whenReady().then(() => {
  storage = createStorage(app.getPath("userData"));
  loadSettings();
  registerAppProtocol();
  lockDownNetwork(session.defaultSession);
  // Normal Dock presence (so there is always an icon to click to reopen the window); the tray icon complements it.

  tray = new Tray(trayImage(ICON.off));
  tray.on("click", showPanel);
  rebuildTray();

  createPanel();
  syncOverlays();
  for (const ev of ["display-added", "display-removed", "display-metrics-changed"]) screen.on(ev, syncOverlays);

  // No point watching an empty chair: stop sampling while the screen is locked / asleep.
  const setIdle = v => { idle = v; if (v) setBreak(false); updateTray(); rebuildTray(); sendToPanel("system:idle", v); };
  powerMonitor.on("lock-screen", () => setIdle(true));
  powerMonitor.on("suspend", () => setIdle(true));
  powerMonitor.on("unlock-screen", () => setIdle(false));
  powerMonitor.on("resume", () => setIdle(false));
});

app.on("before-quit", () => { app.isQuitting = true; });
app.on("window-all-closed", e => e.preventDefault()); // keep running in the tray
app.on("activate", showPanel);
