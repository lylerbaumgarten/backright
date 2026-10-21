import test from "node:test";
import assert from "node:assert/strict";
import { STRETCHES, DISCLAIMER, WHERE, suggest, buildRoutine, totalSeconds, minutesLabel, get } from "../src/renderer/stretches.js";

// A tiny seeded rng so shuffles are repeatable.
const seeded = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

test("every stretch is complete and safe to show", () => {
  const ids = new Set();
  for (const s of STRETCHES) {
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`); ids.add(s.id);
    assert.match(s.id, /^[a-z0-9-]+$/);
    assert.ok(s.name && s.cue && s.target, `${s.id} needs a name, cue and target`);
    assert.ok(s.where.length && s.where.every(w => w in WHERE), `${s.id} has an unknown 'where'`);
    assert.ok(Number.isInteger(s.seconds) && s.seconds >= 15 && s.seconds <= 180, `${s.id} duration`);
    assert.ok(s.steps.length >= 2 && s.steps.every(t => t.length > 10), `${s.id} needs ≥2 real steps`);
  }
  assert.ok(DISCLAIMER.toLowerCase().includes("not medical advice"));
});

test("risky-sounding stretches carry a caution", () => {
  for (const id of ["neck-tilt", "hip-flexor", "forward-fold", "figure-four", "wrist-stretch"]) assert.ok(get(id).caution, `${id} should say when to skip it`);
});

test("both modes have enough variety to rotate", () => {
  for (const where of ["desk", "stand"]) assert.ok(STRETCHES.filter(s => s.where.includes(where)).length >= 8, `${where} pool`);
  assert.ok(STRETCHES.filter(s => s.where.includes("stand")).some(s => s.target === "legs"), "stand mode includes leg movement");
});

test("suggest returns the requested count, only from the right place, varying body areas", () => {
  for (const where of ["desk", "stand"]) {
    const picks = suggest(where, { rng: seeded(7) });
    assert.equal(picks.length, 3);
    assert.ok(picks.every(s => s.where.includes(where)));
    assert.equal(new Set(picks.map(s => s.target)).size, 3, "three different body areas");
  }
});

test("'show others' avoids repeating what's on screen when it can", () => {
  const first = suggest("desk", { rng: seeded(1) });
  const next = suggest("desk", { exclude: first.map(s => s.id), rng: seeded(2) });
  assert.equal(next.filter(s => first.some(f => f.id === s.id)).length, 0);
});

test("routines are three different stretches of roughly two minutes, and never the long walk", () => {
  for (let seed = 1; seed <= 40; seed++) for (const where of ["desk", "stand"]) {
    const r = buildRoutine(where, { rng: seeded(seed) });
    assert.equal(r.length, 3);
    assert.equal(new Set(r.map(s => s.target)).size, 3);
    assert.ok(r.every(s => s.where.includes(where)) && !r.some(s => s.id === "walk-water"));
    const t = totalSeconds(r); assert.ok(t >= 75 && t <= 150, `${where} seed ${seed}: ${t}s`);
  }
});

test("duration labels read naturally", () => {
  assert.equal(minutesLabel(20), "20 s"); assert.equal(minutesLabel(60), "1 min"); assert.equal(minutesLabel(90), "1.5 min"); assert.equal(minutesLabel(120), "2 min");
});
