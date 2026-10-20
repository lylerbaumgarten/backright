// Camera lifecycle, kept free of MediaPipe so it can be unit-tested with stubs.

export const withTimeout = (promise, ms, what) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000}s`)), ms))]);

const CONSTRAINTS = { video: { width: 640, height: 480, frameRate: { ideal: 5, max: 15 }, facingMode: "user" } };

/**
 * Several features can need the camera at once (monitoring, setup guide, calibration), so it's reference-counted by
 * reason: the stream — and the camera light — only exists while at least one reason holds it.
 *
 * Start and stop requests can overlap (settings change → re-sync while a start is still in flight). Two things keep that safe:
 *  - an AbortError from video.play() just means "the stream was replaced/stopped meanwhile" — not a failure;
 *  - after a start finishes we re-check, so a release that arrived mid-start still stops the camera.
 */
export function createCamera(video, { getUserMedia = c => navigator.mediaDevices.getUserMedia(c), startTimeoutMs = 15000 } = {}) {
  const reasons = new Set();
  let stream = null, starting = null;

  const stop = () => { stream.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null; };

  async function sync() {
    if (reasons.size && !stream) {
      starting ??= (async () => {
        stream = await withTimeout(getUserMedia(CONSTRAINTS), startTimeoutMs, "Camera start");
        video.srcObject = stream;
        try { await video.play(); }
        catch (e) { if (e?.name !== "AbortError") throw e; }   // interrupted by a newer load/stop: benign
      })().finally(() => { starting = null; });
      await starting;
    }
    if (!reasons.size && stream) stop();                        // released while we were starting
  }

  return {
    get active() { return !!stream && video.readyState >= 2; },
    async acquire(reason) { reasons.add(reason); await sync(); },
    async release(reason) { reasons.delete(reason); await sync(); },
    async releaseAll() { reasons.clear(); await sync().catch(() => {}); },
  };
}
