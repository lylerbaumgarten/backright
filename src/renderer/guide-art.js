// Illustrations for the desk-setup guide: bundled WebP images in img/guide/<mode>-<key>.webp (no network).
// They share one friendly flat-vector character and room with the stretch illustrations (img/stretch/),
// generated from the prompts in docs/illustrations/gemini-style-guide.md. Marks that used to be drawn in code
// (angles, eye-level lines, distances) are baked into the pictures; the wording lives in guide.js.

const ALT = {
  sit: {
    compare: "Two side views of the same person at a desk: slouched with head forward and a rounded back on the left, upright and supported with ears over shoulders over hips on the right.",
    feet: "Person sitting with both feet flat on the floor and knees at about 90 degrees, with a fist of space behind the knees.",
    back: "Person sitting all the way back in the chair with a small cushion supporting the lower back.",
    arms: "Person typing with elbows at about 90 degrees, forearms level with the desk and wrists straight.",
    screen: "Person looking straight ahead at a monitor whose top edge is level with their eyes, about an arm's length away.",
  },
  stand: {
    compare: "Two side views of the same person at a standing desk: slumped with locked knees and head forward on the left, tall and balanced on the right.",
    feet: "Person standing on an anti-fatigue mat with feet hip-width apart and weight even.",
    arms: "Person at a standing desk with the desk at elbow height, elbows at about 90 degrees and wrists straight.",
    screen: "Person standing tall looking at a monitor whose top edge is level with their eyes, about an arm's length away.",
    spine: "Person standing tall with ears, shoulders, hips and ankles on one vertical line and soft knees.",
  },
};

/** <img> markup for art("sit" | "stand", "compare" | "feet" | "back" | "arms" | "screen" | "spine"). Unknown key → "". */
export function art(mode, key) {
  const alt = ALT[mode]?.[key];
  return alt ? `<img src="img/guide/${mode}-${key}.webp" alt="${alt}" width="1024" height="${key === "compare" ? 506 : 765}" decoding="async">` : "";
}

export const GUIDE_ART = Object.entries(ALT).flatMap(([mode, keys]) => Object.keys(keys).map(key => `${mode}-${key}`));
