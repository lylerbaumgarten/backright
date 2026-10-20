// macOS app builder/launcher. Builds a standalone, renamed copy of Electron — build/BackRight.app — with the app's
// own name, icon and bundle id, and the app code bundled inside (Contents/Resources/app), so it runs without the
// project folder, shows up in the Dock / Launchpad / Spotlight, and gets its own camera permission prompt.
//
//   npm run dev:app              rebuild if needed, sync the latest code into the bundle, launch it
//   npm run app                  same, then also install it to ~/Applications/BackRight.app and launch that copy
//   npm run dev:app -- --debug   launch with a DevTools remote-debugging port (9333)
//   npm run dev:app -- --no-launch  build/sync only (no quit, no launch) — used for CI and clean-clone checks
//   npm run dev:app -- --rebuild throw the bundle away and recreate it (this changes its signature, so macOS
//                                will ask for camera access again)
//
// The bundle is signed once, when created, and later syncs only replace Contents/Resources/app. Re-signing would
// change the app's identity and make macOS forget the camera permission every time. (Distributable images are built
// by release-mac.mjs, which signs the finished bundle properly.)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { root, APP_NAME, electronDist, configureBundle, syncAppCode, adhocSign } from "./lib/bundle.mjs";

if (process.platform !== "darwin") { console.error("dev-app is macOS-only; use `npm start` elsewhere."); process.exit(1); }

const args = new Set(process.argv.slice(2));
const app = path.join(root, `build/${APP_NAME}.app`);
const dist = await electronDist();

// 1. the bundle (once)
if (args.has("--rebuild")) rmSync(app, { recursive: true, force: true });
if (!existsSync(path.join(app, "Contents/Resources/icon.icns"))) {
  console.log(`Creating build/${APP_NAME}.app (one time)…`);
  rmSync(app, { recursive: true, force: true });
  mkdirSync(path.dirname(app), { recursive: true });
  cpSync(path.join(dist, "Electron.app"), app, { recursive: true, verbatimSymlinks: true });
  configureBundle(app);
  adhocSign(app);
}

// 2. sync the latest code into the bundle
syncAppCode(app, dist);
spawnSync("touch", [app]);   // nudge macOS to refresh its icon cache

// 3. quit any running copy (it owns the menu-bar icon), optionally install, launch
if (args.has("--no-launch")) { console.log(`Built ${app} (not launched)`); process.exit(0); }
spawnSync("pkill", ["-f", `${APP_NAME}.app/Contents/MacOS`], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 800));
let target = app;
if (args.has("--install")) {
  const apps = path.join(os.homedir(), "Applications");
  mkdirSync(apps, { recursive: true });
  target = path.join(apps, `${APP_NAME}.app`);
  rmSync(target, { recursive: true, force: true });
  cpSync(app, target, { recursive: true, verbatimSymlinks: true });
  console.log(`Installed ${target}`);
}
execFileSync("open", [target, ...(args.has("--debug") ? ["--args", "--remote-debugging-port=9333"] : [])], { stdio: "inherit" });
console.log(`Launched ${target}`);
