// Builds distributable disk images, one per CPU architecture:
//   dist/BackRight-<version>-arm64.dmg   Apple Silicon (M1 or later)
//   dist/BackRight-<version>-x64.dmg     Intel Macs
// plus dist/SHA256SUMS.txt.  macOS only.
//
//   npm run release:mac                   both
//   npm run release:mac -- --arch=x64     just one (arm64 | x64)
//
// A Mac app is compiled for one chip family, so Intel needs its own Electron. The Intel one is downloaded from
// Electron's official releases and verified against the SHA-256 published in the electron package, then everything
// else (our code, the model, icons, licences) is identical for both builds. Building the Intel app on an Apple
// Silicon Mac works, but it can't be run there without Rosetta, so test it on an Intel Mac.
//
// Differences from `npm run app` (development on this Mac):
//  • each image starts from a fresh copy and the finished bundle is RE-SIGNED — the development bundle keeps one
//    stable signature so macOS remembers the camera permission, which leaves its seal stale, and a stale seal on a
//    downloaded app shows up as "BackRight is damaged";
//  • a "How to open BackRight.txt" sits next to the app, because the app is NOT notarized (that needs a paid Apple
//    Developer ID). It is ad-hoc signed, so on first launch macOS asks the user to confirm in System Settings.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, symlinkSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { root, pkg, APP_NAME, electronDist, configureBundle, syncAppCode, adhocSign } from "./lib/bundle.mjs";

if (process.platform !== "darwin") { console.error("release:mac is macOS-only."); process.exit(1); }

const want = (process.argv.find(a => a.startsWith("--arch=")) || "--arch=all").split("=")[1];
const ARCHS = want === "all" ? ["arm64", "x64"] : [want];
if (!ARCHS.every(a => ["arm64", "x64"].includes(a))) { console.error("--arch must be arm64, x64 or all"); process.exit(1); }

const dist = path.join(root, "dist");
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });
const archLabel = { arm64: "a Mac with Apple Silicon (M1 or later)", x64: "an Intel Mac" };
const howTo = arch => `${APP_NAME} ${pkg.version} (${arch === "arm64" ? "Apple Silicon" : "Intel"})

1. Drag ${APP_NAME} onto the Applications folder.
2. Open ${APP_NAME} from Applications. macOS will say it can't verify the app — click "Done" (not "Move to Trash").
   Why: ${APP_NAME} is free and open source and isn't signed with a paid Apple Developer ID, so macOS shows this
   warning for every app that isn't. You can read all of the code at https://github.com/lylerbaumgarten/${pkg.name}
3. Open  System Settings → Privacy & Security, scroll down to "Security", find the message about ${APP_NAME}
   and click "Open Anyway". Enter your password, then click "Open Anyway" once more.
   (macOS 14 and earlier: right-click the app → Open → Open.)
4. macOS will ask for camera access. That's what ${APP_NAME} needs to see your head and shoulders; the video is
   analysed on your Mac and never saved or sent anywhere. The first screens explain this, and you can turn Wi-Fi off
   to see it keep working.

Requires macOS 13 or newer on ${archLabel[arch]}.
Not sure which Mac you have?  Apple menu → About This Mac: "Chip: Apple M…" = Apple Silicon, "Processor: Intel…" = Intel.
`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
const sums = [];

for (const arch of ARCHS) {
  console.log(`\n=== ${APP_NAME} ${pkg.version} — ${arch} ===`);
  const stage = path.join(dist, `stage-${arch}`), app = path.join(stage, `${APP_NAME}.app`);
  const dmg = path.join(dist, `${APP_NAME}-${pkg.version}-${arch}.dmg`);
  mkdirSync(stage, { recursive: true });

  // 1. assemble: this chip's Electron + our name/icon/id + our code
  const dir = await electronDist(arch);
  cpSync(path.join(dir, "Electron.app"), app, { recursive: true, verbatimSymlinks: true });
  configureBundle(app);
  syncAppCode(app, dir);
  run("xattr", ["-cr", app]);   // no stray Finder / iCloud / quarantine attributes in the image

  // 2. make sure it really is this architecture, not the host's
  const archs = execFileSync("lipo", ["-archs", path.join(app, "Contents/MacOS/Electron")], { encoding: "utf8" }).trim();
  const expected = arch === "arm64" ? "arm64" : "x86_64";
  if (archs !== expected) throw new Error(`${arch} build contains ${archs}, expected ${expected}`);
  console.log(`main executable: ${archs}`);

  // 3. final metadata, then a clean ad-hoc signature over the finished bundle
  const plist = path.join(app, "Contents/Info.plist"), copyright = "© 2026 Lyle Baumgarten — MIT License";
  if (spawnSync("/usr/libexec/PlistBuddy", ["-c", `Set :NSHumanReadableCopyright "${copyright}"`, plist], { stdio: "ignore" }).status !== 0)
    spawnSync("/usr/libexec/PlistBuddy", ["-c", `Add :NSHumanReadableCopyright string "${copyright}"`, plist], { stdio: "ignore" });
  adhocSign(app);
  run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);   // throws if the seal is not valid

  // 4. disk image: the app, an Applications shortcut, first-launch instructions
  symlinkSync("/Applications", path.join(stage, "Applications"));
  writeFileSync(path.join(stage, `How to open ${APP_NAME}.txt`), howTo(arch));
  run("hdiutil", ["create", "-volname", APP_NAME, "-srcfolder", stage, "-fs", "HFS+", "-format", "UDZO", "-ov", dmg]);
  rmSync(stage, { recursive: true, force: true });
  const sha = createHash("sha256").update(readFileSync(dmg)).digest("hex");
  sums.push(`${sha}  ${path.basename(dmg)}`);
  console.log(`\nBuilt ${path.relative(root, dmg)} (${(statSync(dmg).size / 1048576).toFixed(1)} MB)\nsha256 ${sha}`);
}
writeFileSync(path.join(dist, "SHA256SUMS.txt"), sums.join("\n") + "\n");
