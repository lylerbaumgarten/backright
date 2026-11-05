import { suggest, buildRoutine, WHERE, DISCLAIMER, totalSeconds, minutesLabel } from "./stretches.js";
import { createRoutine, countsAsBreak } from "./routine.js";
import { stretchArt } from "./stretch-art.js";

/** The illustration for a stretch (or nothing). Decorative-but-described: the steps below carry the real instructions. */
const artHtml = s => { const src = stretchArt(s.id); return src ? `<div class="s-art"><img src="${src}" alt="Illustration: ${esc(s.name)}" width="1024" height="765" decoding="async"></div>` : ""; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * The "Move" card on the home (Monitor) tab: a few stretch suggestions for where you are (at your desk / standing),
 * and a guided two-minute routine. Also started from the break reminder and the menu-bar menu.
 *
 * api: { where(): "desk"|"stand", setWhere(w), onBreak({ seconds, source }) }
 */
export function createMoveCard(root, api) {
  let shown = [], shownFor = null, runner = null, routineSteps = [], interval = null, last = 0, finished = null;

  const where = () => api.where();
  const refreshSuggestions = (exclude = []) => { shown = suggest(where(), { exclude }); shownFor = where(); };

  function stretchRow(s) {
    return `<li><details>
      <summary><span class="sname">${esc(s.name)}</span><span class="smeta">${minutesLabel(s.seconds)} · ${esc(s.target)}</span></summary>
      ${artHtml(s)}
      <ol>${s.steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol>
      <p class="cue">${esc(s.cue)}</p>${s.caution ? `<p class="caution">⚠ ${esc(s.caution)}</p>` : ""}
    </details></li>`;
  }

  function idleHtml() {
    if (!shown.length) refreshSuggestions();
    return `<div class="card-head"><h2>Move</h2>
        <div class="seg small" role="group" aria-label="Where are you?">${Object.entries(WHERE).map(([k, label]) => `<button data-where="${k}" class="${where() === k ? "on" : ""}">${label}</button>`).join("")}</div>
      </div>
      <p class="hint">${where() === "stand" ? "Quick ones you can do on your feet." : "Easy ones you can do without leaving your chair."} A couple of minutes of movement helps more than perfect posture.</p>
      <ul class="stretch-list">${shown.map(stretchRow).join("")}</ul>
      <div class="row"><button class="primary" data-act="routine">Start a 2-minute routine</button><button data-act="shuffle">Show others</button></div>
      <p class="hint tiny">${esc(DISCLAIMER)}</p>`;
  }

  function doneHtml() {
    const mins = Math.max(1, Math.round(finished.seconds / 60));
    return `<div class="routine-done">
        <h2>${finished.logged ? "Nice — that's a break" : "Routine stopped"}</h2>
        <p class="lead">${finished.logged ? `You moved for about ${mins} minute${mins > 1 ? "s" : ""}. I've counted it as a break.` : "No problem — a short stretch whenever you like."}</p>
        <div class="row"><button class="primary" data-act="close">Done</button><button data-act="routine">Another routine</button></div>
      </div>`;
  }

  function routineHtml(s) {
    const st = s.step;
    return `<div class="routine">
        <p class="eyebrow">Stretch ${s.index + 1} of ${s.total} · ${esc(WHERE[where()])}</p>
        <h2>${esc(st.name)}</h2>
        <div class="rt-clock"><b id="rtSeconds">${s.secondsLeft}</b><span>seconds</span></div>
        <div class="rt-bar"><i id="rtBar" style="width:${Math.round(s.progress * 100)}%"></i></div>
        ${artHtml(st)}
        <ol class="rt-steps">${st.steps.map(t => `<li>${esc(t)}</li>`).join("")}</ol>
        <p class="cue">${esc(st.cue)}</p>${st.caution ? `<p class="caution">⚠ ${esc(st.caution)}</p>` : ""}
        <div class="row"><button data-act="back">← Back</button><button data-act="${s.paused ? "resume" : "pause"}">${s.paused ? "Resume" : "Pause"}</button><button data-act="skip">Skip →</button><span class="spacer"></span><button class="ghost" data-act="stop">Stop</button></div>
      </div>`;
  }

  function render() {
    if (finished) root.innerHTML = doneHtml();
    else if (runner) root.innerHTML = routineHtml(runner.snapshot());
    else root.innerHTML = idleHtml();
  }

  // ---- routine control ----
  function begin(w) {
    stopTimer(); finished = null;
    routineSteps = buildRoutine(w ?? where());
    runner = createRoutine(routineSteps);
    last = performance.now(); interval = setInterval(tick, 250);
    render();
  }
  function stopTimer() { clearInterval(interval); interval = null; }
  function end(natural) {
    stopTimer();
    const elapsedMs = runner.snapshot().elapsedMs, logged = countsAsBreak(elapsedMs);
    runner = null; finished = { seconds: Math.round(elapsedMs / 1000), logged };
    if (logged) api.onBreak({ seconds: finished.seconds, source: "routine" });
    render();
  }
  function tick() {
    const now = performance.now(), before = runner.snapshot().index;
    const s = runner.tick(now - last); last = now;
    if (s.done) return end(true);
    if (s.index !== before) return render();                          // new stretch → rebuild
    const sec = root.querySelector("#rtSeconds"), bar = root.querySelector("#rtBar");
    if (sec) sec.textContent = s.secondsLeft;
    if (bar) bar.style.width = `${Math.round(s.progress * 100)}%`;
  }

  root.addEventListener("click", e => {
    const w = e.target.closest("[data-where]");
    if (w) { api.setWhere(w.dataset.where); shown = []; render(); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    switch (act) {
      case "shuffle": refreshSuggestions(shown.map(s => s.id)); render(); break;
      case "routine": begin(); break;
      case "pause": runner.pause(); render(); break;
      case "resume": last = performance.now(); runner.resume(); render(); break;
      case "skip": if (runner.skip().done) end(true); else render(); break;
      case "back": runner.back(); render(); break;
      case "stop": end(false); break;
      case "close": finished = null; render(); break;
    }
  });

  // No render here: the app calls refresh() once its settings have loaded (rendering needs them).
  return {
    /** Start a routine right now (used by the break reminder). */
    start(w) { begin(w); },
    isRunning: () => !!runner,
    /** Called on every settings change: only rebuild when the "where" really changed, so expanded stretches stay open. */
    refresh() { if (!runner && !finished && shownFor !== where()) { shown = []; render(); } },
  };
}
