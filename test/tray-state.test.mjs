import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { BASELINE_VERSION as RENDERER_VERSION } from "../src/renderer/posture.js";

const { trayState, trayText, ICON, BASELINE_VERSION } = createRequire(import.meta.url)("../src/main/tray-state.js");
const base = { warning: false, monitoring: true, calibrated: true, idle: false, snoozed: false };

test("monitoring + calibrated + nothing wrong → active", () => assert.equal(trayState(base), "active"));
test("being nudged beats everything else → warn", () => {
  assert.equal(trayState({ ...base, warning: true }), "warn");
  assert.equal(trayState({ ...base, warning: true, snoozed: true }), "warn");
});
test("paused → off", () => assert.equal(trayState({ ...base, monitoring: false }), "off"));
test("monitoring on but not calibrated → off (can't actually monitor)", () => assert.equal(trayState({ ...base, calibrated: false }), "off"));
test("screen locked → off", () => assert.equal(trayState({ ...base, idle: true }), "off"));
test("snoozed while monitoring → snooze", () => assert.equal(trayState({ ...base, snoozed: true }), "snooze"));

test("every state has an icon file; only the green and amber icons are non-template (they keep their colour)", () => {
  for (const state of ["warn", "active", "snooze", "off"]) {
    for (const suffix of ["", "@2x"]) assert.ok(fs.existsSync(new URL(`../assets/${ICON[state]}${suffix}.png`, import.meta.url)), `${ICON[state]}${suffix}.png`);
  }
  assert.deepEqual(Object.values(ICON).filter(n => !n.endsWith("Template")).sort(), ["trayActive", "trayWarn"]);
});

test("labels say why it's off", () => {
  assert.match(trayText("off", { ...base, monitoring: false }).label, /Not monitoring/);
  assert.match(trayText("off", { ...base, calibrated: false }).label, /Calibrate/);
  assert.match(trayText("off", { ...base, idle: true }).label, /locked/);
  assert.match(trayText("snooze", { ...base, snoozeUntilLabel: "3:30 PM" }).tip, /3:30 PM/);
});

test("baseline version matches the renderer's, so stale calibrations read as 'not calibrated' in the tray too", () => {
  assert.equal(BASELINE_VERSION, RENDERER_VERSION);
});
