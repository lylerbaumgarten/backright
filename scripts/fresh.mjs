// Fresh-start launcher for end-to-end testing (macOS):
//   npm run fresh              quit Posture, delete saved settings, relaunch → first-run walkthrough again
//   npm run fresh -- --all     also wipe the whole app data folder (Chromium caches etc.)
//   npm run fresh -- --camera  also reset macOS camera permission, so you get the permission prompt again
//   npm run fresh -- --debug   relaunch with a DevTools remote-debugging port (9333)
//   npm run fresh -- --no-launch   just clean up (also --no-quit: don't stop a running copy)
import { spawnSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const dataDir = path.join(os.homedir(), "Library/Application Support/Posture");
const BUNDLE_ID = "com.lylebaumgarten.posture";

// 1. quit every running Posture (dev app + overlay helpers)
if (!args.has("--no-quit")) {
  spawnSync("pkill", ["-f", "build/Posture.app/Contents/MacOS"], { stdio: "ignore" });
  await new Promise(r => setTimeout(r, 1200));
  console.log("• quit Posture");
}

// 2. delete saved state — settings, calibration, walkthrough progress (never any images; none are stored)
if (args.has("--all")) { rmSync(dataDir, { recursive: true, force: true }); console.log(`• removed ${dataDir}`); }
else {
  const f = path.join(dataDir, "settings.json");
  if (existsSync(f)) { rmSync(f); console.log("• removed settings.json (calibration, preferences, walkthrough progress)"); }
  else console.log("• no saved settings found (already fresh)");
}

// 3. optionally reset the macOS camera permission for this app
if (args.has("--camera")) {
  const r = spawnSync("tccutil", ["reset", "Camera", BUNDLE_ID], { encoding: "utf8" });
  console.log(r.status === 0 ? "• reset camera permission — macOS will ask again" : `• camera reset failed: ${r.stderr.trim()}`);
}

// 4. relaunch
if (!args.has("--no-launch")) {
  const launch = spawnSync("node", [path.join(import.meta.dirname, "dev-app.mjs"), ...(args.has("--debug") ? ["--debug"] : [])], { stdio: "inherit" });
  process.exit(launch.status ?? 0);
}
