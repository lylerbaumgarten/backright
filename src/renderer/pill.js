const pill = document.getElementById("pill");
window.posture.onOverlayState(({ warning, pill: p }) => pill.classList.toggle("on", warning && p));
document.getElementById("pause").onclick = () => window.posture.pillAction("pause");
document.getElementById("settings").onclick = () => window.posture.pillAction("settings");
