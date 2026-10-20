import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const ids = f => [...read(f).matchAll(/com\.lylebaumgarten\.[a-z]+/g)].map(m => m[0]);

test("product name is BackRight everywhere it identifies the app", () => {
  assert.equal(pkg.name, "backright");
  assert.equal(pkg.productName, "BackRight");
  assert.match(read("README.md"), /^# BackRight/);
  assert.match(read("src/renderer/index.html"), /<title>BackRight<\/title>/);
});

test("the app bundle, the reset script and the screenshot script agree on names", () => {
  const build = ids("scripts/lib/bundle.mjs"), reset = ids("scripts/fresh.mjs");
  assert.deepEqual([...new Set(build)], ["com.lylebaumgarten.backright"]);
  assert.deepEqual([...new Set(reset)], ["com.lylebaumgarten.backright"]);
  for (const f of ["scripts/lib/bundle.mjs", "scripts/dev-app.mjs", "scripts/release-mac.mjs", "scripts/fresh.mjs", "scripts/docs-screenshots.mjs", "README.md"]) assert.doesNotMatch(read(f), /Posture\.app/, `${f} still mentions Posture.app`);
  assert.match(read("scripts/fresh.mjs"), /Application Support\/BackRight/);   // Electron names its data folder after productName
});

test("no stale bundle id from the old name", () => {
  for (const f of ["scripts/lib/bundle.mjs", "scripts/dev-app.mjs", "scripts/fresh.mjs", "README.md", "package.json"]) assert.doesNotMatch(read(f), /com\.lylebaumgarten\.posture/);
});
