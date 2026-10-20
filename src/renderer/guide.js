// Desk-setup guide content. Written as data so a future version can localise or extend it.
export const GUIDE = {
  sit: {
    intro: "Set up your desk first, then calibrate. Calibration only measures how you sit — it can't tell if the desk itself is wrong.",
    steps: [
      { title: "Chair & feet", body: "Raise or lower your chair until your feet rest flat on the floor (or a footrest) and your thighs are roughly parallel to the floor. Knees about 90°, a fist of space behind your knees and the seat edge.", checks: ["knees"] },
      { title: "Back & hips", body: "Sit all the way back so your lower back is supported — adjust lumbar support or add a small cushion. Hips slightly above or level with your knees." },
      { title: "Arms & wrists", body: "Elbows near 90°, close to your sides, forearms level with the desk. Keep wrists straight — not bent up or resting on a hard desk edge. Shoulders relaxed, not shrugged.", checks: ["elbows", "shoulders"] },
      { title: "Screen height & distance", body: "Top of the screen at or just below eye level, so you look slightly down at the middle of it. About an arm's length away (50–70 cm). Tilt the screen back slightly. If you use a laptop, raise it on a stand with a separate keyboard.", checks: ["distance", "centered"] },
    ],
  },
  stand: {
    intro: "Standing needs its own setup — a desk that's right for sitting is almost never right for standing. Raise the desk first, then calibrate.",
    steps: [
      { title: "Feet & weight", body: "Feet about hip-width apart, weight even on both feet, knees soft (not locked). An anti-fatigue mat helps. Shift your stance every so often." },
      { title: "Arms & wrists", body: "Raise the desk until your elbows are about 90° with forearms level. Keep wrists straight and shoulders relaxed.", checks: ["elbows", "shoulders"] },
      { title: "Screen height & distance", body: "Top of the screen at or just below eye level, about an arm's length away. Standing tends to push the screen too low — check it again after raising the desk.", checks: ["distance", "centered"] },
      { title: "Head & spine", body: "Ears over shoulders, shoulders over hips. Imagine a string lifting the top of your head — no chin poke, no leaning on one hip." },
    ],
  },
};

export const CHECK_LABELS = {
  distance: "Distance from screen", shoulders: "Shoulders level", centered: "Centred on screen",
  elbows: "Elbow angle", knees: "Knee angle",
};
