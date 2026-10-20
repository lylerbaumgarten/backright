// macOS dev launcher. `npm start` runs the stock Electron binary as a child of whatever launched it
// (a terminal, an editor, Claude…), and macOS blames that parent for camera access — usually with no
// prompt at all. This makes a private, renamed copy of Electron so macOS sees "Posture" as its own app:
// it gets its own camera prompt and its own entry in System Settings → Privacy & Security → Camera.
//
//   npm run dev:app            launch (creates build/Posture.app on first run)
//   npm run dev:app -- --debug open with a DevTools remote port (9333)
//
// The copy is signed once and never modified afterwards (app code is passed by path), so the
// permission you grant keeps applying.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (process.platform !== "darwin") { console.error("dev-app is macOS-only; use `npm start` elsewhere."); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(root, "build/Posture.app");
const plist = path.join(app, "Contents/Info.plist");
const pb = (...cmd) => spawnSync("/usr/libexec/PlistBuddy", ["-c", cmd.join(" "), plist], { stdio: "ignore" });

if (!existsSync(app)) {
  console.log("Creating build/Posture.app (one time)…");
  mkdirSync(path.dirname(app), { recursive: true });
  cpSync(path.join(root, "node_modules/electron/dist/Electron.app"), app, { recursive: true, verbatimSymlinks: true });
  pb("Set :CFBundleName Posture"); pb("Add :CFBundleDisplayName string Posture"); pb("Set :CFBundleDisplayName Posture");
  pb("Set :CFBundleIdentifier com.lylebaumgarten.posture");
  pb("Set :NSCameraUsageDescription Posture uses your camera to check your posture. Images are analysed on this Mac and never stored or sent anywhere.");
  pb("Delete :NSMicrophoneUsageDescription");
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
}

const debug = process.argv.includes("--debug") ? ["--remote-debugging-port=9333"] : [];
execFileSync("open", ["-n", app, "--args", root, ...debug], { stdio: "inherit" });
console.log("Launched Posture.app — macOS should now ask for camera access the first time you start the camera.");
