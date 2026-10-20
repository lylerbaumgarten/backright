// Shared by dev-app.mjs (development copy) and release-mac.mjs (distributable DMGs): everything that turns a stock
// Electron.app into "BackRight.app". Keeping it in one place means the app you test and the app you ship are built
// the same way.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
export const BUNDLE_ID = "com.lylebaumgarten.backright";
export const APP_NAME = pkg.productName;
const require = createRequire(import.meta.url);

/**
 * Directory holding Electron.app (plus Electron's LICENSE files) for a CPU architecture ("arm64" | "x64").
 * The machine's own architecture comes from node_modules (downloaded on first use — npm no longer fetches the binary
 * itself). The other architecture is downloaded from Electron's official releases and checked against the SHA-256
 * published in the electron package (checksums.json), then unpacked into build/electron-<arch>/.
 */
export async function electronDist(arch = process.arch) {
  if (arch === process.arch) {
    const dist = path.join(root, "node_modules/electron/dist");
    if (!existsSync(path.join(dist, "Electron.app"))) {
      console.log("Downloading the Electron binary (one time)…");
      execFileSync("node", [path.join(root, "node_modules/electron/install.js")], { stdio: "inherit" });
    }
    return dist;
  }
  const out = path.join(root, `build/electron-${arch}`);
  if (existsSync(path.join(out, "Electron.app"))) return out;
  console.log(`Downloading Electron for ${arch} (one time, checksum-verified)…`);
  const { downloadArtifact } = require("@electron/get");
  const version = require(path.join(root, "node_modules/electron/package.json")).version;
  const checksums = require(path.join(root, "node_modules/electron/checksums.json"));
  const zip = await downloadArtifact({ version, artifactName: "electron", platform: "darwin", arch, checksums });
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  execFileSync("ditto", ["-xk", zip, out]);   // ditto keeps the symlinks and permissions a .app needs
  return out;
}

/** Name, id, icon, camera text… on a freshly copied Electron.app. */
export function configureBundle(app) {
  const res = path.join(app, "Contents/Resources"), plist = path.join(app, "Contents/Info.plist");
  const pb = (...cmd) => spawnSync("/usr/libexec/PlistBuddy", ["-c", cmd.join(" "), plist], { stdio: "ignore" });
  const setKey = (key, type, value) => { if (pb(`Set :${key} ${value}`).status !== 0) pb(`Add :${key} ${type} ${value}`); };
  if (!existsSync(path.join(root, "assets/icon.icns"))) execFileSync("node", [path.join(root, "scripts/make-icon.mjs")], { stdio: "inherit" });   // icons are generated
  rmSync(path.join(res, "electron.icns"), { force: true });
  cpSync(path.join(root, "assets/icon.icns"), path.join(res, "icon.icns"));
  setKey("CFBundleName", "string", APP_NAME); setKey("CFBundleDisplayName", "string", APP_NAME);
  setKey("CFBundleIdentifier", "string", BUNDLE_ID);
  setKey("CFBundleIconFile", "string", "icon.icns");
  setKey("CFBundleShortVersionString", "string", pkg.version); setKey("CFBundleVersion", "string", pkg.version);
  setKey("NSCameraUsageDescription", "string", `${APP_NAME} uses your camera to check your posture. Images are analysed on this Mac and never stored or sent anywhere.`);
  pb("Delete :NSMicrophoneUsageDescription");
  mkdirSync(path.join(res, "app"), { recursive: true });
}

/** Copy the app's code, model and licence files into Contents/Resources (no node_modules: there are no runtime dependencies). */
export function syncAppCode(app, electronDistDir) {
  const res = path.join(app, "Contents/Resources"), dest = path.join(res, "app");
  rmSync(dest, { recursive: true, force: true }); mkdirSync(dest, { recursive: true });
  for (const dir of ["src", "vendor", "assets"]) cpSync(path.join(root, dir), path.join(dest, dir), { recursive: true });
  for (const f of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) cpSync(path.join(root, f), path.join(dest, f));   // MIT/Apache require licences to travel with the app
  cpSync(path.join(root, "LICENSES"), path.join(dest, "LICENSES"), { recursive: true });
  cpSync(path.join(electronDistDir, "LICENSE"), path.join(res, "LICENSE.electron"));
  cpSync(path.join(electronDistDir, "LICENSES.chromium.html"), path.join(res, "LICENSES.chromium.html"));
  writeFileSync(path.join(dest, "package.json"), JSON.stringify({ name: pkg.name, productName: pkg.productName, version: pkg.version, main: pkg.main }, null, 2));
  cpSync(path.join(root, "assets/icon.icns"), path.join(res, "icon.icns"));   // keep the static icon current (Finder / Launchpad)
}

export const adhocSign = app => execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
