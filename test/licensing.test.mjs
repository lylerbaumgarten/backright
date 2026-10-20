import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));

test("repo is MIT-licensed and says so everywhere", () => {
  assert.equal(pkg.license, "MIT");
  assert.match(read("LICENSE"), /^MIT License/);
  assert.match(read("LICENSE"), /Copyright \(c\) 2026 Lyle Baumgarten/);
});

test("every bundled third-party component is credited, with the Apache text shipped", () => {
  const notices = read("THIRD_PARTY_NOTICES.md");
  for (const name of ["Electron", "MediaPipe Tasks Vision", "Pose Landmarker model", "Apache License 2.0"]) assert.match(notices, new RegExp(name));
  assert.match(read("LICENSES/Apache-2.0.txt"), /Apache License\s+Version 2\.0, January 2004/);
});

test("package.json declares no unexpected runtime dependencies (the app bundles none)", () => {
  assert.equal(pkg.dependencies, undefined);
});
