// Desk-setup guide content. Written as data so a future version can localise or extend it.
//   art:    which illustration to draw (see guide-art.js)
//   body:   one-sentence lead
//   points: the specifics, shown as a short list
//   short:  one-liner used on the "your turn" checklist
//   checks: which live camera checks relate to this step
export const GUIDE = {
  sit: {
    intro: "Set up your desk first, then calibrate. Calibration only measures how you sit — it can't tell if the desk itself is wrong.",
    overview: { art: "compare", title: "What you're aiming for",
      body: "Good sitting posture is supported and stacked — not held up by effort.",
      points: ["Head over shoulders, shoulders over hips", "Lower back supported by the chair, not rounded", "Screen and keyboard positioned so you never have to reach or crane"] },
    steps: [
      { art: "feet", title: "Chair & feet", checks: ["knees"],
        body: "Start from the ground up: your chair height sets everything else.",
        short: "Feet flat, knees about 90°",
        points: ["Feet flat on the floor (or a footrest)", "Thighs roughly level, knees about 90°", "A fist of space between the seat edge and the back of your knees"] },
      { art: "back", title: "Back & hips",
        body: "Let the chair do the work of holding your lower back.",
        short: "Sit back, lower back supported",
        points: ["Sit all the way back in the chair", "Lower back supported — use the lumbar adjustment or a small cushion", "Hips level with, or slightly above, your knees"] },
      { art: "arms", title: "Arms & wrists", checks: ["elbows", "shoulders"],
        body: "Adjust the desk or armrests so your arms hang naturally.",
        short: "Elbows about 90°, wrists straight",
        points: ["Elbows near 90°, close to your sides", "Forearms level with the desk", "Wrists straight and shoulders relaxed, not shrugged"] },
      { art: "screen", title: "Screen height & distance", checks: ["distance", "centered"],
        body: "Put the screen where you don't have to crane or hunch to see it.",
        short: "Screen top at eye level, arm's length",
        points: ["Top of the screen at or just below eye level", "About an arm's length away (50–70 cm)", "On a laptop, raise it on a stand and use a separate keyboard"] },
    ],
  },
  stand: {
    intro: "Standing needs its own setup — a desk that's right for sitting is almost never right for standing. Raise the desk first, then calibrate.",
    overview: { art: "compare", title: "What you're aiming for",
      body: "Good standing posture is a tall, balanced stack — not a lean on one hip or a lock in your knees.",
      points: ["Ears, shoulders, hips and ankles in one vertical line", "Knees soft, weight even on both feet", "Desk at elbow height and screen at eye level so nothing pulls you forward"] },
    steps: [
      { art: "feet", title: "Feet & weight",
        body: "A stable base makes standing all day far less tiring.",
        short: "Feet hip-width, weight even",
        points: ["Feet about hip-width apart", "Weight even on both feet, knees soft — don't lock them", "An anti-fatigue mat helps; shift your stance every so often"] },
      { art: "arms", title: "Arms & wrists", checks: ["elbows", "shoulders"],
        body: "Set the desk height from your elbows, not from habit.",
        short: "Desk at elbow height, wrists straight",
        points: ["Raise the desk until your elbows are about 90°", "Forearms level, wrists straight", "Shoulders relaxed, not shrugged"] },
      { art: "screen", title: "Screen height & distance", checks: ["distance", "centered"],
        body: "Standing tends to leave the screen too low — recheck after raising the desk.",
        short: "Screen top at eye level, arm's length",
        points: ["Top of the screen at or just below eye level", "About an arm's length away (50–70 cm)", "Look slightly down at the middle of the screen, not up or hunched"] },
      { art: "spine", title: "Head & spine",
        body: "Stack your head, shoulders and hips in one line.",
        short: "Ears over shoulders over hips",
        points: ["Ears over shoulders, shoulders over hips", "Imagine a string lifting the top of your head", "No chin poke, no leaning on one hip"] },
    ],
  },
};

export const CHECK_LABELS = {
  distance: "Distance from screen", shoulders: "Shoulders level", centered: "Centred on screen",
  elbows: "Elbow angle", knees: "Knee angle",
};
