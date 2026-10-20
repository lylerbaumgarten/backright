import { GUIDE, CHECK_LABELS } from "./guide.js";
import { art } from "./guide-art.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const modeWord = m => (m === "sit" ? "sitting" : "standing");

/**
 * First-run walkthrough: Welcome → illustrated desk-setup steps → "your turn" → Calibrate → Done.
 * Desk setup can be skipped at any point (it jumps to Calibrate and points at the Desk setup tab);
 * calibration can be deferred too. `api` is the small slice of app.js this needs.
 */
export function createWizard(root, api) {
  let step = 0, steps = [], skipped = false, calibrating = false, pvTimer = null, pvLastFrames = 0, pvTick = null;
  const ticked = new Set();

  const build = () => {
    const g = GUIDE[api.settings().mode];
    steps = [{ id: "welcome" }, { id: "overview" }, ...g.steps.map((_, i) => ({ id: "guide", i })), { id: "privacy" }, { id: "turn" }, { id: "calibrate" }, { id: "done" }];
  };
  const idx = id => steps.findIndex(s => s.id === id);
  const go = n => { step = Math.max(0, Math.min(steps.length - 1, n)); render(); root.scrollIntoView?.({ block: "start" }); };

  function phase() {
    const id = steps[step].id;
    const p = id === "calibrate" ? 2 : id === "done" ? 3 : 1;
    const label = (n, t) => `<li class="${p === n ? "on" : p > n ? "past" : ""}"><span>${p > n ? "✓" : n}</span>${t}</li>`;
    return `<ol class="phases">${label(1, "Desk setup")}${label(2, "Calibrate")}${label(3, "Start")}</ol>`;
  }
  const top = () => `<div class="wiz-top">${phase()}<button class="ghost" data-act="close" title="Leave setup — you can come back any time">Close</button></div>`;

  function nav({ back = true, next = "Next", skip = null, nextAct = "next", nextDisabled = false } = {}) {
    return `<div class="row wiz-nav">
      ${back ? `<button data-act="back">← Back</button>` : ""}
      <span class="spacer"></span>
      ${skip ? `<button class="ghost" data-act="${skip.act}">${skip.label}</button>` : ""}
      <button class="primary" data-act="${nextAct}" ${nextDisabled ? "disabled" : ""}>${next}</button>
    </div>`;
  }

  function checksHtml() {
    const g = GUIDE[api.settings().mode];
    const keys = [...new Set(g.steps.flatMap(s => s.checks || []))];
    return keys.map(k => `<li class="unknown"><span class="ic">–</span><span><b>${CHECK_LABELS[k]}:</b> Looking for you…</span></li>`).join("");
  }

  function render() {
    const s = api.settings(), mode = s.mode, g = GUIDE[mode], cur = steps[step];
    let html = "";
    clearInterval(pvTimer); api.placeStage(null);   // rescue the preview element before innerHTML replaces the card

    if (cur.id === "welcome") {
      html = `${top()}
        <h2>Let's get you set up</h2>
        <p class="lead">Two quick things, about three minutes: first set up your desk so good posture is easy, then calibrate so the app learns what <i>your</i> good posture looks like.</p>
        <p class="hint">Do you mostly sit or stand?</p>
        <div class="choice" role="group">
          <button data-mode="sit" class="${mode === "sit" ? "on" : ""}"><b>Sitting</b><small>Desk and chair</small></button>
          <button data-mode="stand" class="${mode === "stand" ? "on" : ""}"><b>Standing</b><small>Sit-stand desk, raised</small></button>
        </div>
        <p class="hint">Have a sit-stand desk? Do this once for each — switch with the Sitting / Standing control after setup.</p>
        <div class="row wiz-nav"><span class="spacer"></span><button class="ghost" data-act="skipSetup">Skip desk setup</button><button class="primary" data-act="next">Start desk setup →</button></div>`;
    }

    else if (cur.id === "overview") {
      const o = g.overview;
      html = `${top()}
        <p class="eyebrow">Desk setup · the goal</p>
        <h2>${esc(o.title)}</h2>
        <div class="art">${art(mode, o.art)}</div>
        <p class="lead">${esc(o.body)}</p>
        <ul class="points">${o.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
        ${nav({ skip: { act: "skipSetup", label: "Skip desk setup" }, next: "Show me how →" })}`;
    }

    else if (cur.id === "guide") {
      const st = g.steps[cur.i];
      html = `${top()}
        <p class="eyebrow">Desk setup · step ${cur.i + 1} of ${g.steps.length}</p>
        <h2>${esc(st.title)}</h2>
        <div class="art">${art(mode, st.art)}</div>
        <p class="lead">${esc(st.body)}</p>
        <ul class="points">${st.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
        ${nav({ skip: { act: "skipSetup", label: "Skip desk setup" } })}`;
    }

    else if (cur.id === "privacy") {
      const live = api.live();
      html = `${top()}
        <p class="eyebrow">Before we use the camera</p>
        <h2>Your camera stays on this Mac</h2>
        <p class="lead">Posture watches your head and shoulders through the webcam. Here's exactly what happens to the video:</p>
        <ul class="promises">
          <li><span class="tick">✓</span><div><b>Analysed here, never uploaded.</b> A small pose model runs inside this app. There's no account and no server.</div></li>
          <li><span class="tick">✓</span><div><b>Never saved.</b> Each frame is checked in memory, then thrown away. Only a few numbers (like head height) are kept for a moment.</div></li>
          <li><span class="tick">✓</span><div><b>Works with no internet.</b> The app blocks every outside connection — don't take our word for it, try it:</div></li>
        </ul>
        <div class="card inner privacy-test">
          <h3>Try it yourself</h3>
          <ol class="mini-steps">
            <li>Turn on the camera preview.</li>
            <li>Turn off Wi-Fi (the Wi-Fi icon in your menu bar).</li>
            <li>Watch: it keeps tracking you, with no connection at all.</li>
          </ol>
          <div id="privacySlot"></div>
          <div class="pv-stats">
            <div><span>Wi-Fi</span><b id="pvNet">–</b></div>
            <div><span>Frames analysed here</span><b id="pvFrames">0</b></div>
            <div><span>Outside connections made</span><b id="pvBlocked">0</b></div>
          </div>
          <p class="pv-msg" id="pvMsg"></p>
          ${api.cameraBlocked() ? `<div class="notice warn"><b>Camera access is off.</b> <div class="row"><button class="primary" data-act="camSettings">Open Camera settings</button><button data-act="relaunch">Restart app</button></div></div>` : ""}
          <button id="pvPreview">${live ? "Turn off preview" : "Turn on camera preview"}</button>
        </div>
        <div class="row wiz-nav">
          <button data-act="privacyBack">← Back</button><span class="spacer"></span>
          <button class="primary" data-act="privacyNext">Continue</button>
        </div>`;
    }

    else if (cur.id === "turn") {
      html = `${top()}
        <p class="eyebrow">Desk setup · your turn</p>
        <h2>Now set up your desk</h2>
        <p class="lead">Take a minute — adjust your ${mode === "sit" ? "chair, desk and screen" : "desk and screen"} to match the pictures. Tick each one as you go.</p>
        <ul class="todo">${g.steps.map((st, i) => `<li><label><input type="checkbox" data-tick="${i}" ${ticked.has(i) ? "checked" : ""}> <b>${esc(st.title)}</b> <span>${esc(st.short)}</span></label></li>`).join("")}</ul>
        <div class="card inner">
          <h3>Want a second opinion?</h3>
          <p class="hint">The camera can check distance, centring and shoulders — and elbows or knees if they're in frame. It's a rough guide, not a verdict.</p>
          <button id="wizLive">${api.live() ? "Stop camera check" : "Check with my camera"}</button>
          <ul class="checks live-checklist" ${api.live() ? "" : "hidden"}>${checksHtml()}</ul>
        </div>
        ${nav({ next: "I'm set up →", nextAct: "setupDone", skip: { act: "skipSetup", label: "Skip for now" } })}`;
    }

    else if (cur.id === "calibrate") {
      const standing = mode === "stand";
      const note = skipped
        ? `<div class="notice warn"><b>Desk setup skipped.</b> You can do it any time from the <b>Desk setup</b> tab at the top — we've highlighted where it is.</div>`
        : s.setupDone[mode] ? `<div class="notice"><b>Desk set up.</b> Nice. Now let's record how you hold yourself there.</div>` : "";
      const fail = api.notice();
      html = `${top()}
        ${note}
        <h2>Calibrate your alignment</h2>
        <p class="lead">${standing ? "Stand" : "Sit"} the way you want to hold — tall, relaxed, looking at the screen, with your head and shoulders in the camera's view.</p>
        <ul class="points">
          <li>Press start — you get 4 seconds to get into position</li>
          <li>Then hold still for 3 seconds while it measures</li>
          <li>You can recalibrate any time from the Monitor tab</li>
        </ul>
        ${fail ? `<p class="notice warn">${esc(fail)}</p>` : ""}
        ${api.cameraBlocked() ? `<div class="notice warn"><b>Camera access is off.</b> <div class="row"><button class="primary" data-act="camSettings">Open Camera settings</button><button data-act="relaunch">Restart app</button></div></div>` : ""}
        <div class="row wiz-nav">
          ${skipped ? "" : `<button data-act="back">← Back</button>`}
          <span class="spacer"></span>
          <button class="ghost" data-act="later">Do this later</button>
          <button class="primary" data-act="calibrate" ${calibrating ? "disabled" : ""}>${calibrating ? "Calibrating…" : "Start calibration"}</button>
        </div>`;
    }

    else { // done
      const calibrated = !!s.baselines[mode];
      html = `${top()}
        <h2>${calibrated ? "You're all set" : "Setup finished"}</h2>
        <p class="lead">${calibrated ? "Monitoring will nudge you with a soft glow around the screen when your posture slips." : "You haven't calibrated yet — do it from the Monitor tab when you're ready."}</p>
        <p class="hint">Where to find things later:</p>
        <ul class="points">
          <li><b>Desk setup tab</b> — the illustrated guide${skipped ? ", which you skipped for now" : ""}, and the camera check</li>
          <li><b>Monitor tab</b> — recalibrate, sensitivity, test the nudge</li>
          <li><b>Menu-bar icon</b> — pause monitoring, switch Sitting / Standing</li>
          <li><b>Sit-stand desk?</b> Switch to the other mode at the top right and set it up too</li>
        </ul>
        <div class="row wiz-nav"><span class="spacer"></span><button data-act="finish">Finish</button>${calibrated ? `<button class="primary" data-act="finishStart">Start monitoring</button>` : ""}</div>`;
    }
    root.innerHTML = html;
    api.hintDeskSetup(cur.id === "calibrate" && skipped);
    if (cur.id === "privacy") startPrivacyStats();
  }

  // Live evidence on the privacy step: Wi-Fi state, frames analysed, outside connections attempted.
  function startPrivacyStats() {
    if (api.live()) api.placeStage(root.querySelector("#privacySlot"));
    pvLastFrames = api.stats().frames;
    const tick = async () => {
      const net = root.querySelector("#pvNet"); if (!net) return;
      const online = navigator.onLine, { frames } = api.stats(), moving = frames > pvLastFrames; pvLastFrames = frames;
      net.textContent = online ? "On" : "Off"; net.className = online ? "" : "off";
      root.querySelector("#pvFrames").textContent = frames;
      try { root.querySelector("#pvBlocked").textContent = (await api.privacyStats()).blocked; } catch { /* stats are best-effort */ }
      const msg = root.querySelector("#pvMsg"), live = api.live();
      msg.className = "pv-msg" + (!online && live && moving ? " good" : "");
      msg.textContent = !live ? (online ? "" : "You're offline — turn on the preview to see it still works.")
        : !online ? (moving ? "✓ No internet, and the posture check is still running." : "Offline — waiting for the camera…")
        : "Now turn off Wi-Fi and watch the counter keep going.";
    };
    pvTick = tick; tick(); pvTimer = setInterval(tick, 700);
  }
  for (const ev of ["online", "offline"]) window.addEventListener(ev, () => pvTick?.());   // instant feedback when Wi-Fi flips

  root.addEventListener("click", async e => {
    const modeBtn = e.target.closest("[data-mode]");
    if (modeBtn) { await api.setMode(modeBtn.dataset.mode); build(); render(); return; }
    if (e.target.id === "wizLive" || e.target.id === "pvPreview") { api.toggleLive(); render(); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    switch (act) {
      case "next": go(step + 1); break;
      case "back": go(step - 1); break;
      case "skipSetup": skipped = true; go(idx("privacy")); break;            // still explain the camera before first use
      case "privacyBack": api.setLive(false); if (skipped) { skipped = false; go(0); } else go(step - 1); break;
      case "privacyNext": api.setLive(false); go(skipped ? idx("calibrate") : idx("turn")); break;
      case "setupDone": api.setLive(false); await api.markSetupDone(); skipped = false; go(idx("calibrate")); break;
      case "calibrate":
        calibrating = true; render();
        api.calibrate(ok => { calibrating = false; ok ? go(idx("done")) : render(); });
        break;
      case "later": api.hintDeskSetup(false); go(idx("done")); break;
      case "camSettings": api.openCameraSettings(); break;
      case "relaunch": api.relaunch(); break;
      case "close": case "finish": await close(false); break;
      case "finishStart": await close(true); break;
    }
  });
  root.addEventListener("change", e => {
    const t = e.target.dataset?.tick; if (t === undefined) return;
    e.target.checked ? ticked.add(+t) : ticked.delete(+t);
  });

  async function close(start) { clearInterval(pvTimer); api.placeStage(null); api.setLive(false); await api.finish({ start, skippedSetup: skipped }); }

  return {
    /** fromGuide: skip the welcome screen (replay from the Desk setup tab or the reminder banner). */
    start({ fromGuide = false } = {}) { skipped = false; calibrating = false; ticked.clear(); build(); step = fromGuide ? 1 : 0; render(); },
    refresh() { if (steps.length) render(); },
  };
}
