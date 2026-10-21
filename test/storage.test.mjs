import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const { createStorage, MAX_HISTORY_BYTES } = createRequire(import.meta.url)("../src/main/storage.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "backright-storage-"));

test("settings: defaults when nothing saved, saved values win, new defaults still appear", () => {
  const dir = tmp(), s = createStorage(dir);
  assert.deepEqual(s.loadSettings({ a: 1, b: 2 }), { a: 1, b: 2 });
  s.saveSettings({ a: 9 });
  assert.deepEqual(s.loadSettings({ a: 1, b: 2 }), { a: 9, b: 2 });
});

test("settings: a corrupt file falls back to defaults instead of crashing", () => {
  const dir = tmp(); fs.writeFileSync(path.join(dir, "settings.json"), "{ not json");
  assert.deepEqual(createStorage(dir).loadSettings({ a: 1 }), { a: 1 });
  fs.writeFileSync(path.join(dir, "settings.json"), "[1,2,3]");           // valid JSON, wrong shape
  assert.deepEqual(createStorage(dir).loadSettings({ a: 1 }), { a: 1 });
});

test("writes are atomic: no temp files are left behind", () => {
  const dir = tmp(), s = createStorage(dir);
  s.saveSettings({ a: 1 }); s.saveHistory({ days: {} });
  assert.deepEqual(fs.readdirSync(dir).sort(), ["history.json", "settings.json"]);
});

test("history: round-trips, rejects non-objects and oversize data, and can be cleared", () => {
  const dir = tmp(), s = createStorage(dir);
  assert.equal(s.loadHistory(), null);
  s.saveHistory({ version: 1, days: { "2026-10-21|sit": { monitoredSec: 60 } } });
  assert.equal(s.loadHistory().days["2026-10-21|sit"].monitoredSec, 60);
  assert.throws(() => s.saveHistory([1]), /object/);
  assert.throws(() => s.saveHistory({ blob: "x".repeat(MAX_HISTORY_BYTES) }), /too large/);
  assert.equal(s.loadHistory().version, 1, "a rejected write must not damage the existing file");
  s.clearHistory(); assert.equal(s.loadHistory(), null);
  assert.doesNotThrow(() => s.clearHistory(), "clearing twice is fine");
});

test("corrupt history reads as 'no history'", () => {
  const dir = tmp(); fs.writeFileSync(path.join(dir, "history.json"), "garbage");
  assert.equal(createStorage(dir).loadHistory(), null);
});

test("export writes exactly the text it is given to the chosen path", () => {
  const dir = tmp(), out = path.join(dir, "mine.csv");
  createStorage(dir).exportTo(out, "date,mode\n2026-10-21,sit\n");
  assert.equal(fs.readFileSync(out, "utf8"), "date,mode\n2026-10-21,sit\n");
});
