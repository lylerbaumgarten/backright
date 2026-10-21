// Guardrails for the "nothing leaves this machine, nothing is stored" promise.
// These are static checks over our own source — a tripwire for future changes, not a proof.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const files = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : /\.(js|mjs|html)$/.test(e.name) && files.push(p); } })(src);
const read = f => fs.readFileSync(f, "utf8");

// Anything that can capture/encode a frame, or talk to a network.
const FORBIDDEN = [
  [/toDataURL|toBlob|convertToBlob|createImageBitmap|getImageData/, "frame capture/encoding"],
  [/MediaRecorder|ImageCapture|grabFrame|takePhoto/, "recording APIs"],
  [/XMLHttpRequest|navigator\.sendBeacon|new WebSocket|EventSource|WebTransport|RTCPeerConnection/, "network APIs"],
  [/require\(["'](node:)?(https?|net|tls|dgram|child_process)["']\)/, "node networking/process modules"],
  [/localStorage|sessionStorage|indexedDB|caches\./, "browser storage"],
  [/\bfetch\(\s*["'`]https?:/, "fetch to a remote URL"],
];

test("source contains no frame-capture, recording, network or storage APIs", () => {
  const hits = [];
  for (const f of files) for (const [re, why] of FORBIDDEN) if (re.test(read(f))) hits.push(`${path.relative(src, f)}: ${why}`);
  assert.deepEqual(hits, []);
});

test("no remote URLs are loaded by any page", () => {
  const hits = [];
  for (const f of files.filter(f => f.endsWith(".html"))) if (/(src|href)=["']https?:/.test(read(f))) hits.push(path.relative(src, f));
  assert.deepEqual(hits, []);
});

test("all disk writes live in one module, and it only writes settings, posture history and a user-chosen export", () => {
  const writers = files.filter(f => /writeFile(Sync)?\(|appendFile|createWriteStream|\.rename(Sync)?\(/.test(read(f))).map(f => path.relative(src, f));
  assert.deepEqual(writers, ["main/storage.js"], "only storage.js may write to disk");
  const names = [...read(path.join(src, "main/storage.js")).matchAll(/file\("([\w-]+\.\w+)"\)/g)].map(m => m[1]);
  assert.deepEqual([...new Set(names)].sort(), ["history.json", "settings.json"]);
});

test("nothing outside storage.js can write: main.js and the renderer never touch fs for writing", () => {
  for (const f of files) {
    if (f.endsWith("main/storage.js")) continue;
    assert.doesNotMatch(read(f), /fs\.(write|append|rm|unlink|mkdir|copy|rename|createWriteStream)/, `${path.relative(src, f)} writes to disk`);
  }
});

test("CSP forbids outside connections", () => {
  const main = read(path.join(src, "main/main.js"));
  assert.match(main, /default-src 'none'/);
  assert.match(main, /connect-src 'self'/);
});
