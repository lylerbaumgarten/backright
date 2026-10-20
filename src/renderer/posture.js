// Pure posture maths — no DOM, no camera, no I/O — so it is unit-testable and
// provably only ever sees landmark numbers, never pixels.

export const LM = { NOSE: 0, L_EAR: 7, R_EAR: 8, L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14,
                    L_WRIST: 15, R_WRIST: 16, L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28 };

// Deviation from baseline that counts as "slipping" at sensitivity 1.
export const BASE_THRESH = { slouch: 0.12, lean: 0.15, tilt: 6 };

const seen = p => p && (p.visibility ?? 1) >= 0.5;

/** Reduce a pose to the three numbers we track, or null if shoulders/nose aren't visible. */
export function measure(lm) {
  const nose = lm[LM.NOSE], ls = lm[LM.L_SHOULDER], rs = lm[LM.R_SHOULDER];
  if (![nose, ls, rs].every(seen)) return null;
  const sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  if (sw < 0.05) return null;
  return {
    neck: ((ls.y + rs.y) / 2 - nose.y) / sw,                      // head height above shoulders, in shoulder-widths
    size: sw,                                                     // shoulder width in frame ≈ distance to camera
    tilt: Math.atan2(rs.y - ls.y, rs.x - ls.x) * 180 / Math.PI,   // shoulder line angle (deg)
  };
}

export function average(samples) {
  const out = {};
  for (const k of Object.keys(samples[0])) out[k] = samples.reduce((a, s) => a + s[k], 0) / samples.length;
  return out;
}

/** Signed/abs deviation of the current measurement from the calibrated baseline. */
export function deviation(baseline, m) {
  return {
    slouch: (baseline.neck - m.neck) / baseline.neck,  // + = head sinking toward shoulders
    lean: m.size / baseline.size - 1,                  // + = closer to the screen
    tilt: Math.abs(m.tilt - baseline.tilt),
  };
}

/**
 * Stateful monitor: smooths deviations, then requires bad posture to persist for
 * `delayMs` before warning, and good posture for `recoverMs` before clearing.
 * Time is injected so tests don't need clocks.
 */
export function createMonitor({ alpha = 0.3, recoverMs = 1500 } = {}) {
  let smooth = { slouch: 0, lean: 0, tilt: 0 };
  let badSince = null, goodSince = null, warned = false;
  return {
    reset() { smooth = { slouch: 0, lean: 0, tilt: 0 }; badSince = goodSince = null; warned = false; },
    update(baseline, m, now, { sensitivity = 1, delayMs = 4000, alpha: a = alpha } = {}) {
      const raw = deviation(baseline, m);
      for (const k in raw) smooth[k] += a * (raw[k] - smooth[k]);
      const t = { slouch: BASE_THRESH.slouch / sensitivity, lean: BASE_THRESH.lean / sensitivity, tilt: BASE_THRESH.tilt / sensitivity };
      const bad = smooth.slouch > t.slouch || smooth.lean > t.lean || smooth.tilt > t.tilt;
      if (bad) { goodSince = null; badSince ??= now; } else { badSince = null; goodSince ??= now; }
      if (bad && !warned && now - badSince >= delayMs) warned = true;
      if (!bad && warned && now - goodSince >= recoverMs) warned = false;
      return { bad, warned, smooth: { ...smooth } };
    },
  };
}

function angle(a, b, c) { // angle at b, degrees
  const v1 = [a.x - b.x, a.y - b.y], v2 = [c.x - b.x, c.y - b.y];
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2));
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
}

/**
 * Best-effort live checks for the desk-setup guide. A desk webcam usually only frames head,
 * shoulders and maybe arms, so anything not visible comes back as `unknown` and the UI falls
 * back to the written checklist rather than guessing.
 * status: "ok" | "adjust" | "unknown"
 */
export function setupChecks(lm, { standing = false } = {}) {
  const m = lm && measure(lm);
  if (!m) return { distance: unk(), shoulders: unk(), centered: unk(), elbows: unk(), knees: unk() };
  const nose = lm[LM.NOSE];
  const out = {};
  out.distance = m.size > 0.62 ? { status: "adjust", note: "Too close — move back to about an arm's length." }
               : m.size < 0.28 ? { status: "adjust", note: "A bit far — bring your chair or yourself closer." }
               : { status: "ok", note: "Distance looks about right." };
  out.shoulders = Math.abs(m.tilt) > 4 ? { status: "adjust", note: "One shoulder is higher — relax both down." }
                                       : { status: "ok", note: "Shoulders level." };
  out.centered = Math.abs(nose.x - 0.5) > 0.14 ? { status: "adjust", note: "Centre yourself in front of the screen." }
                                              : { status: "ok", note: "Centred on the screen." };
  const elbow = [[LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST], [LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST]]
    .filter(t => t.every(i => seen(lm[i]))).map(([a, b, c]) => angle(lm[a], lm[b], lm[c]));
  out.elbows = elbow.length ? (Math.min(...elbow) < 75 || Math.max(...elbow) > 135
      ? { status: "adjust", note: "Aim for elbows near 90°, close to your sides." } : { status: "ok", note: "Elbow angle looks good." }) : unk();
  const knee = standing ? [] : [[LM.L_HIP, LM.L_KNEE, LM.L_ANKLE], [LM.R_HIP, LM.R_KNEE, LM.R_ANKLE]]
    .filter(t => t.every(i => seen(lm[i]))).map(([a, b, c]) => angle(lm[a], lm[b], lm[c]));
  out.knees = knee.length ? (Math.min(...knee) < 75 || Math.max(...knee) > 125
      ? { status: "adjust", note: "Knees should sit near 90° with feet flat." } : { status: "ok", note: "Knee angle looks good." }) : unk();
  return out;
}
const unk = () => ({ status: "unknown", note: "Not in frame — use the checklist." });
