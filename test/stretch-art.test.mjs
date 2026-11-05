import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { STRETCHES } from "../src/renderer/stretches.js";
import { stretchArt, ART_IDS } from "../src/renderer/stretch-art.js";
import { art, GUIDE_ART } from "../src/renderer/guide-art.js";
import { GUIDE } from "../src/renderer/guide.js";

const renderer = new URL("../src/renderer/", import.meta.url);
const isWebp = f => { const b = readFileSync(f); return b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"; };

test("every stretch has an illustration, and every illustration belongs to a stretch", () => {
  for (const s of STRETCHES) assert.ok(stretchArt(s.id), `${s.id} has no illustration`);
  const known = new Set(STRETCHES.map(s => s.id));
  for (const id of ART_IDS) assert.ok(known.has(id), `illustration '${id}' has no stretch`);
  assert.equal(stretchArt("nope"), "");
});

test("stretch and guide illustrations are bundled, valid WebP files of sensible size", () => {
  const files = [...ART_IDS.map(id => stretchArt(id)), ...GUIDE_ART.map(k => `img/guide/${k}.webp`)];
  for (const rel of files) {
    const f = new URL(rel, renderer);
    assert.ok(existsSync(f), `${rel} is missing`);
    assert.ok(isWebp(f), `${rel} is not a WebP file`);
    const kb = statSync(f).size / 1024;
    assert.ok(kb > 3 && kb < 150, `${rel} is ${Math.round(kb)} KB`);
  }
});

test("every desk-guide step has an illustration with alt text, loaded from the app's own files", () => {
  for (const [mode, g] of Object.entries(GUIDE)) for (const s of [g.overview, ...g.steps]) {
    const html = art(mode, s.art);
    assert.match(html, /^<img src="img\/guide\/[a-z-]+\.webp" alt="[^"]{20,}"/, `${mode}/${s.art}`);
    assert.ok(GUIDE_ART.includes(`${mode}-${s.art}`));
    assert.ok(!/https?:/.test(html), "illustrations must not load from the network");
  }
  assert.equal(art("sit", "nope"), "");
});
