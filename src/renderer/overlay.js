const glow = document.getElementById("glow"), pill = document.getElementById("pill");
window.posture.onOverlayState(({ warning, glow: g, pill: p }) => {
  glow.classList.toggle("on", warning && g);
  pill.classList.toggle("on", warning && p);
});
