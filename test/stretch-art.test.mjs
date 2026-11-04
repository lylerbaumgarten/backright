import test from "node:test";
import assert from "node:assert/strict";
import { STRETCHES } from "../src/renderer/stretches.js";
import { stretchArt, ART_IDS } from "../src/renderer/stretch-art.js";

test("every stretch has an illustration, and every illustration belongs to a stretch", () => {
  for (const s of STRETCHES) assert.ok(stretchArt(s.id), `${s.id} has no illustration`);
  const known = new Set(STRETCHES.map(s => s.id));
  for (const id of ART_IDS) assert.ok(known.has(id), `illustration '${id}' has no stretch`);
  assert.equal(stretchArt("nope"), "");
});

test("illustrations are well-formed, self-contained SVG", () => {
  for (const s of STRETCHES) {
    const svg = stretchArt(s.id);
    assert.match(svg, /^<svg viewBox="\d+ \d+ \d+ \d+"/, s.id);
    assert.ok(svg.endsWith("</svg>"), s.id);
    assert.ok(!/NaN|undefined|null|Infinity/.test(svg), `${s.id} has a bad number in it`);
    assert.ok(!/<defs|\bid=|url\(#|<image|href=|<script|<foreignObject/i.test(svg), `${s.id} must not use ids/defs/images/links (hidden SVGs would break each other, and nothing may load from outside)`);
    assert.equal((svg.match(/<g[ >]/g) || []).length, (svg.match(/<\/g>/g) || []).length, `${s.id} has unbalanced <g>`);
    assert.ok(svg.length > 1500 && svg.length < 20000, `${s.id} size looks wrong (${svg.length})`);
  }
});

test("illustration labels are short enough to fit", () => {
  for (const s of STRETCHES) for (const m of stretchArt(s.id).matchAll(/<text[^>]*>([^<]*)<\/text>/g)) assert.ok(m[1].length <= 36, `${s.id}: "${m[1]}" is too long for a label`);
});
