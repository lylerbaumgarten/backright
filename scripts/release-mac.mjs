// Builds a distributable disk image: dist/BackRight-<version>-<arch>.dmg (+ SHA256SUMS.txt).  macOS only.
//
//   npm run release:mac
//
// Differences from `npm run app` (which is for development on this Mac):
//  • starts from a copy of the bundle and RE-SIGNS it at the end — the development bundle intentionally keeps one
//    stable signature so macOS remembers the camera permission, which leaves its seal stale, and a stale seal on a
//    downloaded app shows up as "BackRight is damaged";
//  • adds a "How to open BackRight.txt" next to the app, because the app is NOT notarized (that needs a paid Apple
//    Developer ID). It is ad-hoc signed, so on first launch macOS asks the user to confirm in System Settings.
//
// The image is built for the architecture of the machine running this (Apple Silicon → arm64).
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, symlinkSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (process.platform !== "darwin") { console.error("release:mac is macOS-only."); process.exit(1); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const arch = process.arch === "arm64" ? "arm64" : "x64";
const name = pkg.productName, dist = path.join(root, "dist"), stage = path.join(dist, "stage");
const dmg = path.join(dist, `${name}-${pkg.version}-${arch}.dmg`);
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", ...opts });

rmSync(dist, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

// 1. make sure the development bundle holds the latest code + licences, then copy it
run("node", [path.join(root, "scripts/dev-app.mjs"), "--no-launch"]);
const app = path.join(stage, `${name}.app`);
cpSync(path.join(root, `build/${name}.app`), app, { recursive: true, verbatimSymlinks: true });
run("xattr", ["-cr", app]);   // no stray Finder / iCloud / quarantine attributes in the image

// 2. final metadata, then a clean ad-hoc signature over the finished bundle
const plist = path.join(app, "Contents/Info.plist");
const pb = cmd => spawnSync("/usr/libexec/PlistBuddy", ["-c", cmd, plist], { stdio: "ignore" });
if (pb(`Set :NSHumanReadableCopyright "© 2026 Lyle Baumgarten — MIT License"`).status !== 0) pb(`Add :NSHumanReadableCopyright string "© 2026 Lyle Baumgarten — MIT License"`);
run("codesign", ["--force", "--deep", "--sign", "-", app]);
run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app]);   // throws if the seal is not valid

// 3. disk image layout: the app, an Applications shortcut, and instructions for the first launch
symlinkSync("/Applications", path.join(stage, "Applications"));
writeFileSync(path.join(stage, `How to open ${name}.txt`), `${name} ${pkg.version}

1. Drag ${name} onto the Applications folder.
2. Open ${name} from Applications. macOS will say it can't verify the app — click "Done" (not "Move to Trash").
   Why: ${name} is free and open source and isn't signed with a paid Apple Developer ID, so macOS shows this
   warning for every app that isn't. You can read all of the code at https://github.com/lylerbaumgarten/${pkg.name}
3. Open  System Settings → Privacy & Security, scroll down to "Security", find the message about ${name}
   and click "Open Anyway". Enter your password, then click "Open Anyway" once more.
   (macOS 14 and earlier: right-click the app → Open → Open.)
4. macOS will ask for camera access. That's what ${name} needs to see your head and shoulders; the video is
   analysed on your Mac and never saved or sent anywhere. The first screens explain this, and you can turn Wi-Fi off
   to see it keep working.

Requires macOS 13 or newer${arch === "arm64" ? " on a Mac with Apple Silicon (M1 or later)" : ""}.
`);

// 4. image + checksum
run("hdiutil", ["create", "-volname", name, "-srcfolder", stage, "-fs", "HFS+", "-format", "UDZO", "-ov", dmg]);
rmSync(stage, { recursive: true, force: true });
const sha = createHash("sha256").update(readFileSync(dmg)).digest("hex");
writeFileSync(path.join(dist, "SHA256SUMS.txt"), `${sha}  ${path.basename(dmg)}\n`);
console.log(`\nBuilt ${path.relative(root, dmg)} (${(statSync(dmg).size / 1048576).toFixed(1)} MB)\nsha256 ${sha}`);
