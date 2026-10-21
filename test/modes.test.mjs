import { test } from "node:test";
import assert from "node:assert/strict";
import { enabledModes, withMode, currentMode } from "../src/renderer/modes.js";

test("no choice yet (or an old settings file) means both modes", () => {
  assert.deepEqual(enabledModes({}), ["sit", "stand"]);
  assert.deepEqual(enabledModes({ modes: null }), ["sit", "stand"]);
  assert.deepEqual(enabledModes(undefined), ["sit", "stand"]);
});
test("a chosen list is respected, ordered and cleaned", () => {
  assert.deepEqual(enabledModes({ modes: ["stand"] }), ["stand"]);
  assert.deepEqual(enabledModes({ modes: ["stand", "sit"] }), ["sit", "stand"]);
  assert.deepEqual(enabledModes({ modes: ["bogus", "sit"] }), ["sit"]);
  assert.deepEqual(enabledModes({ modes: [] }), ["sit", "stand"], "an empty or corrupt list never disables everything");
  assert.deepEqual(enabledModes({ modes: ["nope"] }), ["sit", "stand"]);
});
test("withMode turns a mode on or off but never leaves none", () => {
  assert.deepEqual(withMode(["sit"], "stand", true), ["sit", "stand"]);
  assert.deepEqual(withMode(["sit", "stand"], "sit", false), ["stand"]);
  assert.deepEqual(withMode(["sit"], "sit", false), ["sit"]);
  assert.deepEqual(withMode(["stand"], "stand", true), ["stand"]);
});
test("currentMode falls back to an enabled one", () => {
  assert.equal(currentMode({ mode: "sit", modes: ["sit"] }), "sit");
  assert.equal(currentMode({ mode: "sit", modes: ["stand"] }), "stand");
  assert.equal(currentMode({ mode: "stand" }), "stand");
});
