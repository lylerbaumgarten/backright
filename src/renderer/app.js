import { loadModel, createCamera, detect, drawSkeleton } from "./detector.js";
import { measure, average, createMonitor, setupChecks, BASELINE_VERSION } from "./posture.js";
import { GUIDE, CHECK_LABELS } from "./guide.js";
import { art } from "./guide-art.js";
import { createWizard } from "./onboarding.js";

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const video = $("video"), canvas = $("overlay"), stage = $("stage");
const camera = createCamera(video);
const monitor = createMonitor();

let settings, idle = false, previewOn = false, modelReady = false;
let calib = null, calibCb = null;   // calib: { phase: "countdown"|"sample", until, samples: [] }
let setupLive = false;
let timer = null, lastTick = 0;
let tab = "monitor";                // monitor | setup | privacy | onboard (the first-run walkthrough)
let cameraBlocked = false;
let notice = "";                    // transient message shown under the status (survives re-renders)
let hintTimer = null, hintPersist = false, renderedSetupMode = null;

const COUNTDOWN_MS = 4000, SAMPLE_MS = 3000, MIN_SAMPLES = 4;
const modeName = m => (m === "sit" ? "sitting" : "standing");
const baseline = () => { const b = settings.baselines[settings.mode]; return b?.v === BASELINE_VERSION ? b : null; };   // older calibrations are ignored

async function save(patch) { settings = await window.posture.setSettings(patch); render(); syncCamera(); }
function setStatus(text, cls = "") { $("statusText").textContent = text; $("dot").className = "dot " + cls; }

// ---------- camera / loop ----------
const wantMonitoring = () => settings.monitoring && !idle && !!baseline();

async function ensureModel() {
  if (modelReady) return;
  setStatus("Loading pose model…");
  await loadModel(); modelReady = true;
}

async function syncCamera() {
  const wanted = { monitoring: wantMonitoring(), calibrate: !!calib, setup: setupLive };
  const any = Object.values(wanted).some(Boolean);
  try {
    if (any) {
      setStatus("Checking camera permission…");
      const access = await window.posture.requestCamera();
      cameraBlocked = access === "denied" || access === "restricted";
      if (cameraBlocked) throw new Error("Camera access is blocked. Allow it for this app in System Settings → Privacy & Security → Camera, then try again.");
      await ensureModel();
      setStatus("Starting camera…");
    }
    for (const [reason, on] of Object.entries(wanted)) await (on ? camera.acquire(reason) : camera.release(reason));
  } catch (e) {
    console.error(e);
    notice = "Couldn't start: " + (e.message || e.name);
    camera.releaseAll();
    calib = null; setupLive = false;
    if (settings.monitoring) { settings.monitoring = false; window.posture.setSettings({ monitoring: false }); }
    render(); finishCalib(false); if (tab === "onboard") wizard.refresh();
    return;
  }
  const showStage = any && (previewOn || !!calib || setupLive);
  stage.hidden = !showStage;
  if (any && !timer) loop();
  else if (!any) {
    clearTimeout(timer); timer = null; window.posture.setWarning(false);
    if (previewOn) { previewOn = false; render(); }   // nothing to preview once the camera is off
  }
}

function loop() {
  timer = setTimeout(async () => {
    timer = null;
    if (!camera.active) { loop(); return; }
    try { handle(detect(video)); } catch (e) { console.error(e); }
    if (camera.active || calib || setupLive || wantMonitoring()) loop();
  }, calib ? 300 : Math.round(settings.checkEverySec * 1000));
}

function handle(lm) {
  if (!stage.hidden) drawSkeleton(canvas, lm);
  const now = performance.now();
  const dt = lastTick ? now - lastTick : 500; lastTick = now;

  if (setupLive) renderChecks(lm ? setupChecks(lm, { standing: settings.mode === "stand" }) : null);
  if (calib) return handleCalibration(lm, now);
  if (!wantMonitoring()) return;

  const m = lm && measure(lm);
  if (!m) {   // nobody in frame: don't leave a stale nudge on screen
    monitor.reset(); window.posture.setWarning(false);
    setStatus("Can't see you — check your framing"); return;
  }
  // Smooth over ~1.5s of real time regardless of how often we sample.
  const alpha = 1 - Math.exp(-dt / 1500);
  const r = monitor.update(baseline(), m, now, { sensitivity: settings.sensitivity, delayMs: settings.delaySec * 1000, alpha });
  $("mSlouch").textContent = (r.smooth.slouch * 100).toFixed(0) + "%";
  $("mLean").textContent = (r.smooth.lean * 100).toFixed(0) + "%";
  $("mTilt").textContent = r.smooth.tilt.toFixed(1) + "°";
  window.posture.setWarning(r.warned);
  setStatus(r.warned ? "Posture slipping" : r.bad ? "Drifting…" : "Good posture", r.warned ? "bad" : r.bad ? "" : "ok");
}

// ---------- calibration ----------
function finishCalib(ok) { const cb = calibCb; calibCb = null; cb?.(ok); }

function startCalibration(cb = null) {
  if (tab !== "onboard") tab = "monitor";
  notice = ""; calibCb = cb;
  calib = { phase: "countdown", until: performance.now() + COUNTDOWN_MS, samples: [] };
  render(); syncCamera();
}

function handleCalibration(lm, now) {
  const cd = $("countdown"); cd.hidden = false;
  const stand = settings.mode === "stand";
  if (calib.phase === "countdown") {
    const left = Math.ceil((calib.until - now) / 1000);
    cd.innerHTML = `${Math.max(left, 1)}<small>${stand ? "Stand" : "Sit"} the way you want to hold — tall, relaxed</small>`;
    setStatus("Get into position…");
    if (now >= calib.until) { calib.phase = "sample"; calib.until = now + SAMPLE_MS; }
    return;
  }
  cd.innerHTML = `<small>Hold still…</small>`; setStatus("Calibrating…");
  const m = lm && measure(lm); if (m) calib.samples.push(m);
  if (now >= calib.until) {
    cd.hidden = true;
    if (calib.samples.length >= MIN_SAMPLES) {
      const b = { ...average(calib.samples), v: BASELINE_VERSION }; calib = null; monitor.reset();
      save({ baselines: { ...settings.baselines, [settings.mode]: b } }).then(() => finishCalib(true));
      setStatus(`Calibrated for ${modeName(settings.mode)}`, "ok");
    } else {
      calib = null;
      notice = "Couldn't see you well enough to calibrate — check lighting and that your head and shoulders are in frame, then try again.";
      render(); syncCamera(); finishCalib(false);
    }
  }
}

// ---------- desk setup tab ----------
function renderSetup() {
  const mode = settings.mode, g = GUIDE[mode];
  $("setupTitle").textContent = `Desk setup — ${modeName(mode)}`;
  $("setupIntro").textContent = g.intro;
  if (renderedSetupMode !== mode) {   // illustrations are static per mode — don't rebuild on every settings change
    renderedSetupMode = mode;
    const o = g.overview;
    $("steps").innerHTML = `
      <div class="gcard">
        <div class="art">${art(mode, o.art)}</div>
        <h3>${esc(o.title)}</h3>
        <p>${esc(o.body)}</p>
        <ul class="points">${o.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      </div>` + g.steps.map((s, i) => `
      <div class="gcard">
        <div class="art">${art(mode, s.art)}</div>
        <h3>${i + 1}. ${esc(s.title)}</h3>
        <p>${esc(s.body)}</p>
        <ul class="points">${s.points.map(p => `<li>${esc(p)}</li>`).join("")}</ul>
      </div>`).join("");
  }
  $("liveCheck").hidden = !setupLive;
  $("startLive").textContent = setupLive ? "Stop live check" : "Run live check";
  $("afterSetup").hidden = !settings.setupDone[mode];
}

function renderChecks(result) {
  const keys = [...new Set(GUIDE[settings.mode].steps.flatMap(s => s.checks || []))];
  const icon = { ok: "✓", adjust: "!", unknown: "–" };
  const html = keys.map(k => {
    const c = result?.[k] ?? { status: "unknown", note: "Looking for you…" };
    return `<li class="${c.status}"><span class="ic">${icon[c.status]}</span><span><b>${CHECK_LABELS[k]}:</b> ${c.note}</span></li>`;
  }).join("");
  document.querySelectorAll(".live-checklist").forEach(el => { el.innerHTML = html; });
}

// ---------- pointer to the Desk setup tab ----------
function showTabHint(text, { persist = false } = {}) {
  $("tabHintText").textContent = text;
  $("tabHint").hidden = false; $("tabSetup").classList.add("pulse");
  clearTimeout(hintTimer); hintPersist = persist;
  if (!persist) hintTimer = setTimeout(hideTabHint, 6000);
}
function hideTabHint() { clearTimeout(hintTimer); hintPersist = false; $("tabHint").hidden = true; $("tabSetup").classList.remove("pulse"); }
// A reminder, not a fixture: any click elsewhere dismisses it (the walkthrough pins it only while it's relevant).
document.addEventListener("click", () => { if (!hintPersist) hideTabHint(); }, true);

// ---------- rendering ----------
function render() {
  const inWizard = tab === "onboard";
  document.querySelectorAll("#modeSeg button").forEach(b => b.classList.toggle("on", b.dataset.mode === settings.mode));
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", !inWizard && b.dataset.tab === tab));
  for (const t of ["onboard", "monitor", "setup", "privacy"]) $("tab-" + t).hidden = t !== tab;
  $("tabs").classList.toggle("locked", inWizard);   // can't wander off mid-walkthrough; "Close" is the exit
  $("modeSeg").hidden = inWizard;

  const mode = settings.mode;
  const needsSetup = settings.onboarded && !settings.monitoring && !settings.setupDone[mode] && !settings.setupBannerDismissed[mode];
  $("setupBanner").hidden = !needsSetup;
  $("bannerText").textContent = `Desk setup for ${modeName(mode)} hasn't been done yet. A minute of setup makes calibration more accurate.`;

  $("toggleMon").textContent = settings.monitoring ? "Pause monitoring" : "Start monitoring";
  $("togglePreview").textContent = previewOn ? "Hide preview" : "Show preview";
  $("togglePreview").disabled = !(wantMonitoring() || calib || setupLive);   // the preview needs a live camera
  $("calibrate").disabled = !!calib;
  $("camBlocked").hidden = !cameraBlocked;
  $("calHint").textContent = notice || (baseline()
    ? `Calibrated for ${modeName(mode)}. Recalibrate any time you change your setup.`
    : `Not calibrated for ${modeName(mode)} yet. ${settings.setupDone[mode] ? "" : "Tip: do the Desk setup first. "}Then press Calibrate.`);

  $("sens").value = settings.sensitivity; $("sensVal").textContent = (+settings.sensitivity).toFixed(2) + "×";
  $("delay").value = settings.delaySec; $("delayVal").textContent = settings.delaySec + "s";
  $("every").value = settings.checkEverySec; $("everyVal").textContent = (+settings.checkEverySec).toFixed(1) + "s";
  $("glowOn").checked = settings.glow; $("pillOn").checked = settings.pill;

  if (!calib && !wantMonitoring()) {
    setStatus(settings.monitoring && !baseline() ? `Calibrate for ${modeName(mode)} to begin` : idle ? "Paused — screen locked" : "Not monitoring");
  }
  renderSetup();
}

// ---------- walkthrough ----------
const wizard = createWizard($("tab-onboard"), {
  settings: () => settings,
  notice: () => notice,
  cameraBlocked: () => cameraBlocked,
  live: () => setupLive,
  setLive: v => { if (setupLive !== v) { setupLive = v; render(); syncCamera(); } },
  toggleLive: () => { setupLive = !setupLive; if (setupLive) renderChecks(null); syncCamera(); },
  setMode: async m => { if (m !== settings.mode) { monitor.reset(); window.posture.setWarning(false); await save({ mode: m }); } },
  markSetupDone: () => save({ setupDone: { ...settings.setupDone, [settings.mode]: true } }),
  calibrate: cb => startCalibration(cb),
  hintDeskSetup: on => on ? showTabHint("Skipped for now — the desk setup guide lives here", { persist: true }) : hideTabHint(),
  openCameraSettings: () => window.posture.openCameraSettings(),
  relaunch: () => window.posture.relaunch(),
  finish: async ({ start, skippedSetup }) => {
    tab = "monitor"; notice = "";
    hideTabHint();
    await save({ onboarded: true });
    if (start) await toggleMonitoring();
    else if (skippedSetup || !settings.setupDone[settings.mode]) showTabHint("You can do the desk setup any time from here");
  },
});

function openWizard(opts) { tab = "onboard"; notice = ""; wizard.start(opts); render(); }

// ---------- events ----------
document.querySelectorAll("#modeSeg button").forEach(b => b.onclick = () => {
  if (b.dataset.mode === settings.mode) return;
  monitor.reset(); window.posture.setWarning(false);
  save({ mode: b.dataset.mode });
});
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  if (tab === "setup") hideTabHint();
  if (tab !== "setup" && setupLive) { setupLive = false; }
  render(); syncCamera();
});

async function toggleMonitoring() {
  const on = !settings.monitoring;
  monitor.reset(); window.posture.setWarning(false);
  if (on) hideTabHint(); else previewOn = false;
  await save({ monitoring: on });
  if (on && !baseline()) startCalibration();
}
$("toggleMon").onclick = toggleMonitoring;
$("calibrate").onclick = () => startCalibration();
$("togglePreview").onclick = () => { previewOn = !previewOn; render(); syncCamera(); };
$("openCamSettings").onclick = () => window.posture.openCameraSettings();
$("relaunch").onclick = () => window.posture.relaunch();
$("testNudge").onclick = () => window.posture.previewOverlay();
$("sens").oninput = e => save({ sensitivity: +e.target.value });
$("delay").oninput = e => save({ delaySec: +e.target.value });
$("every").oninput = e => save({ checkEverySec: +e.target.value });
$("glowOn").onchange = e => save({ glow: e.target.checked });
$("pillOn").onchange = e => save({ pill: e.target.checked });

$("bannerGo").onclick = () => openWizard({ fromGuide: true });
$("bannerLater").onclick = async () => {
  await save({ setupBannerDismissed: { ...settings.setupBannerDismissed, [settings.mode]: true } });
  showTabHint("No problem — the desk setup guide is always here", { persist: false });
};
$("replayWizard").onclick = () => { setupLive = false; openWizard({ fromGuide: true }); };

$("startLive").onclick = () => { setupLive = !setupLive; if (setupLive) renderChecks(null); render(); syncCamera(); };
$("setupDone").onclick = async () => {
  setupLive = false;
  await save({ setupDone: { ...settings.setupDone, [settings.mode]: true } });
};
$("goCalibrate").onclick = () => { setupLive = false; startCalibration(); };

window.posture.onSettings(s => { settings = s; monitor.reset(); render(); syncCamera(); });
window.posture.onToggleMonitoring(toggleMonitoring);
window.posture.onIdle(v => { idle = v; monitor.reset(); window.posture.setWarning(false); render(); syncCamera(); });

// ---------- boot ----------
settings = await window.posture.getSettings();
if (!settings.onboarded) { tab = "onboard"; wizard.start(); }
render();
syncCamera(); // resumes monitoring if it was on last time and a baseline exists
