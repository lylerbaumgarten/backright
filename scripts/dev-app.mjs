// macOS app builder/launcher. Builds a standalone, renamed copy of Electron — build/Posture.app — with the app's
// own name, icon and bundle id, and the app code bundled inside (Contents/Resources/app), so it runs without the
// project folder, shows up in the Dock / Launchpad / Spotlight, and gets its own camera permission prompt.
//
//   npm run dev:app              rebuild if needed, sync the latest code into the bundle, launch it
//   npm run app                  same, then also install it to ~/Applications/Posture.app and launch that copy
//   npm run dev:app -- --debug   launch with a DevTools remote-debugging port (9333)
//   npm run dev:app -- --no-launch  build/sync only (no quit, no launch) — used for CI and clean-clone checks
//   npm run dev:app -- --rebuild throw the bundle away and recreate it (this changes its signature, so macOS
//                                will ask for camera access again)
//
// The bundle is signed once, when created, and later syncs only replace Contents/Resources/app. Re-signing would
// change the app's identity and make macOS forget the camera permission every time.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";

if (process.platform !== "darwin") { console.error("dev-app is macOS-only; use `npm start` elsewhere."); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const app = path.join(root, "build/Posture.app");
const res = path.join(app, "Contents/Resources");
const plist = path.join(app, "Contents/Info.plist");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const pb = (...cmd) => spawnSync("/usr/libexec/PlistBuddy", ["-c", cmd.join(" "), plist], { stdio: "ignore" });
const setKey = (key, type, value) => { if (pb(`Set :${key} ${value}`).status !== 0) pb(`Add :${key} ${type} ${value}`); };

// Electron's binary is downloaded lazily (npm doesn't always run its installer) — make sure it's there before copying it.
if (!existsSync(path.join(root, "node_modules/electron/dist/Electron.app"))) {
  console.log("Downloading the Electron binary (one time)…");
  execFileSync("node", [path.join(root, "node_modules/electron/install.js")], { stdio: "inherit" });
}

// icon assets are generated, not hand-made
if (!existsSync(path.join(root, "assets/icon.icns"))) execFileSync("node", [path.join(root, "scripts/make-icon.mjs")], { stdio: "inherit" });

// 1. the bundle (once)
if (args.has("--rebuild")) rmSync(app, { recursive: true, force: true });
if (!existsSync(path.join(res, "icon.icns"))) {
  console.log("Creating build/Posture.app (one time)…");
  rmSync(app, { recursive: true, force: true });
  mkdirSync(path.dirname(app), { recursive: true });
  cpSync(path.join(root, "node_modules/electron/dist/Electron.app"), app, { recursive: true, verbatimSymlinks: true });
  rmSync(path.join(res, "electron.icns"), { force: true });
  cpSync(path.join(root, "assets/icon.icns"), path.join(res, "icon.icns"));
  setKey("CFBundleName", "string", "Posture"); setKey("CFBundleDisplayName", "string", "Posture");
  setKey("CFBundleIdentifier", "string", "com.lylebaumgarten.posture");
  setKey("CFBundleIconFile", "string", "icon.icns");
  setKey("CFBundleShortVersionString", "string", pkg.version); setKey("CFBundleVersion", "string", pkg.version);
  setKey("NSCameraUsageDescription", "string", "Posture uses your camera to check your posture. Images are analysed on this Mac and never stored or sent anywhere.");
  pb("Delete :NSMicrophoneUsageDescription");
  mkdirSync(path.join(res, "app"), { recursive: true });   // present at signing time, contents synced below
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
}

// 2. sync the app code into the bundle (no node_modules: the app has no runtime dependencies)
const dest = path.join(res, "app");
rmSync(dest, { recursive: true, force: true }); mkdirSync(dest, { recursive: true });
for (const dir of ["src", "vendor", "assets"]) cpSync(path.join(root, dir), path.join(dest, dir), { recursive: true });
// licences travel with the app (MIT/Apache require it when redistributing)
for (const f of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) cpSync(path.join(root, f), path.join(dest, f));
cpSync(path.join(root, "LICENSES"), path.join(dest, "LICENSES"), { recursive: true });
const electronDist = path.join(root, "node_modules/electron/dist");
cpSync(path.join(electronDist, "LICENSE"), path.join(res, "LICENSE.electron"));
cpSync(path.join(electronDist, "LICENSES.chromium.html"), path.join(res, "LICENSES.chromium.html"));
writeFileSync(path.join(dest, "package.json"), JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, main: pkg.main }, null, 2));

cpSync(path.join(root, "assets/icon.icns"), path.join(res, "icon.icns"));   // keep the static icon current (Finder/Launchpad)
spawnSync("touch", [app]);                                                       // nudge macOS to refresh its icon cache

// 3. quit any running copy (it owns the menu-bar icon), optionally install, launch
if (args.has("--no-launch")) { console.log(`Built ${app} (not launched)`); process.exit(0); }
spawnSync("pkill", ["-f", "Posture.app/Contents/MacOS"], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 800));
let target = app;
if (args.has("--install")) {
  const apps = path.join(os.homedir(), "Applications");
  mkdirSync(apps, { recursive: true });
  target = path.join(apps, "Posture.app");
  rmSync(target, { recursive: true, force: true });
  cpSync(app, target, { recursive: true, verbatimSymlinks: true });
  console.log(`Installed ${target}`);
}
execFileSync("open", [target, ...(args.has("--debug") ? ["--args", "--remote-debugging-port=9333"] : [])], { stdio: "inherit" });
console.log(`Launched ${target}`);
