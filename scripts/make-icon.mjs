// Generates the app icon (assets/icon.png + icon.icns) and the menu-bar glyph (assets/trayTemplate*.png).
// Pure Node — shapes are rendered from signed-distance functions and written as PNG by hand, so there are
// no image tools or npm packages involved.   Run: npm run icon   (iconutil is macOS-only; PNGs work anywhere)
import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "assets");
mkdirSync(assets, { recursive: true });

// ---------- PNG ----------
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- signed distance helpers (units: px of a 1024 design grid) ----------
const circle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;
const rrect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - (hw - r), qy = Math.abs(y - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const cov = (d, px) => Math.min(1, Math.max(0, 0.5 - d / px));   // anti-aliased coverage from distance
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const over = (dst, src, a) => dst.map((v, i) => v + (src[i] - v) * a);

/** Render a design drawn on a 1024 grid at `size` px. paint(x, y, px) → [r,g,b,a(0-1)] */
function render(size, paint) {
  const buf = Buffer.alloc(size * size * 4), k = 1024 / size;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const [r, g, b, a] = paint((i + 0.5) * k, (j + 0.5) * k, k);
    const o = (j * size + i) * 4;
    buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = Math.round(a * 255);
  }
  return png(size, size, buf);
}

// ---------- app icon: green squircle, white upright figure, small amber "nudge" dot ----------
function appIcon(x, y, px) {
  const d = rrect(x, y, 512, 512, 412, 412, 186);                      // macOS icon grid: 824px body in a 1024 canvas
  const body = cov(d, px);
  if (body <= 0) return [0, 0, 0, 0];
  let c = mix([66, 156, 118], [30, 96, 80], Math.min(1, Math.max(0, (y - 100) / 824)));   // top → bottom green
  const white = [250, 252, 250];
  const bust = Math.max(rrect(x, y, 512, 835, 275, 255, 190), d + 30);   // shoulders, clipped to the icon body
  c = over(c, white, cov(bust, px));
  c = over(c, white, cov(rrect(x, y, 512, 545, 50, 64, 24), px));       // neck
  c = over(c, white, cov(circle(x, y, 512, 395, 122), px));             // head
  // amber dot (the nudge), with a ring so it reads against both green and white
  c = over(c, white, cov(circle(x, y, 745, 280, 70), px));
  c = over(c, [240, 162, 58], cov(circle(x, y, 745, 280, 56), px));
  return [...c, body];
}

// ---------- menu-bar glyph: black + alpha "template" image (macOS tints it for light/dark) ----------
function trayGlyph(x, y, px) {
  const head = cov(circle(x, y, 512, 300, 150), px);
  const neck = cov(rrect(x, y, 512, 470, 62, 80, 30), px);
  const shoulders = cov(rrect(x, y, 512, 800, 360, 210, 190), px) * cov(y - 1000, px) ;
  const a = Math.max(head, neck, Math.min(1, shoulders));
  return [0, 0, 0, a];
}

// ---------- write everything ----------
writeFileSync(path.join(assets, "icon.png"), render(1024, appIcon));
writeFileSync(path.join(assets, "trayTemplate.png"), render(22, trayGlyph));
writeFileSync(path.join(assets, "trayTemplate@2x.png"), render(44, trayGlyph));

if (process.platform === "darwin") {
  const set = path.join(root, "build/icon.iconset");
  rmSync(set, { recursive: true, force: true }); mkdirSync(set, { recursive: true });
  const sizes = { "icon_16x16.png": 16, "icon_16x16@2x.png": 32, "icon_32x32.png": 32, "icon_32x32@2x.png": 64, "icon_128x128.png": 128, "icon_128x128@2x.png": 256,
                  "icon_256x256.png": 256, "icon_256x256@2x.png": 512, "icon_512x512.png": 512, "icon_512x512@2x.png": 1024 };
  for (const [name, s] of Object.entries(sizes)) writeFileSync(path.join(set, name), render(s, appIcon));
  execFileSync("iconutil", ["-c", "icns", set, "-o", path.join(assets, "icon.icns")]);
  rmSync(set, { recursive: true, force: true });
}
console.log("assets/ ready: icon.png, icon.icns, trayTemplate.png, trayTemplate@2x.png");
