// The movement library: short, easy stretches grouped by where you can do them.
//   where: "desk"  — seated, at your desk
//          "stand" — easy to stand up and do
// Wording is plain-language general ergonomics advice, not medical advice (see DISCLAIMER). Every entry has a
// short `cue` (what you should feel / the one thing to get right) and, where it matters, a `caution`.

export const DISCLAIMER = "Move gently and stop if anything hurts. These are general suggestions, not medical advice.";

export const STRETCHES = [
  // ---------- at your desk ----------
  { id: "neck-tilt", where: ["desk"], name: "Neck side tilt", seconds: 30, target: "neck",
    steps: ["Sit tall and let both shoulders drop away from your ears.", "Tilt your right ear toward your right shoulder — don't lift the shoulder to meet it.", "Hold for 15 seconds, breathing slowly, then switch sides."],
    cue: "A gentle stretch along the side of the neck.", caution: "No pulling with your hand, and stop if you feel tingling or pain." },
  { id: "chin-tuck", where: ["desk"], name: "Chin tucks", seconds: 30, target: "neck",
    steps: ["Sit tall, eyes level.", "Glide your chin straight back, as if making a gentle double chin — don't tip your head down.", "Hold 3 seconds, release, and repeat about 8 times."],
    cue: "The back of your neck lengthens; it's a small movement.", caution: null },
  { id: "shoulder-rolls", where: ["desk"], name: "Shoulder rolls", seconds: 20, target: "shoulders",
    steps: ["Lift your shoulders up toward your ears.", "Roll them back and down in a big, slow circle.", "Do about 10, then reverse for 5."],
    cue: "Loose and easy — no force.", caution: null },
  { id: "seated-chest-opener", where: ["desk"], name: "Seated chest opener", seconds: 30, target: "chest",
    steps: ["Sit tall near the front of your chair.", "Put your hands behind your head, or clasp them behind your back.", "Draw your elbows back and lift your chest slightly. Hold 15–20 seconds and keep breathing."],
    cue: "A stretch across the front of the chest — the opposite of hunching.", caution: "Don't arch your lower back; keep your ribs down." },
  { id: "seated-twist", where: ["desk"], name: "Seated spinal twist", seconds: 40, target: "back",
    steps: ["Sit tall with both feet flat.", "Put your right hand on your left knee and your left hand on the chair back or behind you.", "Turn gently to look over your left shoulder. Hold 20 seconds, then switch sides."],
    cue: "Rotation through the middle of the back; lead with your chest, not your chin.", caution: "Turn only as far as is comfortable." },
  { id: "wrist-stretch", where: ["desk"], name: "Wrist and forearm stretch", seconds: 40, target: "wrists",
    steps: ["Reach your right arm out, palm up, and use your left hand to ease the fingers down and back for 15 seconds.", "Turn the palm down and gently press the back of the hand toward you for 15 seconds.", "Switch arms."],
    cue: "A mild stretch along the forearm, never in the joint.", caution: "Gentle pressure only; stop if you feel pins and needles." },
  { id: "figure-four", where: ["desk"], name: "Seated figure-four (hips)", seconds: 40, target: "hips",
    steps: ["Sit tall and cross your right ankle over your left knee.", "Keep your back long and lean forward slightly until you feel the stretch in your right hip.", "Hold 20 seconds, then switch sides."],
    cue: "A stretch deep in the hip and glute.", caution: "Skip it if it bothers your knee." },
  { id: "upper-back-reach", where: ["desk"], name: "Upper-back reach", seconds: 30, target: "upper back",
    steps: ["Interlace your fingers and push your palms away from you at chest height.", "Round your upper back and let your head drop between your arms.", "Hold 15 seconds, then slowly sit tall again."],
    cue: "A stretch between the shoulder blades.", caution: null },
  { id: "eye-break", where: ["desk", "stand"], name: "20-20-20 eye break", seconds: 20, target: "eyes",
    steps: ["Look at something at least 20 feet (6 metres) away — out of a window is ideal.", "Keep looking for 20 seconds and blink slowly a few times."],
    cue: "Your eyes relax when they focus far away.", caution: null },

  // ---------- easy to stand up and do ----------
  { id: "behind-back-opener", where: ["stand"], name: "Behind-the-back chest opener", seconds: 30, target: "chest",
    steps: ["Stand tall, feet hip-width apart.", "Clasp your hands behind your back and straighten your arms.", "Squeeze your shoulder blades together and lift your chest. Hold 20–30 seconds."],
    cue: "The chest and the fronts of the shoulders open up.", caution: "Don't push your ribs forward; keep your core lightly braced." },
  { id: "hip-flexor", where: ["stand"], name: "Hip-flexor lunge stretch", seconds: 60, target: "hips",
    steps: ["Rest a hand on your desk for balance and step your right foot back into a short lunge.", "Tuck your tailbone under and let your hips drift slightly forward.", "Hold 30 seconds, then switch legs."],
    cue: "A stretch along the front of the back leg's hip — sitting shortens it.", caution: "Keep your front knee over your ankle; skip it if it hurts your knee." },
  { id: "calf-raises", where: ["stand"], name: "Calf raises", seconds: 30, target: "legs",
    steps: ["Stand holding your desk for balance.", "Rise slowly onto your toes, pause, then lower slowly.", "Do about 15."],
    cue: "Wakes up the legs and gets blood moving.", caution: null },
  { id: "side-bend", where: ["stand"], name: "Standing side bend", seconds: 30, target: "back",
    steps: ["Stand with feet hip-width apart and reach your right arm overhead.", "Lean gently to the left, keeping both hips facing forward.", "Hold 15 seconds, then switch sides."],
    cue: "A long stretch down the side of the body.", caution: null },
  { id: "forward-fold", where: ["stand"], name: "Soft forward fold", seconds: 30, target: "legs",
    steps: ["Stand with feet hip-width apart and soften your knees.", "Hinge at the hips and let your head and arms hang heavy.", "Hold 20–30 seconds, then rise slowly, rolling up one vertebra at a time."],
    cue: "The backs of the legs and lower back let go.", caution: "Come up slowly if you feel dizzy; skip it if forward bending hurts your back." },
  { id: "wall-angels", where: ["stand"], name: "Wall angels", seconds: 40, target: "upper back",
    steps: ["Stand with your back to a wall and your feet a few inches out.", "Put your arms in a goalpost shape against the wall.", "Slide them up and down, keeping contact with the wall as best you can — about 8 times."],
    cue: "Works the muscles that hold your shoulders back.", caution: "Go only as far as is comfortable." },
  { id: "march", where: ["stand"], name: "March in place", seconds: 30, target: "legs",
    steps: ["Stand tall and march on the spot, lifting your knees comfortably high.", "Swing your arms in opposition and breathe easily."],
    cue: "A quick way to get your heart rate up a notch.", caution: null },
  { id: "walk-water", where: ["stand"], name: "Walk and refill your water", seconds: 120, target: "whole body",
    steps: ["Stand up and walk away from your desk — refill your water, or take a lap of the room.", "Roll your shoulders and look around as you walk."],
    cue: "Moving beats any single stretch.", caution: null },
];

export const WHERE = { desk: "At my desk", stand: "Stand up" };
const byWhere = where => STRETCHES.filter(s => s.where.includes(where));
export const get = id => STRETCHES.find(s => s.id === id) || null;

/** Fisher–Yates with an injectable rng, so tests are deterministic. */
function shuffled(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** A handful of suggestions for the home screen; `exclude` lets "Show others" avoid repeating what's on screen. */
export function suggest(where, { count = 3, exclude = [], rng = Math.random } = {}) {
  const pool = byWhere(where);
  const fresh = pool.filter(s => !exclude.includes(s.id));
  const picks = shuffled(fresh.length >= count ? fresh : pool, rng);
  const out = [], targets = new Set();
  for (const s of picks) if (out.length < count && !targets.has(s.target)) { out.push(s); targets.add(s.target); }   // vary the body area
  for (const s of picks) if (out.length < count && !out.includes(s)) out.push(s);
  return out;
}

/**
 * A guided routine of about two minutes: three different stretches (different body areas), never the very long
 * "walk" one, total time between minSeconds and maxSeconds when the pool allows it.
 */
export function buildRoutine(where, { minSeconds = 75, maxSeconds = 150, rng = Math.random } = {}) {
  const pool = byWhere(where).filter(s => s.seconds <= 60);
  for (let attempt = 0; attempt < 50; attempt++) {
    const picks = [], targets = new Set();
    for (const s of shuffled(pool, rng)) if (picks.length < 3 && !targets.has(s.target)) { picks.push(s); targets.add(s.target); }
    const total = picks.reduce((n, s) => n + s.seconds, 0);
    if (picks.length === 3 && total >= minSeconds && total <= maxSeconds) return picks;
  }
  return shuffled(pool, rng).slice(0, 3);   // pool too uniform to hit the window — still three stretches
}

export const totalSeconds = list => list.reduce((n, s) => n + s.seconds, 0);
export const minutesLabel = seconds => seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 6) / 10} min`.replace(".0", "");
