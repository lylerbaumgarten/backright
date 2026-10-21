const pill = document.getElementById("pill"), msg = document.getElementById("msg");
const MESSAGES = { posture: "Sit tall — head back, shoulders down", break: "Time to move — a quick stretch?" };

window.posture.onOverlayState(({ kind, pill: showPosturePill }) => {
  // A posture nudge honours the "Reminder pill" setting; a move reminder is the whole point, so it always shows.
  const show = kind === "posture" ? showPosturePill : kind === "break";
  if (kind) {                                   // keep the last message while it fades out
    msg.textContent = MESSAGES[kind];
    pill.classList.toggle("break", kind === "break");
    document.getElementById("postureBtns").hidden = kind !== "posture";
    document.getElementById("breakBtns").hidden = kind !== "break";
  }
  pill.classList.toggle("on", !!show);
});

const act = a => () => window.posture.pillAction(a);
document.getElementById("pause").onclick = act("pause");
document.getElementById("settings").onclick = act("settings");
document.getElementById("breakShow").onclick = act("break-show");
document.getElementById("breakSnooze").onclick = act("break-snooze");
document.getElementById("breakSkip").onclick = act("break-skip");
