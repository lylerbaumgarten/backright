import test from "node:test";
import assert from "node:assert/strict";
import { createCamera } from "../src/renderer/camera.js";

// A video element whose play() behaves like a browser's: it rejects with AbortError if the source changes before it settles.
function fakeVideo({ playMs = 20 } = {}) {
  let src = null, pending = null;
  return {
    readyState: 4,
    get srcObject() { return src; },
    set srcObject(v) { src = v; pending?.abort(); },
    play() {
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => { pending = null; resolve(); }, playMs);
        pending = { abort: () => { clearTimeout(t); pending = null; const e = new Error("The play() request was interrupted by a new load request."); e.name = "AbortError"; reject(e); } };
      });
    },
  };
}
const fakeStream = () => { const s = { stopped: 0, getTracks: () => [{ stop: () => s.stopped++ }] }; return s; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

test("start then release works and stops the camera", async () => {
  const stream = fakeStream(), cam = createCamera(fakeVideo(), { getUserMedia: async () => stream });
  await cam.acquire("monitoring"); assert.ok(cam.active);
  await cam.release("monitoring"); assert.equal(cam.active, false); assert.equal(stream.stopped, 1);
});

test("releasing while play() is still starting is not an error, and the camera ends up stopped", async () => {
  const stream = fakeStream(), cam = createCamera(fakeVideo({ playMs: 50 }), { getUserMedia: async () => stream });
  const started = cam.acquire("monitoring");
  await sleep(10);                                   // getUserMedia done, play() in flight
  const released = cam.release("monitoring");        // → srcObject = null → play() rejects with AbortError
  await assert.doesNotReject(started);
  await released;
  assert.equal(cam.active, false);
  assert.equal(stream.stopped, 1, "camera must not be left running");
});

test("a release that arrives during getUserMedia still stops the camera afterwards", async () => {
  const stream = fakeStream();
  const cam = createCamera(fakeVideo(), { getUserMedia: async () => { await sleep(30); return stream; } });
  const started = cam.acquire("a");
  await sleep(5);
  await cam.release("a");                            // nothing to stop yet
  await started;
  assert.equal(cam.active, false);
  assert.equal(stream.stopped, 1);
});

test("overlapping acquires share one stream", async () => {
  let opened = 0;
  const cam = createCamera(fakeVideo(), { getUserMedia: async () => { opened++; return fakeStream(); } });
  await Promise.all([cam.acquire("monitoring"), cam.acquire("setup"), cam.acquire("calibrate")]);
  assert.equal(opened, 1);
  await cam.release("monitoring"); await cam.release("setup"); assert.ok(cam.active, "still held by calibrate");
  await cam.release("calibrate"); assert.equal(cam.active, false);
});

test("real failures still surface (permission denied etc.)", async () => {
  const cam = createCamera(fakeVideo(), { getUserMedia: async () => { throw new Error("Permission denied"); } });
  await assert.rejects(cam.acquire("monitoring"), /Permission denied/);
});

test("a hung camera start times out with a clear message", async () => {
  const cam = createCamera(fakeVideo(), { getUserMedia: () => new Promise(() => {}), startTimeoutMs: 30 });
  await assert.rejects(cam.acquire("monitoring"), /Camera start timed out/);
});
