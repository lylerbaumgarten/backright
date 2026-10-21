const { contextBridge, ipcRenderer } = require("electron");

// The renderer gets a deliberately tiny surface: settings, a warning flag, and a few events.
// There is no channel for sending frames anywhere — only booleans and numbers cross this bridge.
const on = (ch, fn) => { const h = (_e, v) => fn(v); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };

contextBridge.exposeInMainWorld("posture", {
  isDebug: process.argv.includes("--backright-debug"),   // set only when launched with BACKRIGHT_DEBUG=1 (enables test hooks)
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: patch => ipcRenderer.invoke("settings:set", patch),
  privacyStats: () => ipcRenderer.invoke("privacy:stats"),
  requestCamera: () => ipcRenderer.invoke("camera:request"),
  openCameraSettings: () => ipcRenderer.send("camera:open-settings"),
  relaunch: () => ipcRenderer.send("app:relaunch"),
  setWarning: onOff => ipcRenderer.send("posture:warning", !!onOff),
  previewOverlay: () => ipcRenderer.send("overlay:preview"),
  pillAction: action => ipcRenderer.send("pill:action", action),
  debugOverlays: () => ipcRenderer.invoke("debug:overlays"),   // only answers in debug mode
  getHistory: () => ipcRenderer.invoke("history:get"),
  setHistory: data => ipcRenderer.invoke("history:set", data),
  clearHistory: () => ipcRenderer.invoke("history:clear"),
  exportHistory: csv => ipcRenderer.invoke("history:export", csv),
  onFlush: fn => on("cmd:flush", fn),
  showBreak: () => ipcRenderer.invoke("break:show"),            // true if the reminder pill was shown
  hideBreak: () => ipcRenderer.send("break:hide"),
  onBreakAction: fn => { const offs = ["show", "snooze", "skip"].map(a => on(`cmd:break-${a}`, () => fn(a))); return () => offs.forEach(f => f()); },
  onStartBreak: fn => on("cmd:start-break", fn),
  onShowSettings: fn => on("cmd:show-settings", fn),
  onSettings: fn => on("settings:changed", fn),
  onToggleMonitoring: fn => on("cmd:toggle-monitoring", fn),
  onIdle: fn => on("system:idle", fn),
  onOverlayState: fn => on("overlay:state", fn),
});
