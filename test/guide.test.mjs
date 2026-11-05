import test from "node:test";
import assert from "node:assert/strict";
import { GUIDE, CHECK_LABELS } from "../src/renderer/guide.js";
import { art } from "../src/renderer/guide-art.js";

test("every guide step has the fields the walkthrough and Desk setup tab render", () => {
  for (const [mode, g] of Object.entries(GUIDE)) {
    assert.ok(g.intro, `${mode} intro`);
    assert.ok(g.steps.length >= 3, `${mode} has steps`);
    for (const s of g.steps) {
      for (const f of ["art", "title", "body", "short"]) assert.ok(s[f], `${mode}/${s.title} missing ${f}`);
      assert.ok(Array.isArray(s.points) && s.points.length >= 2, `${mode}/${s.title} points`);
      for (const c of s.checks || []) assert.ok(CHECK_LABELS[c], `unknown check ${c}`);
    }
  }
});

test("unknown illustration key returns empty string rather than throwing", () => {
  assert.equal(art("sit", "nope"), "");
});
