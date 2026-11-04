// Updates the Homebrew cask (the sibling repo ../homebrew-tap) to the version and checksums of the DMGs just built.
//   npm run release:mac && npm run release:cask      then review, commit and push the tap yourself
// Reads dist/SHA256SUMS.txt, so the cask can only ever name files that were really built.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { root, pkg } from "./lib/bundle.mjs";

const cask = path.resolve(root, "../homebrew-tap/Casks/backright.rb");
if (!existsSync(cask)) { console.error(`No cask at ${cask} (clone https://github.com/lylerbaumgarten/homebrew-tap next to this repo).`); process.exit(1); }
const sums = Object.fromEntries(readFileSync(path.join(root, "dist/SHA256SUMS.txt"), "utf8").trim().split("\n").map(l => { const [sha, name] = l.trim().split(/\s+/); return [name, sha]; }));
const arm = sums[`BackRight-${pkg.version}-arm64.dmg`], intel = sums[`BackRight-${pkg.version}-x64.dmg`];
if (!arm || !intel) { console.error(`dist/SHA256SUMS.txt needs both arm64 and x64 entries for ${pkg.version} (run npm run release:mac, both architectures).`); process.exit(1); }

let text = readFileSync(cask, "utf8");
text = text.replace(/version "[^"]+"/, `version "${pkg.version}"`)
  .replace(/(sha256 arm:\s+)"[0-9a-f]{64}"/, `$1"${arm}"`)
  .replace(/(intel: )"[0-9a-f]{64}"/, `$1"${intel}"`);
writeFileSync(cask, text);
console.log(`Updated ${cask}\n  version ${pkg.version}\n  arm64   ${arm}\n  x64     ${intel}\nNow publish the GitHub release first (the cask downloads from it), then commit and push the tap.`);
