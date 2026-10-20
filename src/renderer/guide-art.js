// Side-view line illustrations for the desk-setup guide, drawn as inline SVG strings.
// One base scene per mode (sitting / standing) plus a per-step overlay that highlights what that
// step is about. Styling lives in style.css (.a-*) so it follows light/dark mode.

const W = 420, H = 296;
const svg = body => `<svg viewBox="0 0 ${W} ${H}" role="img" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
const text = (x, y, s, { anchor = "start", cls = "a-text" } = {}) => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`;
const lines = (x, y, arr, opts) => arr.map((s, i) => text(x, y + i * 14, s, opts)).join("");
const dot = (x, y, r = 4) => `<circle class="a-dot" cx="${x}" cy="${y}" r="${r}"/>`;
const arrowH = (x1, x2, y) =>
  `<g class="a-hl a-thin"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y}" x2="${x1 + 7}" y2="${y - 4}"/><line x1="${x1}" y1="${y}" x2="${x1 + 7}" y2="${y + 4}"/>` +
  `<line x1="${x2}" y1="${y}" x2="${x2 - 7}" y2="${y - 4}"/><line x1="${x2}" y1="${y}" x2="${x2 - 7}" y2="${y + 4}"/></g>`;

// ---- seated scene ----
const SIT = {
  eye: [166, 72], elbow: [152, 152], wrist: [206, 152], hip: [146, 186], knee: [206, 188], ankle: [208, 258],
  screenX: 296, screenTop: 82, floor: 268,
};
function sitScene() {
  return `
  <line class="a-furn" x1="20" y1="268" x2="404" y2="268"/>
  <!-- desk + monitor -->
  <rect class="a-furn a-fill" x="176" y="158" width="196" height="8" rx="2"/>
  <rect class="a-furn a-fill" x="352" y="166" width="6" height="102"/>
  <line class="a-furn" x1="300" y1="158" x2="300" y2="144"/><line class="a-furn" x1="284" y1="158" x2="316" y2="158"/>
  <rect class="a-furn a-fill" x="296" y="82" width="10" height="62" rx="3"/>
  <rect class="a-furn a-fill" x="196" y="153" width="40" height="5" rx="2"/>
  <!-- chair -->
  <rect class="a-furn a-fill" x="116" y="190" width="90" height="9" rx="4"/>
  <line class="a-furn a-thick" x1="123" y1="194" x2="117" y2="118"/>
  <line class="a-furn" x1="158" y1="199" x2="158" y2="252"/><line class="a-furn" x1="126" y1="254" x2="192" y2="254"/>
  <circle class="a-furn" cx="128" cy="262" r="5"/><circle class="a-furn" cx="190" cy="262" r="5"/>
  <!-- person -->
  <g class="a-line">
    <circle class="a-fill" cx="158" cy="74" r="17"/>
    <path d="M154 91 L150 104 L146 186 L206 188 L208 258 L208 266 L234 266"/>
    <path d="M150 104 L152 152 L206 152"/>
  </g>
  <circle class="a-eye" cx="166" cy="72" r="2.4"/>`;
}
const SIT_OVER = {
  feet: () => `
    <path class="a-hl a-arcline" d="M182 187 A24 24 0 0 0 207 212"/>
    ${text(168, 216, "90°", { anchor: "end", cls: "a-text a-hlt" })}
    <line class="a-hl a-thick" x1="198" y1="268" x2="240" y2="268"/>
    ${lines(244, 262, ["feet flat"])}
    ${text(116, 232, "knees level with", { anchor: "end" })}${text(116, 246, "or below hips", { anchor: "end" })}`,
  back: () => `
    <ellipse class="a-hlfill" cx="124" cy="160" rx="11" ry="28"/>
    <ellipse class="a-hl a-thin" cx="124" cy="160" rx="11" ry="28"/>
    ${lines(14, 150, ["lower back", "supported"], { })}
    <line class="a-hl a-thin a-dash" x1="146" y1="206" x2="206" y2="206"/>
    ${lines(214, 222, ["hips back in the seat"])}`,
  arms: () => `
    <path class="a-hl a-arcline" d="M151.2 132 A20 20 0 0 1 172 152"/>
    ${text(166, 138, "90°", { cls: "a-text a-hlt" })}
    <line class="a-hl a-thin a-dash" x1="206" y1="152" x2="262" y2="152"/>
    ${lines(186, 112, ["forearms level,", "wrists straight"])}
    ${dot(206, 152)}`,
  screen: () => `
    <line class="a-hl a-thin a-dash" x1="166" y1="72" x2="340" y2="72"/>
    <line class="a-line a-gaze a-dash" x1="166" y1="72" x2="296" y2="112"/>
    <rect class="a-hlfill" x="296" y="82" width="10" height="8" rx="2"/>
    ${arrowH(158, 296, 44)}
    ${text(227, 36, "about an arm's length", { anchor: "middle", cls: "a-text a-hlt" })}
    ${lines(318, 94, ["screen top at", "or below", "eye level"])}
    ${text(344, 66, "eye level", { cls: "a-text a-hlt a-small" })}`,
};

// ---- standing scene ----
const STAND = { eye: [162, 50], screenTop: 60 };
function standScene() {
  return `
  <line class="a-furn" x1="20" y1="268" x2="404" y2="268"/>
  <rect class="a-furn a-fill a-mat" x="108" y="266" width="112" height="7" rx="3"/>
  <rect class="a-furn a-fill" x="172" y="126" width="208" height="8" rx="2"/>
  <rect class="a-furn a-fill" x="372" y="134" width="6" height="134"/>
  <line class="a-furn" x1="310" y1="126" x2="310" y2="112"/><line class="a-furn" x1="294" y1="126" x2="326" y2="126"/>
  <rect class="a-furn a-fill" x="306" y="60" width="10" height="52" rx="3"/>
  <rect class="a-furn a-fill" x="186" y="121" width="40" height="5" rx="2"/>
  <g class="a-line">
    <circle class="a-fill" cx="154" cy="52" r="16"/>
    <path d="M152 68 L150 82 L150 150 L151 210 L150 258 L150 264 L178 264"/>
    <path d="M150 82 L150 120 L196 120"/>
  </g>
  <circle class="a-eye" cx="162" cy="50" r="2.4"/>`;
}
const STAND_OVER = {
  feet: () => `
    <rect class="a-hlfill" x="108" y="264" width="112" height="9" rx="3"/>
    <circle class="a-hl a-thin" cx="151" cy="210" r="9"/>
    ${lines(196, 214, ["weight even,", "knees soft"])}
    ${lines(230, 258, ["anti-fatigue mat"], { })}`,
  arms: () => `
    <path class="a-hl a-arcline" d="M150 102 A18 18 0 0 1 168 120"/>
    ${text(173, 108, "90°", { cls: "a-text a-hlt" })}
    <line class="a-hl a-thin a-dash" x1="196" y1="120" x2="252" y2="120"/>
    ${lines(190, 84, ["forearms level,", "wrists straight"])}
    ${dot(196, 120)}`,
  screen: () => `
    <line class="a-hl a-thin a-dash" x1="162" y1="50" x2="344" y2="50"/>
    <line class="a-line a-gaze a-dash" x1="162" y1="50" x2="306" y2="86"/>
    <rect class="a-hlfill" x="306" y="60" width="10" height="8" rx="2"/>
    ${arrowH(154, 306, 24)}
    ${text(230, 16, "about an arm's length", { anchor: "middle", cls: "a-text a-hlt" })}
    ${lines(326, 72, ["screen top at", "or below", "eye level"])}
    ${text(348, 44, "eye level", { cls: "a-text a-hlt a-small" })}`,
  spine: () => `
    <line class="a-hl a-thin a-dash" x1="151" y1="26" x2="151" y2="266"/>
    ${dot(154, 52)}${dot(150, 82)}${dot(150, 150)}${dot(150, 258)}
    ${lines(178, 150, ["ears, shoulders,", "hips and ankles", "in one line"])}`,
};

/** Illustration for a guide step: art("sit" | "stand", "feet" | "back" | "arms" | "screen" | "spine"). */
export function art(mode, key) {
  const standing = mode === "stand";
  const over = (standing ? STAND_OVER : SIT_OVER)[key];
  if (!over) return "";
  return svg((standing ? standScene() : sitScene()) + over());
}
