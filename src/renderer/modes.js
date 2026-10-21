// Which postures the person actually works in: sitting, standing, or both (a sit-stand desk). Pure; no DOM.
// `settings.modes` is null until they choose (v0.1 settings files have no such key) — null means "both", so upgrading
// changes nothing.
export const ALL_MODES = ["sit", "stand"];

/** The enabled modes, in sit → stand order. Never empty. */
export function enabledModes(settings) {
  const m = settings?.modes;
  if (!Array.isArray(m)) return [...ALL_MODES];
  const ok = ALL_MODES.filter(x => m.includes(x));
  return ok.length ? ok : [...ALL_MODES];
}

/** Turn one mode on or off. Refuses to leave nothing selected (returns the list unchanged). */
export function withMode(modes, which, on) {
  const next = ALL_MODES.filter(m => (m === which ? on : modes.includes(m)));
  return next.length ? next : [...modes];
}

/** The mode to be in: the current one if it's still enabled, otherwise the first enabled one. */
export function currentMode(settings) {
  const modes = enabledModes(settings);
  return modes.includes(settings?.mode) ? settings.mode : modes[0];
}
