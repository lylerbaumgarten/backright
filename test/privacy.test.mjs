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

test("the only file the app writes is settings.json", () => {
  const writes = files.filter(f => /writeFile(Sync)?\(/.test(read(f))).map(f => path.relative(src, f));
  assert.deepEqual(writes, ["main/main.js"]);
  assert.equal((read(path.join(src, "main/main.js")).match(/writeFile(Sync)?\(/g) || []).length, 1);
});

test("CSP forbids outside connections", () => {
  const main = read(path.join(src, "main/main.js"));
  assert.match(main, /default-src 'none'/);
  assert.match(main, /connect-src 'self'/);
});
