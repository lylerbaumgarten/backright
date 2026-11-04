// Illustrations for the stretch library, drawn as inline SVG strings in the same flat style as the desk-setup guide
// (guide-art.js): one scene per stretch, a body made from joint positions, and a few arrows saying which way to move.
// Colours come from the same CSS variables, so everything follows light/dark mode. No gradients/filters/ids (a <defs>
// reference inside a hidden SVG breaks every other copy on the page).
//
//   stretchArt(id) → "<svg …>" for a stretch id, or "" if there isn't one.
import { wrap, limb, joint, guide, arc, pill, f1, pt, SIT_GOOD, STAND_GOOD } from "./guide-art.js";

// ---------- extra primitives ----------
const arrow = (a, b, cls = "a-move") => {   // straight arrow a → b with a filled head
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hl = 11, hw = 6.5;
  const base = [b[0] - ux * hl, b[1] - uy * hl];
  return `<line class="${cls}" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(base[0])}" y2="${f1(base[1])}"/>
    <polygon class="${cls}f" points="${pt(b)} ${pt([base[0] - uy * hw, base[1] + ux * hw])} ${pt([base[0] + uy * hw, base[1] - ux * hw])}"/>`;
};
/** Curved arrow around (cx, cy) from angle a0 to a1 (degrees, svg convention), head at the a1 end. */
const spin = (cx, cy, r, a0, a1, cls = "a-move") => {
  const P = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)], dir = a1 > a0 ? 1 : -1;
  const s = P(a0), e = P(a1), large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = dir > 0 ? 1 : 0;
  const tangent = [-Math.sin(a1 * Math.PI / 180) * dir, Math.cos(a1 * Math.PI / 180) * dir];
  const tip = [e[0] + tangent[0] * 9, e[1] + tangent[1] * 9];
  return `<path class="${cls}" d="M${pt(s)} A${r} ${r} 0 ${large} ${sweep} ${pt(e)}"/>${arrow([e[0] - tangent[0] * 4, e[1] - tangent[1] * 4], tip, cls)}`;
};
const ghost = (cx, cy, r = 17) => `<circle class="a-ghost" cx="${cx}" cy="${cy}" r="${r}"/>`;
const glow = (x, y, r = 22) => `<circle class="a-hlfill" cx="${x}" cy="${y}" r="${r}"/><circle class="a-hlring" cx="${x}" cy="${y}" r="${r}"/>`;

/** Heel-raised shoe: the toe stays on the floor, the heel lifts by `lift`. */
function shoeRaised(a, floor, lift) {
  const toe = [a[0] + 33, floor], heel = [a[0] - 11, floor - 14 - lift];
  return `<polygon class="ab" stroke-linejoin="round" stroke-width="6" points="${pt(heel)} ${pt([toe[0], floor - 14])} ${pt([toe[0], floor])} ${pt([a[0] - 4, floor - 4 - lift * 0.5])}"/>`;
}
const flatShoe = (a, floor, cls = "ab", dx = 0) => `<rect class="${cls}" x="${a[0] - 11 + dx}" y="${floor - 14}" width="44" height="14" rx="6"/>`;

// ---------- side-view body (facing right) ----------
/**
 * p = { hc, S, H, K, A, E, W, floor, bulge?, headRot?, lift?, hand?, far?: { H, K, A, E, W }, farLeg?: bool }
 * Same joints as guide-art's figure(), but every far-side limb can be placed on its own.
 */
function body(p) {
  const fx = 8, dfar = a => [a[0] + fx, a[1] - 1], fr = p.far || {};
  const F = { H: fr.H || dfar(p.H), K: fr.K || dfar(p.K), A: fr.A || dfar(p.A), E: fr.E || dfar(p.E), W: fr.W || [p.W[0] + fx - 2, p.W[1]] };
  const neckBase = [p.S[0] + 1, p.S[1] - 8], neckTop = [p.hc[0] - 3, p.hc[1] + 12], hc = p.hc, floor = p.floor;
  const sd = (a, far) => (p.lift && !far ? shoeRaised(a, floor, p.lift) : flatShoe(a, floor, far ? "abf" : "ab", far ? fx : 0));
  const dx = p.S && p.H ? p.H[0] - p.S[0] : 0, dy = p.H[1] - p.S[1], L = Math.hypot(dx, dy), d = [dx / L, dy / L], f = [d[1], -d[0]];
  const at = (t, o, e = 0) => [p.S[0] + d[0] * (L * t + e) + f[0] * o, p.S[1] + d[1] * (L * t + e) + f[1] * o], bulge = p.bulge || 0;
  const bt = at(0, -13, -6), bm = at(0.5, -(13 + bulge * 2)), bb = at(1, -16, 10), fb = at(1, 15, 6), fm = at(0.55, 19), ft = at(0, 13, -4);
  const torso = `<path class="ab" stroke-linejoin="round" stroke-width="6" d="M${pt(bt)} Q${pt(bm)} ${pt(bb)} L${pt(fb)} Q${pt(fm)} ${pt(ft)} Z"/>`;
  const head = `<g transform="rotate(${p.headRot || 0} ${hc[0]} ${hc[1]})"><circle class="ab" cx="${hc[0]}" cy="${hc[1]}" r="17"/>
    <path class="ab" stroke-linejoin="round" stroke-width="3" d="M${hc[0] + 14} ${hc[1] - 4} L${hc[0] + 22} ${hc[1] + 5} L${hc[0] + 13} ${hc[1] + 7} Z"/>
    <circle class="a-eyedot" cx="${hc[0] + 11}" cy="${hc[1] - 3}" r="2"/></g>`;
  const farLeg = p.noFarLeg ? "" : `${limb(F.H, F.K, 19, "alf")}${limb(F.K, F.A, 14, "alf")}${sd(F.A, true)}`;
  return `${farLeg}
    ${limb(p.S, F.E, 11, "alf")}${limb(F.E, F.W, 9, "alf")}<circle class="ahf" cx="${F.W[0]}" cy="${F.W[1]}" r="5.5"/>
    ${torso}${limb(neckBase, neckTop, 13)}
    ${limb(p.H, p.K, 21)}${limb(p.K, p.A, 16)}${sd(p.A, false)}
    ${head}
    ${limb(p.S, p.E, 12, "ala")}${limb(p.E, p.W, 10, "ala")}<circle class="aha" cx="${p.W[0]}" cy="${p.W[1]}" r="6"/>`;
}

// ---------- front-view body ----------
/**
 * p = { hc, SL, SR, EL, ER, WL, WR, HL, HR, KL?, KR?, AL?, AR?, headRot?, turn?, floor? }  (L/R = left/right of the picture)
 * The torso is a rounded block between the shoulders and hips; `turn` shows a head in profile (looking to the side).
 */
function frontBody(p) {
  const c = a => [f1(a[0]), f1(a[1])], mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const sm = mid(p.SL, p.SR), hc = p.hc;
  const legs = (p.KL ? `${limb(p.HL, p.KL, 20)}${limb(p.KL, p.AL, 15)}<rect class="ab" x="${p.AL[0] - 16}" y="${p.AL[1] - 4}" width="34" height="13" rx="6"/>` : "")
    + (p.KR ? `${limb(p.HR, p.KR, 20)}${limb(p.KR, p.AR, 15)}<rect class="ab" x="${p.AR[0] - 18}" y="${p.AR[1] - 4}" width="34" height="13" rx="6"/>` : "");
  const arms = (S, E, W) => `${limb(S, E, 12, "ala")}${limb(E, W, 10, "ala")}<circle class="aha" cx="${W[0]}" cy="${W[1]}" r="6"/>`;
  const head = p.turn
    ? `<g transform="rotate(${p.headRot || 0} ${hc[0]} ${hc[1]})"><circle class="ab" cx="${hc[0]}" cy="${hc[1]}" r="17"/><path class="ab" stroke-linejoin="round" stroke-width="3" d="M${hc[0] + p.turn * 14} ${hc[1] - 4} L${hc[0] + p.turn * 22} ${hc[1] + 5} L${hc[0] + p.turn * 13} ${hc[1] + 7} Z"/><circle class="a-eyedot" cx="${hc[0] + p.turn * 9}" cy="${hc[1] - 3}" r="2"/></g>`
    : `<g transform="rotate(${p.headRot || 0} ${hc[0]} ${hc[1] + 17})"><circle class="ab" cx="${hc[0]}" cy="${hc[1]}" r="18"/><circle class="a-eyedot" cx="${hc[0] - 6}" cy="${hc[1] - 2}" r="2"/><circle class="a-eyedot" cx="${hc[0] + 6}" cy="${hc[1] - 2}" r="2"/></g>`;
  return `${legs}
    ${p.armsBehind ? arms(p.SL, p.EL, p.WL) + arms(p.SR, p.ER, p.WR) : ""}
    <path class="ab" stroke-linejoin="round" stroke-width="10" d="M${c(p.SL)} L${c(p.SR)} L${c(p.HR)} L${c(p.HL)} Z"/>
    ${limb(sm, [hc[0], hc[1] + 16], 13)}
    ${p.armsBehind ? "" : arms(p.SL, p.EL, p.WL) + arms(p.SR, p.ER, p.WR)}
    ${head}`;
}

// ---------- scenes ----------
const FLOOR = 312;
const roomFloor = () => `<ellipse class="a-shadow" cx="240" cy="${FLOOR + 1}" rx="200" ry="6"/><line class="a-floor" x1="14" y1="${FLOOR}" x2="466" y2="${FLOOR}"/>`;
const chair = (x = 0) => `
  <path class="a-chair-back" d="M${152 + x} 234 Q${138 + x} 190 ${146 + x} 130"/>
  <line class="a-chair-stem" x1="${190 + x}" y1="246" x2="${190 + x}" y2="294"/><line class="a-chair-stem" x1="${150 + x}" y1="296" x2="${232 + x}" y2="296" stroke-width="5"/>
  <circle class="a-wheel" cx="${152 + x}" cy="305" r="7"/><circle class="a-wheel" cx="${230 + x}" cy="305" r="7"/>
  <rect class="a-seat" x="${140 + x}" y="232" width="124" height="15" rx="7"/>`;
const desk = () => `<rect class="a-desk" x="216" y="198" width="234" height="10" rx="3"/><rect class="a-desk" x="432" y="208" width="12" height="104"/>`;
const standDesk = () => `<rect class="a-desk" x="262" y="148" width="208" height="10" rx="3"/><rect class="a-desk" x="440" y="158" width="14" height="154"/>`;
const wall = () => `<rect class="a-wall" x="90" y="10" width="26" height="${FLOOR - 10}"/><line class="a-furnline" x1="116" y1="10" x2="116" y2="${FLOOR}"/>`;

const seatedBase = SIT_GOOD;                                   // near-upright seated pose
const sitScene = (pose, over = "", { withDesk = false } = {}) => wrap(roomFloor() + chair() + (withDesk ? desk() : "") + body({ ...pose, floor: FLOOR }) + over);
const standPose = { ...STAND_GOOD, floor: 306 };
const standScene = (pose, over = "", { withDesk = false, withWall = false } = {}) =>
  wrap(`<g transform="translate(0 6)">${roomFloor().replace(new RegExp(String(FLOOR), "g"), "310")}${withWall ? wall() : ""}${withDesk ? standDesk() : ""}${body({ ...pose, floor: pose.floor ?? 306 })}${over}</g>`);

// ---------- one scene per stretch ----------
const ART = {};

// Neck side tilt — front view, seated: head tilted toward the right shoulder, shoulders level.
ART["neck-tilt"] = () => wrap(`${roomFloor()}
  <path class="a-chair-back" d="M168 250 Q160 200 170 118" transform="translate(70 0)"/>
  <rect class="a-seat" x="170" y="252" width="140" height="15" rx="7"/>
  ${frontBody({ hc: [240, 78], SL: [198, 132], SR: [282, 132], EL: [190, 186], ER: [290, 186], WL: [204, 240], WR: [276, 240], HL: [208, 250], HR: [272, 250], KL: [206, 252], AL: [204, 312], KR: [274, 252], AR: [276, 312], headRot: 18, floor: FLOOR })}
  ${spin(240, 118, 70, -112, -62)}${glow(204, 112, 18)}
  ${pill(300, 70, "Ear toward shoulder", { to: [262, 82], align: "start" })}${pill(300, 214, "Shoulders stay low", { to: [282, 138] })}`);

// Chin tucks — side view: the head glides straight back (ghost shows where it started).
ART["chin-tuck"] = () => sitScene({ ...seatedBase, hc: [180, 98], S: [176, 138], E: [190, 200], W: [244, 214] },
  `${ghost(207, 102)}${arrow([214, 78], [184, 78])}
   ${pill(262, 60, "Chin straight back", { to: [198, 92] })}${pill(262, 110, "Head level, not tipped", { to: [196, 98] })}`);

// Shoulder rolls — front view, circular arrows around both shoulders.
ART["shoulder-rolls"] = () => wrap(`${roomFloor()}
  <path class="a-chair-back" d="M168 250 Q160 200 170 118" transform="translate(70 0)"/>
  <rect class="a-seat" x="170" y="252" width="140" height="15" rx="7"/>
  ${frontBody({ hc: [240, 84], SL: [198, 138], SR: [282, 138], EL: [188, 192], ER: [292, 192], WL: [196, 246], WR: [284, 246], HL: [208, 250], HR: [272, 250], KL: [206, 252], AL: [204, 312], KR: [274, 252], AR: [276, 312], floor: FLOOR })}
  ${spin(190, 130, 30, 200, 520)}${spin(290, 130, 30, -20, -340)}
  ${pill(240, 36, "Up, back, down — slow circles", { align: "middle" })}`);

// Seated chest opener — side view, hands behind the head, elbows drawn back.
ART["seated-chest-opener"] = () => sitScene({ ...seatedBase, hc: [188, 94], S: [178, 136], E: [136, 118], W: [170, 88], far: { E: [140, 124], W: [176, 94] } },
  `${arrow([158, 124], [118, 140])}${glow(196, 160, 22)}
   ${pill(250, 64, "Hands behind head", { to: [176, 88] })}${pill(250, 152, "Elbows back, chest lifts", { to: [206, 160] })}`);

// Seated spinal twist — upper body turned, one hand on the opposite knee.
ART["seated-twist"] = () => wrap(`${roomFloor()}
  <path class="a-chair-back" d="M168 250 Q160 200 170 118" transform="translate(70 0)"/>
  <rect class="a-seat" x="170" y="252" width="140" height="15" rx="7"/>
  ${frontBody({ hc: [226, 84], turn: -1, SL: [208, 138], SR: [262, 134], EL: [176, 182], ER: [254, 200], WL: [166, 204], WR: [218, 246], HL: [208, 250], HR: [272, 250], KL: [206, 252], AL: [204, 312], KR: [274, 252], AR: [276, 312], floor: FLOOR })}
  ${spin(240, 132, 74, -40, -140)}
  ${pill(300, 60, "Turn from the chest", { to: [236, 118] })}${pill(300, 214, "Hand on opposite knee", { to: [224, 248] })}`);

// Wrist and forearm stretch — arm out, palm up, other hand eases the fingers back.
ART["wrist-stretch"] = () => sitScene({ ...seatedBase, hc: [188, 98], S: [176, 138], E: [232, 150], W: [300, 150], far: { E: [236, 140], W: [308, 134] } },
  `<polygon class="a-hand" points="298,143 312,138 322,120 316,114 302,134"/>${arrow([326, 112], [338, 132])}${glow(300, 150, 16)}
   ${pill(290, 74, "Fingers eased back", { to: [316, 120], align: "start" })}${pill(250, 214, "Felt along the forearm", { to: [286, 156], align: "start" })}`);

// Seated figure-four — ankle crossed over the opposite knee, lean forward slightly.
ART["figure-four"] = () => sitScene({ ...seatedBase, hc: [208, 106], S: [190, 144], H: [170, 226], K: [262, 214], A: [222, 204], E: [196, 196], W: [236, 200], bulge: 4,
    far: { K: [262, 232], A: [264, 296], H: [178, 226] } },
  `${arrow([200, 140], [232, 152])}${glow(176, 226, 22)}
   ${pill(290, 130, "Ankle on opposite knee", { to: [232, 204] })}${pill(290, 258, "Stretch in the hip", { to: [190, 236] })}`);

// Upper-back reach — hands clasped out in front, back rounded, head dropped.
ART["upper-back-reach"] = () => sitScene({ ...seatedBase, hc: [236, 126], S: [196, 148], H: [172, 226], E: [258, 150], W: [320, 150], bulge: 9, far: { E: [262, 150], W: [326, 150] } },
  `${arrow([330, 168], [372, 168])}${arrow([150, 156], [124, 166])}${glow(188, 168, 22)}
   ${pill(300, 104, "Push the hands away", { to: [322, 146] })}${pill(14, 100, "Round between the shoulder blades", { to: [184, 160] })}`);

// 20-20-20 eye break — look at something far away (a window), gaze line dashed.
ART["eye-break"] = () => wrap(`${roomFloor()}${chair()}
  <rect class="a-window" x="384" y="62" width="76" height="92" rx="6"/><line class="a-furnline" x1="422" y1="62" x2="422" y2="154"/><line class="a-furnline" x1="384" y1="108" x2="460" y2="108"/>
  ${body({ ...seatedBase, floor: FLOOR, hc: [188, 98], W: [226, 232], E: [196, 206], far: { E: [202, 206], W: [232, 232] } })}
  <line class="a-gaze" x1="206" y1="95" x2="384" y2="92"/>
  ${pill(240, 52, "Look 20 feet (6 m) away", { align: "start" })}${pill(250, 196, "20 seconds, blink slowly", { to: [196, 112], align: "start" })}`);

// Behind-the-back chest opener — standing, hands clasped behind, shoulder blades together.
ART["behind-back-opener"] = () => standScene({ ...standPose, hc: [212, 38], S: [210, 62], H: [208, 150], K: [211, 228], A: [210, 292], E: [190, 120], W: [182, 164], far: { E: [196, 124], W: [190, 166] } },
  `${arrow([190, 176], [160, 200])}${arrow([232, 78], [248, 68])}${glow(224, 90, 22)}
   ${pill(262, 108, "Chest lifts, ribs down", { to: [226, 96] })}${pill(262, 160, "Squeeze shoulder blades", { to: [200, 100] })}${pill(262, 236, "Hands clasped behind", { to: [186, 166] })}`);

// Hip-flexor lunge — hand on the desk, back leg long, hips drift forward.
ART["hip-flexor"] = () => standScene({ ...standPose, hc: [228, 44], S: [222, 70], H: [214, 154], K: [170, 230], A: [118, 280], E: [248, 120], W: [272, 142],
    far: { H: [224, 154], K: [284, 208], A: [286, 292], E: [252, 118], W: [276, 140] }, lift: 14 },
  `${arrow([226, 180], [256, 182])}${glow(194, 168, 22)}
   ${pill(296, 100, "Hand on the desk", { to: [276, 142] })}${pill(14, 154, "Stretch at the front of the hip", { to: [190, 170] })}${pill(296, 250, "Front knee over ankle", { to: [286, 232] })}`,
  { withDesk: true });

// Calf raises — rise onto the toes, hand on the desk.
ART["calf-raises"] = () => standScene({ ...standPose, hc: [212, 36], S: [210, 60], H: [210, 146], K: [211, 222], A: [210, 272], E: [236, 112], W: [276, 140], far: { A: [220, 272] }, lift: 26 },
  `${arrow([262, 296], [262, 246])}
   ${pill(282, 226, "Up slowly, pause", { to: [264, 262] })}${pill(282, 270, "Lower slowly", { to: [250, 292] })}`,
  { withDesk: true });

// Standing side bend — front view, arm overhead, lean to the side.
ART["side-bend"] = () => wrap(`<g transform="translate(0 6)">${`<ellipse class="a-shadow" cx="240" cy="311" rx="200" ry="6"/><line class="a-floor" x1="14" y1="310" x2="466" y2="310"/>`}
  ${frontBody({ hc: [262, 78], headRot: 14, SL: [208, 124], SR: [282, 114], EL: [176, 152], ER: [298, 66], WL: [178, 210], WR: [268, 22], HL: [208, 200], HR: [272, 200], KL: [206, 256], AL: [204, 302], KR: [274, 256], AR: [276, 302], floor: 310 })}
  ${spin(240, 190, 112, -132, -64)}${glow(222, 150, 20)}
  ${pill(14, 78, "Hips face forward", { to: [208, 200] })}${pill(14, 134, "Long stretch down the side", { to: [222, 148] })}</g>`);

// Soft forward fold — hinge at the hips, head and arms hang heavy.
ART["forward-fold"] = () => standScene({ ...standPose, hc: [318, 226], S: [282, 200], H: [206, 158], K: [210, 230], A: [208, 292], E: [296, 244], W: [300, 286], far: { E: [304, 244], W: [308, 286], K: [218, 230], A: [218, 292] } },
  `${arrow([150, 130], [186, 150])}${glow(214, 168, 22)}
   ${pill(262, 120, "Hinge at the hips", { to: [214, 160] })}${pill(14, 240, "Knees soft", { to: [204, 232] })}${pill(262, 172, "Head and arms hang heavy", { to: [300, 250] })}`);

// Wall angels — front view against a wall, arms in a goalpost, slide up and down.
ART["wall-angels"] = () => wrap(`<g transform="translate(0 6)"><rect class="a-wall" x="60" y="8" width="360" height="300"/><line class="a-furnline" x1="60" y1="308" x2="420" y2="308"/>
  <line class="a-floor" x1="14" y1="310" x2="466" y2="310"/>
  ${frontBody({ hc: [240, 60], SL: [200, 108], SR: [280, 108], EL: [160, 104], ER: [320, 104], WL: [158, 46], WR: [322, 46], HL: [210, 190], HR: [270, 190], KL: [208, 250], AL: [206, 302], KR: [272, 250], AR: [274, 302], armsBehind: false, floor: 310 })}
  ${arrow([128, 90], [128, 28])}${arrow([352, 28], [352, 90])}
  ${pill(240, 18, "Slide up and down the wall", { align: "middle" })}${pill(236, 296, "Back, head and arms on the wall", { align: "middle" })}</g>`);

// March in place — one knee lifted, arms swinging.
ART["march"] = () => standScene({ ...standPose, hc: [214, 38], S: [210, 62], H: [210, 148], K: [262, 176], A: [258, 244], E: [236, 112], W: [262, 100], far: { H: [216, 148], K: [214, 228], A: [214, 292], E: [190, 116], W: [172, 138] } },
  `${arrow([272, 210], [272, 168])}${arrow([300, 120], [320, 100])}${arrow([160, 130], [140, 150])}
   ${pill(300, 214, "Knees comfortably high", { to: [262, 190] })}${pill(14, 100, "Arms swing, breathe easy", { to: [186, 120] })}`);

// Walk and refill your water — striding, glass in hand.
ART["walk-water"] = () => standScene({ ...standPose, hc: [214, 40], S: [208, 64], H: [204, 150], K: [248, 222], A: [236, 292], E: [236, 118], W: [264, 112], far: { H: [210, 150], K: [170, 226], A: [140, 288], E: [182, 122], W: [162, 134] }, lift: 10 },
  `<path class="a-glass" d="M258 90 L286 90 L282 124 L262 124 Z"/><rect class="a-water" x="261" y="102" width="22" height="20" rx="2"/>
   <rect class="a-desk" x="400" y="126" width="30" height="182" rx="5"/><rect class="a-water" x="404" y="96" width="22" height="34" rx="4"/><circle class="a-hlfill" cx="415" cy="150" r="10"/>
   ${arrow([300, 220], [352, 220])}${pill(300, 66, "Take your water", { to: [276, 100] })}${pill(14, 100, "Roll your shoulders as you go", { to: [194, 76] })}`);

/** SVG for a stretch id, or "" when there's no illustration for it. */
export function stretchArt(id) {
  try { return ART[id] ? ART[id]().replace('viewBox="0 0 480 340"', 'viewBox="0 14 480 314"') : ""; } catch { return ""; }   // trim the empty strip above the figure
}
export const ART_IDS = Object.keys(ART);
