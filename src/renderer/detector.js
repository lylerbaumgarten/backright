import { PoseLandmarker, FilesetResolver } from "./vendor/vision_bundle.mjs";
import { createCamera, withTimeout } from "./camera.js";

export { createCamera };

let landmarker, loading;

/** Load the bundled pose model (no network — everything is under app://local/vendor). Safe to call concurrently. */
export function loadModel() {
  loading ??= (async () => {
    const t0 = performance.now();
    const fileset = await FilesetResolver.forVisionTasks("app://local/vendor/wasm");
    const make = delegate => PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "app://local/vendor/pose_landmarker_lite.task", delegate },
      runningMode: "VIDEO", numPoses: 1,
    });
    let delegate = "GPU";
    try { landmarker = await withTimeout(make("GPU"), 10000, "GPU model load"); }
    catch (e) { console.warn("GPU delegate failed, using CPU:", e.message); delegate = "CPU"; landmarker = await withTimeout(make("CPU"), 20000, "CPU model load"); }
    console.log(`pose model ready (${delegate}) in ${Math.round(performance.now() - t0)}ms`);
  })().catch(e => { loading = null; throw e; });
  return loading;
}

/** Run one detection on the current video frame. The frame is never copied, saved or sent anywhere. */
export function detect(video) {
  if (!landmarker || video.readyState < 2) return null;
  const res = landmarker.detectForVideo(video, performance.now());
  return res.landmarks?.[0] ?? null;
}

const EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [0, 11], [0, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
export function drawSkeleton(canvas, lm) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lm) return;
  const vis = i => (lm[i].visibility ?? 1) >= 0.5;
  const P = i => [lm[i].x * canvas.width, lm[i].y * canvas.height];
  ctx.strokeStyle = ctx.fillStyle = "#5fbf86"; ctx.lineWidth = 3;
  for (const [a, b] of EDGES) if (vis(a) && vis(b)) { ctx.beginPath(); ctx.moveTo(...P(a)); ctx.lineTo(...P(b)); ctx.stroke(); }
  for (const i of [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26]) if (vis(i)) { ctx.beginPath(); ctx.arc(...P(i), 4, 0, 7); ctx.fill(); }
}
