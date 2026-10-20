// What the menu-bar icon should say about the app. Pure (no Electron) so it's unit-tested.
//   warn    amber icon       you're being nudged right now
//   active  green icon       monitoring, posture fine
//   snooze  outline + dot    monitoring, but nudges are snoozed
//   off     outline icon     paused, not calibrated yet, or screen locked
// The Dock icon follows the same state (see DOCK).

// Keep in sync with BASELINE_VERSION in src/renderer/posture.js (a test enforces it).
const BASELINE_VERSION = 2;

function trayState({ warning, monitoring, calibrated, idle, snoozed }) {
  if (warning) return "warn";
  if (!monitoring || !calibrated || idle) return "off";
  return snoozed ? "snooze" : "active";
}

// Dock icon variants (the app icon with a status dot); the Dock shows these while the app is running.
const DOCK = { warn: "dock-warn", active: "dock-active", snooze: "dock-snooze", off: "dock-off" };
const ICON = { warn: "trayWarn", active: "trayActive", snooze: "traySnoozeTemplate", off: "trayOffTemplate" };

function trayText(state, { monitoring, calibrated, idle, snoozeUntilLabel = "" }) {
  switch (state) {
    case "warn": return { label: "Posture slipping", tip: "Posture — slipping, sit tall" };
    case "active": return { label: "Monitoring", tip: "Posture — monitoring" };
    case "snooze": return { label: `Nudges snoozed until ${snoozeUntilLabel}`, tip: `Posture — nudges snoozed until ${snoozeUntilLabel}` };
    default:
      if (idle && monitoring) return { label: "Paused — screen locked", tip: "Posture — paused while the screen is locked" };
      if (monitoring && !calibrated) return { label: "Calibrate to start", tip: "Posture — calibrate to start" };
      return { label: "Not monitoring", tip: "Posture — not monitoring" };
  }
}

module.exports = { BASELINE_VERSION, trayState, trayText, ICON, DOCK };
