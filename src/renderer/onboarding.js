import { GUIDE, CHECK_LABELS } from "./guide.js";
import { art } from "./guide-art.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const modeWord = m => (m === "sit" ? "sitting" : "standing");

/**
 * First-run walkthrough: Welcome → Camera & privacy → Calibrate → Done.
 * The illustrated desk-setup guide is an optional sub-page, opened from the Calibrate step ("Desk setup guide"),
 * so the main path stays short but the detail is one click away. It can also be opened straight from the Desk setup
 * tab / the reminder banner (start({ fromGuide: true })). `api` is the small slice of app.js this needs.
 *
 * `sub` is null on the main path, otherwise which guide page is showing: -1 overview, 0..n-1 the steps, n the check page.
 */
export function createWizard(root, api) {
  const STEPS = ["welcome", "privacy", "calibrate", "done"];
  let step = 0, sub = null, calibrating = false, pvTimer = null, pvLastFrames = 0, pvTick = null;
  const ticked = new Set();

  const guide = () => GUIDE[api.settings().mode];
  const go = n => { step = Math.max(0, Math.min(STEPS.length - 1, n)); sub = null; render(); root.scrollIntoView?.({ block: "start" }); };
  const goStep = id => go(STEPS.indexOf(id));

  function phase() {
    const p = { welcome: 1, privacy: 1, calibrate: 2, done: 3 }[STEPS[step]];
    const label = (n, t) => `<li class="${p === n ? "on" : p > n ? "past" : ""}"><span>${p > n ? "✓" : n}</span>${t}</li>`;
    return `<ol class="phases">${label(1, "Camera")}${label(2, "Calibrate")}${label(3, "Start")}</ol>`;
  }
  const top = () => `<div class="wiz-top">${phase()}<button class="ghost" data-act="close" title="Leave setup — you can come back any time">Close</button></div>`;

  const blockedNotice = () => api.cameraBlocked()
    ? `<div class="notice warn"><b>Camera access is off.</b> <div class="row"><button class="primary" data-act="camSettings">Open Camera settings</button><button data-act="relaunch">Restart app</button></div></div>` : "";

  function checksHtml() {
    const keys = [...new Set(guide().steps.flatMap(s => s.checks || []))];
    return keys.map(k => `<li class="unknown"><span class="ic">–</span><span><b>${CHECK_LABELS[k]}:</b> Looking for you…</span></li>`).join("");
  }

  // ---------- desk setup guide (sub-page) ----------
  function guideHtml() {
    const g = guide(), mode = api.settings().mode, n = g.steps.length;
    const pages = [{ label: "Overview" }, ...g.steps.map((s, i) => ({ label: `${i + 1}. ${s.title}` })), { label: "Check" }];   // sub = page index − 1
    const nav = `<nav class="guide-nav" aria-label="Desk setup guide pages">${pages.map((p, i) => `<button data-sub="${i - 1}" class="${i - 1 === sub ? "on" : ""}">${esc(p.label)}</button>`).join("")}</nav>`;
    let body;
    if (sub < n) {
      const st = sub === -1 ? g.overview : g.steps[sub];
      body = `<h2>${esc(st.title)}</h2>
        <div class="art">${art(mode, st.art)}</div>
        <p class="lead">${esc(st.body)}</p>
        <ul class="points">${st.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>`;
    } else {
      body = `<h2>Check your setup</h2>
        <p class="lead">Adjust your ${mode === "sit" ? "chair, desk and screen" : "desk and screen"} to match the pictures. Tick each one as you go.</p>
        <ul class="todo">${g.steps.map((st, i) => `<li><label><input type="checkbox" data-tick="${i}" ${ticked.has(i) ? "checked" : ""}> <b>${esc(st.title)}</b> <span>${esc(st.short)}</span></label></li>`).join("")}</ul>
        <div class="card inner">
          <h3>Want a second opinion?</h3>
          <p class="hint">The camera can check distance, centring and shoulders — and elbows or knees if they're in frame. It's a rough guide, not a verdict.</p>
          <button id="wizLive">${api.live() ? "Stop camera check" : "Check with my camera"}</button>
          <ul class="checks live-checklist" ${api.live() ? "" : "hidden"}>${checksHtml()}</ul>
        </div>`;
    }
    const last = sub === n;
    return `<div class="wiz-top"><button data-act="guideBack">← Back to calibration</button><button class="ghost" data-act="close" title="Leave setup — you can come back any time">Close</button></div>
      <p class="eyebrow">Desk setup guide · ${modeWord(mode)}</p>
      ${nav}
      ${body}
      <div class="row wiz-nav">
        ${sub > -1 ? `<button data-act="guidePrev">← Previous</button>` : ""}
        <span class="spacer"></span>
        ${last ? `<button class="primary" data-act="setupDone">I'm set up — back to calibration</button>` : `<button class="primary" data-act="guideNext">${sub === n - 1 ? "Check my setup →" : "Next →"}</button>`}
      </div>`;
  }

  // ---------- main path ----------
  function render() {
    const s = api.settings(), mode = s.mode, g = guide(), id = STEPS[step];
    clearInterval(pvTimer); api.placeStage(null);   // rescue the preview element before innerHTML replaces the card
    let html = "";

    if (sub !== null) html = guideHtml();

    else if (id === "welcome") {
      html = `${top()}
        <h2>Let's get you set up</h2>
        <p class="lead">About two minutes: first how your camera is used (spoiler: it never leaves this Mac), then calibrate so BackRight learns what <i>your</i> good posture looks like. There's also an illustrated desk-setup guide if you want to tune your desk first.</p>
        <p class="hint">Do you mostly sit or stand?</p>
        <div class="choice" role="group">
          <button data-mode="sit" class="${mode === "sit" ? "on" : ""}"><b>Sitting</b><small>Desk and chair</small></button>
          <button data-mode="stand" class="${mode === "stand" ? "on" : ""}"><b>Standing</b><small>Sit-stand desk, raised</small></button>
        </div>
        <p class="hint">Have a sit-stand desk? Do this once for each — switch with the Sitting / Standing control afterwards.</p>
        <div class="row wiz-nav"><span class="spacer"></span><button class="primary" data-act="next">Continue →</button></div>`;
    }

    else if (id === "privacy") {
      const live = api.live();
      html = `${top()}
        <p class="eyebrow">Before we use the camera</p>
        <h2>Your camera stays on this Mac</h2>
        <p class="lead">BackRight watches your head and shoulders through the webcam. Here's exactly what happens to the video:</p>
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
          ${blockedNotice()}
          <button id="pvPreview">${live ? "Turn off preview" : "Turn on camera preview"}</button>
        </div>
        <div class="row wiz-nav">
          <button data-act="back">← Back</button><span class="spacer"></span>
          <button class="primary" data-act="privacyNext">Continue</button>
        </div>`;
    }

    else if (id === "calibrate") {
      const standing = mode === "stand", done = s.setupDone[mode], fail = api.notice();
      const setupCard = done
        ? `<div class="notice"><b>✓ Desk set up.</b> <button class="link" data-act="openGuide">Review the guide</button></div>`
        : `<div class="card inner setup-card">
             <div>
               <h3>Is your desk set up well?</h3>
               <p class="hint">Calibration records how you hold yourself right now, so a quick check first pays off.</p>
               <ul class="chips">${g.steps.map(st => `<li>${esc(st.short)}</li>`).join("")}</ul>
             </div>
             <button data-act="openGuide">Desk setup guide →</button>
           </div>`;
      html = `${top()}
        <h2>Calibrate your alignment</h2>
        ${setupCard}
        <p class="lead">${standing ? "Stand" : "Sit"} the way you want to hold — tall, relaxed, looking at the screen, with your head and shoulders in the camera's view.</p>
        <ul class="points">
          <li>Press start — you get 4 seconds to get into position</li>
          <li>Then hold still for 3 seconds while it measures</li>
          <li>You can recalibrate any time from the Monitor tab</li>
        </ul>
        ${fail ? `<p class="notice warn">${esc(fail)}</p>` : ""}
        ${blockedNotice()}
        <div class="row wiz-nav">
          <button data-act="back">← Back</button>
          <span class="spacer"></span>
          <button class="ghost" data-act="later">Do this later</button>
          <button class="primary" data-act="calibrate" ${calibrating ? "disabled" : ""}>${calibrating ? "Calibrating…" : "Start calibration"}</button>
        </div>`;
    }

    else { // done
      const calibrated = !!s.baselines[mode], setup = s.setupDone[mode];
      html = `${top()}
        <h2>${calibrated ? "You're all set" : "Setup finished"}</h2>
        <p class="lead">${calibrated ? "Monitoring will nudge you with a soft glow around the screen when your posture slips." : "You haven't calibrated yet — do it from the Monitor tab when you're ready."}</p>
        <p class="hint">Where to find things later:</p>
        <ul class="points">
          <li><b>Desk setup tab</b> — the illustrated guide${setup ? "" : ", which you haven't gone through yet"}, and the camera check</li>
          <li><b>Monitor tab</b> — recalibrate, sensitivity, test the nudge</li>
          <li><b>Menu-bar and Dock icons</b> — status at a glance; pause or snooze from the menu-bar icon</li>
          <li><b>Sit-stand desk?</b> Switch to the other mode at the top right and set it up too</li>
        </ul>
        <div class="row wiz-nav"><span class="spacer"></span><button data-act="finish">Finish</button>${calibrated ? `<button class="primary" data-act="finishStart">Start monitoring</button>` : ""}</div>`;
    }
    root.innerHTML = html;
    if (sub === null && id === "privacy") startPrivacyStats();
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

  const openGuide = at => { sub = at; render(); root.scrollIntoView?.({ block: "start" }); };

  root.addEventListener("click", async e => {
    const modeBtn = e.target.closest("[data-mode]");
    if (modeBtn) { await api.setMode(modeBtn.dataset.mode); render(); return; }
    const pageBtn = e.target.closest("[data-sub]");
    if (pageBtn) { if (api.live() && +pageBtn.dataset.sub !== guide().steps.length) api.setLive(false); sub = +pageBtn.dataset.sub; render(); return; }
    if (e.target.id === "wizLive" || e.target.id === "pvPreview") { api.toggleLive(); render(); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (!act) return;
    const n = guide().steps.length;
    switch (act) {
      case "next": go(step + 1); break;
      case "back": api.setLive(false); go(step - 1); break;
      case "privacyNext": api.setLive(false); goStep("calibrate"); break;
      case "openGuide": openGuide(-1); break;
      case "guideNext": sub = Math.min(sub + 1, n); render(); break;
      case "guidePrev": sub = Math.max(sub - 1, -1); render(); break;
      case "guideBack": api.setLive(false); sub = null; render(); break;
      case "setupDone": api.setLive(false); await api.markSetupDone(); sub = null; render(); break;
      case "calibrate":
        calibrating = true; render();
        api.calibrate(ok => { calibrating = false; ok ? goStep("done") : render(); });
        break;
      case "later": goStep("done"); break;
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

  async function close(start) {
    clearInterval(pvTimer); api.placeStage(null); api.setLive(false);
    const st = api.settings();
    await api.finish({ start, skippedSetup: !st.setupDone[st.mode] });
  }

  return {
    /** fromGuide: open straight into the desk-setup guide (replay from the Desk setup tab / reminder banner). */
    start({ fromGuide = false } = {}) { calibrating = false; ticked.clear(); step = fromGuide ? STEPS.indexOf("calibrate") : 0; sub = fromGuide ? -1 : null; render(); },
    refresh() { render(); },
  };
}
