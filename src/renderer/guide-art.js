// Illustrations for the desk-setup guide, drawn as inline SVG strings (no images, no network).
//
// A single `figure()` draws a filled side-view body from joint positions, so the same code produces
// the upright and slouched poses for both sitting and standing. Per-step overlays add the callouts:
// green joint markers, angle arcs, dimension lines and labelled pills. Colours come from CSS
// variables (--art-*, --ok, --bad in style.css) so everything follows light/dark mode.
// NB: no gradients/filters — a <defs> reference inside a hidden SVG breaks every other copy on the page.

const W = 480, H = 340;
const wrap = (body, w = W, h = H) => `<svg viewBox="0 0 ${w} ${h}" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const f1 = n => Math.round(n * 10) / 10;
const pt = p => `${f1(p[0])} ${f1(p[1])}`;

// ---------- primitives ----------
const limb = (a, b, w, cls = "al") => `<line class="${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${w}"/>`;
const shoe = (a, floor, dx = 0) => `<rect class="ab" x="${a[0] - 11 + dx}" y="${floor - 14}" width="44" height="14" rx="6"/>`;

function torso(S, Hp, bulge = 0) {
  const dx = Hp[0] - S[0], dy = Hp[1] - S[1], L = Math.hypot(dx, dy), d = [dx / L, dy / L], f = [d[1], -d[0]];   // f = front normal
  const at = (t, o, e = 0) => [S[0] + d[0] * (L * t + e) + f[0] * o, S[1] + d[1] * (L * t + e) + f[1] * o];
  const bt = at(0, -13, -6), bm = at(0.5, -(13 + bulge * 2)), bb = at(1, -16, 10), fb = at(1, 15, 6), fm = at(0.55, 19), ft = at(0, 13, -4);
  return `<path class="ab" stroke-linejoin="round" stroke-width="6" d="M${pt(bt)} Q${pt(bm)} ${pt(bb)} L${pt(fb)} Q${pt(fm)} ${pt(ft)} Z"/>`;
}

/**
 * Side-view body facing right. p = { hc, S, H, K, A, E, W, floor, bulge?, farDx? }
 * hc head centre · S shoulder · H hip · K knee · A ankle · E elbow · W wrist
 */
function figure(p) {
  const fx = p.farDx ?? 8;
  const far = (a) => [a[0] + fx, a[1] - 1];
  const neckBase = [p.S[0] + 1, p.S[1] - 8], neckTop = [p.hc[0] - 3, p.hc[1] + 12];
  const hc = p.hc;
  return `
    ${limb(far(p.H), far(p.K), 19, "alf")}${limb(far(p.K), far(p.A), 14, "alf")}${shoe(far(p.A), p.floor, fx).replace('class="ab"', 'class="abf"')}
    ${limb(p.S, far(p.E), 11, "alf")}${limb(far(p.E), [p.W[0] + fx - 2, p.W[1]], 9, "alf")}
    ${torso(p.S, p.H, p.bulge || 0)}
    ${limb(neckBase, neckTop, 13)}
    ${limb(p.H, p.K, 21)}${limb(p.K, p.A, 16)}${shoe(p.A, p.floor)}
    <circle class="ab" cx="${hc[0]}" cy="${hc[1]}" r="17"/>
    <path class="ab" stroke-linejoin="round" stroke-width="3" d="M${hc[0] + 14} ${hc[1] - 4} L${hc[0] + 22} ${hc[1] + 5} L${hc[0] + 13} ${hc[1] + 7} Z"/>
    <circle class="a-eyedot" cx="${hc[0] + 11}" cy="${hc[1] - 3}" r="2"/>
    ${limb(p.S, p.E, 12, "ala")}${limb(p.E, p.W, 10, "ala")}<circle class="aha" cx="${p.W[0]}" cy="${p.W[1]}" r="6"/>`;
}

const joint = (p, r = 7) => `<circle class="a-joint" cx="${p[0]}" cy="${p[1]}" r="${r}"/>`;
const hot = p => `<circle class="a-hot1" cx="${p[0]}" cy="${p[1]}" r="21"/><circle class="a-hot2" cx="${p[0]}" cy="${p[1]}" r="13"/><circle class="a-hot3" cx="${p[0]}" cy="${p[1]}" r="6"/>`;
const guide = (a, b, cls = "a-dashl") => `<line class="${cls}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`;
const arc = (cx, cy, r, a0, a1, sweep) => {   // angles in degrees, svg convention (y down, clockwise positive)
  const P = a => `${f1(cx + r * Math.cos(a * Math.PI / 180))} ${f1(cy + r * Math.sin(a * Math.PI / 180))}`;
  return `<path class="a-arc" d="M${P(a0)} A${r} ${r} 0 0 ${sweep} ${P(a1)}"/>`;
};

/** Labelled pill with an optional leader line to the feature it describes. */
function pill(x, y, label, { to = null, tone = "ok", align = "start" } = {}) {
  const w = Math.round(label.length * 6.4 + 20), x0 = align === "end" ? x - w : align === "middle" ? x - w / 2 : x;
  let out = "";
  if (to) {
    const sx = to[0] > x0 + w / 2 ? x0 + w : x0;
    out += `<line class="a-leader a-${tone}" x1="${sx}" y1="${y}" x2="${to[0]}" y2="${to[1]}"/><circle class="a-ldot a-${tone}f" cx="${to[0]}" cy="${to[1]}" r="3"/>`;
  }
  return out + `<rect class="a-pill a-${tone}" x="${x0}" y="${y - 12}" width="${w}" height="24" rx="12"/><text class="a-ptext" x="${x0 + w / 2}" y="${y + 4.5}" text-anchor="middle">${label}</text>`;
}

/** Double-headed dimension line, horizontal (y fixed) or vertical (x fixed). */
function dim(a, b, label, { labelAt = null } = {}) {
  const horiz = Math.abs(a[1] - b[1]) < 1, t = 6;
  const ends = horiz
    ? `<line class="a-dim" x1="${a[0]}" y1="${a[1] - t}" x2="${a[0]}" y2="${a[1] + t}"/><line class="a-dim" x1="${b[0]}" y1="${b[1] - t}" x2="${b[0]}" y2="${b[1] + t}"/>`
    : `<line class="a-dim" x1="${a[0] - t}" y1="${a[1]}" x2="${a[0] + t}" y2="${a[1]}"/><line class="a-dim" x1="${b[0] - t}" y1="${b[1]}" x2="${b[0] + t}" y2="${b[1]}"/>`;
  const mid = labelAt || [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return `<line class="a-dim" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>${ends}${pill(mid[0], mid[1], label, { align: "middle" })}`;
}

// ---------- seated scene ----------
const SIT_GOOD = { hc: [188, 98], S: [176, 138], H: [170, 226], K: [252, 228], A: [254, 296], E: [178, 190], W: [238, 189], floor: 312 };
const SIT_SLOUCH = { hc: [252, 130], S: [222, 154], H: [188, 228], K: [264, 232], A: [266, 296], E: [224, 200], W: [280, 198], floor: 312, bulge: 11 };
const sitSetting = () => `
  <ellipse class="a-shadow" cx="250" cy="313" rx="200" ry="6"/>
  <line class="a-floor" x1="14" y1="312" x2="466" y2="312"/>
  <!-- chair -->
  <path class="a-chair-back" d="M152 234 Q138 190 146 130"/>
  <line class="a-chair-stem" x1="190" y1="246" x2="190" y2="294"/><line class="a-chair-stem" x1="150" y1="296" x2="232" y2="296" stroke-width="5"/>
  <circle class="a-wheel" cx="152" cy="305" r="7"/><circle class="a-wheel" cx="230" cy="305" r="7"/>
  <rect class="a-seat" x="140" y="232" width="124" height="15" rx="7"/>
  <!-- desk, keyboard, monitor -->
  <rect class="a-desk" x="216" y="198" width="234" height="10" rx="3"/><rect class="a-desk" x="432" y="208" width="12" height="104"/>
  <rect class="a-key" x="232" y="190" width="52" height="8" rx="3"/>
  <line class="a-post" x1="352" y1="198" x2="352" y2="172"/><rect class="a-monbase" x="328" y="194" width="48" height="5" rx="2"/>
  <polygon class="a-monitor" points="344,100 357,96 361,174 348,178"/><line class="a-screen" x1="344" y1="102" x2="348" y2="176"/>`;
const sitCone = (eye, col = "a-cone") => `<polygon class="${col}" points="${pt(eye)} 343 102 347 174"/>`;
const sit = (pose, over = "") => wrap(sitSetting() + sitCone([pose.hc[0] + 11, pose.hc[1] - 3]) + figure(pose) + over);

// ---------- standing scene ----------
const STAND_GOOD = { hc: [212, 40], S: [210, 64], H: [210, 152], K: [211, 228], A: [210, 292], E: [212, 116], W: [272, 116], floor: 306, farDx: 10 };
const STAND_SLOUCH = { hc: [238, 50], S: [206, 72], H: [224, 152], K: [220, 228], A: [208, 292], E: [210, 124], W: [270, 122], floor: 306, bulge: 6, farDx: 10 };
const standSetting = () => `
  <ellipse class="a-shadow" cx="250" cy="317" rx="200" ry="6"/>
  <line class="a-floor" x1="14" y1="316" x2="466" y2="316"/>
  <rect class="a-mat" x="146" y="306" width="128" height="10" rx="5"/>
  <rect class="a-desk" x="240" y="122" width="230" height="10" rx="3"/>
  <rect class="a-desk" x="418" y="132" width="14" height="172"/><rect class="a-desk" x="380" y="304" width="92" height="12" rx="5"/>
  <rect class="a-key" x="246" y="114" width="52" height="8" rx="3"/>
  <line class="a-post" x1="352" y1="122" x2="352" y2="106"/><rect class="a-monbase" x="328" y="118" width="48" height="5" rx="2"/>
  <polygon class="a-monitor" points="344,44 357,40 361,108 348,112"/><line class="a-screen" x1="344" y1="46" x2="348" y2="110"/>`;
const standCone = eye => `<polygon class="a-cone" points="${pt(eye)} 343 46 347 108"/>`;
const stand = (pose, over = "") => wrap(`<g transform="translate(0 14)">${standSetting()}${standCone([pose.hc[0] + 11, pose.hc[1] - 3])}${figure(pose)}${over}</g>`);

// ---------- per-step overlays ----------
const SIT_OVER = {
  feet: () => {
    const { H: Hp, K, A } = SIT_GOOD;
    return `${arc(K[0], K[1], 28, 180, 90, 0)}${joint(Hp)}${joint(K)}${joint(A)}
      ${pill(300, 244, "Knees about 90°", { to: [266, 232] })}${pill(300, 284, "Feet flat on the floor", { to: [284, 306] })}`;
  },
  back: () => `
    <ellipse class="a-hlfill" cx="147" cy="186" rx="13" ry="38"/><ellipse class="a-hlring" cx="147" cy="186" rx="13" ry="38"/>
    ${pill(14, 96, "Lower back supported", { to: [143, 170] })}
    ${guide([150, 226], [270, 226])}${joint(SIT_GOOD.H)}
    ${pill(290, 262, "Hips all the way back", { to: [182, 232] })}`,
  arms: () => {
    const { E, W } = SIT_GOOD;
    return `${arc(E[0], E[1], 26, -90, 0, 1)}${joint(E)}${joint(W)}${guide(W, [330, W[1]])}
      ${pill(214, 150, "Elbows about 90°", { to: [193, 177] })}${pill(262, 226, "Wrists straight", { to: [244, 192] })}`;
  },
  screen: () => {
    const eye = [199, 95];
    return `${guide(eye, [430, 95])}
      ${dim([208, 62], [344, 62], "50–70 cm")}
      ${pill(372, 95, "Eye level", {})}${joint([350, 100], 5)}
      ${pill(214, 134, "Top of screen at eye level", { to: [345, 103] })}`;
  },
};
const STAND_OVER = {
  feet: () => {
    const { H: Hp, K, A } = STAND_GOOD, [p, q, r] = [Hp, K, A].map(a => [a[0], a[1]]);
    return `<rect class="a-hlfill" x="146" y="306" width="128" height="10" rx="5"/>${joint(p)}${joint(q)}${joint(r)}
      ${pill(262, 266, "Feet about hip-width apart", { to: [226, 296] })}${pill(262, 224, "Knees soft, not locked", { to: [222, 228] })}`;
  },
  arms: () => {
    const { E, W } = STAND_GOOD;
    return `${arc(E[0], E[1], 24, -90, 0, 1)}${joint(E)}${joint(W)}${guide(W, [330, W[1]])}
      ${pill(240, 70, "Elbows about 90°", { to: [226, 99] })}
      ${dim([452, 132], [452, 316], "Desk at elbow height", { labelAt: [360, 214] })}`;
  },
  screen: () => {
    const eye = [223, 37];
    return `${guide(eye, [430, 37])}
      ${dim([220, 6], [344, 6], "50–70 cm")}
      ${pill(372, 37, "Eye level", {})}
      ${pill(244, 80, "Top of screen at eye level", { to: [345, 47] })}`;
  },
  spine: () => {
    const g = STAND_GOOD;
    const pts = [[g.hc[0], g.hc[1]], g.S, g.H, g.K, g.A].map(a => [a[0] === g.hc[0] ? 211 : a[0], a[1]]);
    return `${guide([211, -8], [211, 310])}${pts.map(a => joint(a)).join("")}
      ${pill(14, 40, "Ears over shoulders", { to: [204, 40] })}${pill(14, 78, "Shoulders relaxed", { to: [203, 64] })}
      ${pill(14, 152, "Pelvis neutral", { to: [203, 152] })}${pill(14, 228, "Knees soft", { to: [203, 228] })}${pill(14, 292, "Weight through the heels", { to: [203, 292] })}`;
  },
};

// ---------- wrong vs right ----------
function compare(mode) {
  const sitting = mode === "sit";
  const bad = sitting ? SIT_SLOUCH : STAND_SLOUCH, good = sitting ? SIT_GOOD : STAND_GOOD;
  const badSpots = sitting ? [[236, 136], [190, 196], [280, 198], [264, 232]] : [[226, 82], [208, 150], [220, 228], [208, 292]];
  const goodJoints = sitting ? [[good.hc[0], good.hc[1]], good.S, good.H, good.K, good.A] : [[211, 40], good.S, good.H, good.K, good.A];
  const scene = (pose, over) => (sitting ? sitSetting() + sitCone([pose.hc[0] + 11, pose.hc[1] - 3]) : `<g transform="translate(0 14)">${standSetting()}${standCone([pose.hc[0] + 11, pose.hc[1] - 3])}`) + figure(pose) + over + (sitting ? "" : "</g>");
  const badOver = badSpots.map(hot).join("") + (sitting
    ? pill(266, 52, "Head forward", { to: [240, 120], tone: "bad" }) + pill(14, 150, "Rounded back", { to: [194, 188], tone: "bad" })
    : pill(264, 40, "Head forward", { to: [242, 74], tone: "bad" }) + pill(14, 130, "Swayed back, locked knees", { to: [204, 150], tone: "bad" }));
  const goodOver = (sitting ? guide([good.hc[0], 20], [good.hc[0] - 12, 250]) : guide([211, 0], [211, 310])) + goodJoints.map(a => joint(a)).join("") +
    (sitting ? pill(266, 52, "Ears over shoulders", { to: [194, 98] }) : pill(264, 40, "Stacked in one line", { to: [214, 54] }));
  return wrap(
    `<g>${scene(bad, badOver)}</g><g transform="translate(500 0)">${scene(good, goodOver)}</g>
     <rect class="a-capbar a-badbar" x="0" y="338" width="480" height="40" rx="10"/><rect class="a-capbar a-goodbar" x="500" y="338" width="480" height="40" rx="10"/>
     <text class="a-cap a-badt" x="240" y="364" text-anchor="middle">✕  ${sitting ? "Slouched" : "Slumped"}</text>
     <text class="a-cap a-goodt" x="740" y="364" text-anchor="middle">✓  ${sitting ? "Upright and supported" : "Tall and stacked"}</text>`,
    980, 384);
}

/** art("sit" | "stand", "compare" | "feet" | "back" | "arms" | "screen" | "spine"). Unknown key → "". */
export function art(mode, key) {
  if (key === "compare") return compare(mode);
  if (mode === "stand") return STAND_OVER[key] ? stand(STAND_GOOD, STAND_OVER[key]()) : "";
  return SIT_OVER[key] ? sit(SIT_GOOD, SIT_OVER[key]()) : "";
}
