// Illustrations for the stretches: bundled WebP images in img/stretch/<stretch id>.webp (no network).
// Same character, outfit and room as the desk-setup guide (see guide-art.js); generated from the prompts in
// docs/illustrations/gemini-style-guide.md.
//   stretchArt(id) → image path for a stretch id, or "" if there isn't one.

export const ART_IDS = [
  "neck-tilt", "chin-tuck", "shoulder-rolls", "seated-chest-opener", "seated-twist", "wrist-stretch", "figure-four", "upper-back-reach",
  "eye-break", "behind-back-opener", "hip-flexor", "calf-raises", "side-bend", "forward-fold", "wall-angels", "march", "walk-water",
];

export const stretchArt = id => ART_IDS.includes(id) ? `img/stretch/${id}.webp` : "";
