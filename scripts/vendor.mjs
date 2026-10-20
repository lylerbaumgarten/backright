// Copies the MediaPipe runtime out of node_modules and fetches the pose model once,
// so the shipped app never touches the network. Run via `npm run vendor` (also runs on postinstall).
import { cp, mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vendor = path.join(root, "vendor");
const mp = path.join(root, "node_modules/@mediapipe/tasks-vision");
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const modelPath = path.join(vendor, "pose_landmarker_lite.task");

await mkdir(vendor, { recursive: true });
await cp(path.join(mp, "vision_bundle.mjs"), path.join(vendor, "vision_bundle.mjs"));
await cp(path.join(mp, "wasm"), path.join(vendor, "wasm"), { recursive: true });

try {
  await access(modelPath);
} catch {
  console.log("Downloading pose model (one-time, dev machine only)…");
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: ${res.status}`);
  await writeFile(modelPath, Buffer.from(await res.arrayBuffer()));
}
console.log("vendor/ ready — app runs fully offline.");
