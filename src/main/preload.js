const { contextBridge, ipcRenderer } = require("electron");

// The renderer gets a deliberately tiny surface: settings, a warning flag, and a few events.
// There is no channel for sending frames anywhere — only booleans and numbers cross this bridge.
const on = (ch, fn) => { const h = (_e, v) => fn(v); ipcRenderer.on(ch, h); return () => ipcRenderer.removeListener(ch, h); };

contextBridge.exposeInMainWorld("posture", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: patch => ipcRenderer.invoke("settings:set", patch),
  requestCamera: () => ipcRenderer.invoke("camera:request"),
  openCameraSettings: () => ipcRenderer.send("camera:open-settings"),
  relaunch: () => ipcRenderer.send("app:relaunch"),
  setWarning: onOff => ipcRenderer.send("posture:warning", !!onOff),
  previewOverlay: () => ipcRenderer.send("overlay:preview"),
  pillAction: action => ipcRenderer.send("pill:action", action),
  onShowSettings: fn => on("cmd:show-settings", fn),
  onSettings: fn => on("settings:changed", fn),
  onToggleMonitoring: fn => on("cmd:toggle-monitoring", fn),
  onIdle: fn => on("system:idle", fn),
  onOverlayState: fn => on("overlay:state", fn),
});
