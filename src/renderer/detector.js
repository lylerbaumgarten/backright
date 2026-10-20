import { PoseLandmarker, FilesetResolver } from "./vendor/vision_bundle.mjs";

let landmarker;

/** Load the bundled pose model (no network — everything is under app://local/vendor). */
export async function loadModel() {
  if (landmarker) return;
  const fileset = await FilesetResolver.forVisionTasks("app://local/vendor/wasm");
  const make = delegate => PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "app://local/vendor/pose_landmarker_lite.task", delegate },
    runningMode: "VIDEO", numPoses: 1,
  });
  try { landmarker = await make("GPU"); } catch { landmarker = await make("CPU"); }
}

/**
 * Camera lifecycle. Several features can need the camera at once (monitoring, setup guide,
 * calibration), so it's reference-counted by reason: the stream — and the camera light —
 * only exists while at least one reason holds it.
 */
export function createCamera(video) {
  const reasons = new Set();
  let stream = null, starting = null;
  async function sync() {
    if (reasons.size && !stream) {
      starting ??= (async () => {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, frameRate: { ideal: 5, max: 15 }, facingMode: "user" } });
        video.srcObject = stream; await video.play();
      })().finally(() => { starting = null; });
      await starting;
    } else if (!reasons.size && stream) {
      stream.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null;
    }
  }
  return {
    get active() { return !!stream && video.readyState >= 2; },
    async acquire(reason) { reasons.add(reason); await sync(); },
    async release(reason) { reasons.delete(reason); await sync(); },
  };
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
