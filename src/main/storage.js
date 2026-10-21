// Every byte BackRight writes to disk goes through this file — that's deliberate, so the privacy promise
// ("nothing but preferences and posture numbers is ever saved, never an image") can be checked in one place
// (test/privacy.test.mjs enforces it).
//
//   settings.json   preferences + calibration numbers
//   history.json    daily posture totals: seconds monitored / slipping, counts — numbers only
//   (export)        a CSV of those same daily totals, written only where the user picks in a save dialog
const fs = require("node:fs");
const path = require("node:path");

const MAX_HISTORY_BYTES = 2 * 1024 * 1024;   // a year of daily rows is ~100 KB; this is a sanity ceiling, not a target

/** Write via a temp file + rename so a crash or power cut can never leave a half-written file behind. */
function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }   // missing or corrupt → caller falls back
}
const isPlainObject = v => v !== null && typeof v === "object" && !Array.isArray(v);

function createStorage(dir) {
  const file = name => path.join(dir, name);
  return {
    loadSettings(defaults) {
      const saved = readJson(file("settings.json"));
      return { ...defaults, ...(isPlainObject(saved) ? saved : {}) };
    },
    saveSettings(settings) { writeAtomic(file("settings.json"), JSON.stringify(settings, null, 2)); },

    /** The renderer owns the shape (see src/renderer/history.js); here it's just a JSON object. null if none/corrupt. */
    loadHistory() { const h = readJson(file("history.json")); return isPlainObject(h) ? h : null; },
    saveHistory(data) {
      if (!isPlainObject(data)) throw new Error("history must be an object");
      const text = JSON.stringify(data);
      if (text.length > MAX_HISTORY_BYTES) throw new Error("history too large");
      writeAtomic(file("history.json"), text);
    },
    clearHistory() { fs.rmSync(file("history.json"), { force: true }); },

    /** Only ever called with a path the user chose in a save dialog. */
    exportTo(chosenPath, text) { fs.writeFileSync(chosenPath, String(text)); },
  };
}

module.exports = { createStorage, MAX_HISTORY_BYTES };
