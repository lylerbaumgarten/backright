const q = new URLSearchParams(location.search);
const [sw, sh, ox, oy] = ["sw", "sh", "ox", "oy"].map(k => +q.get(k) || 0);
const glow = document.getElementById("glow");

// This window is a strip of the screen at (ox, oy); draw the full-screen glow offset so only that slice shows.
Object.assign(glow.style, { left: `${-ox}px`, top: `${-oy}px`, width: `${sw}px`, height: `${sh}px` });

window.posture.onOverlayState(({ warning, glow: g }) => glow.classList.toggle("on", warning && g));
