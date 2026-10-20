import { loadModel, createCamera, detect, drawSkeleton } from "./detector.js";
import { measure, average, createMonitor, setupChecks } from "./posture.js";
import { GUIDE, CHECK_LABELS } from "./guide.js";

const $ = id => document.getElementById(id);
const video = $("video"), canvas = $("overlay"), stage = $("stage");
const camera = createCamera(video);
const monitor = createMonitor();

let settings, idle = false, previewOn = false, modelReady = false;
let calib = null;        // { phase: "countdown"|"sample", until, samples: [] }
let setupLive = false;
let timer = null, lastTick = 0;
let tab = "monitor";
let notice = "";          // transient message shown under the status (survives re-renders)

const COUNTDOWN_MS = 4000, SAMPLE_MS = 3000, MIN_SAMPLES = 4;
const modeName = m => (m === "sit" ? "sitting" : "standing");
const baseline = () => settings.baselines[settings.mode];

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
    if (any) { await window.posture.requestCamera(); await ensureModel(); }
    for (const [reason, on] of Object.entries(wanted)) await (on ? camera.acquire(reason) : camera.release(reason));
  } catch (e) {
    console.error(e);
    setStatus("Couldn't start the camera: " + (e.message || e.name));
    calib = null; setupLive = false;
    if (settings.monitoring) { settings.monitoring = false; window.posture.setSettings({ monitoring: false }); }
    render(); return;
  }
  const showStage = any && (previewOn || !!calib || setupLive);
  stage.hidden = !showStage;
  if (any && !timer) loop(); else if (!any) { clearTimeout(timer); timer = null; window.posture.setWarning(false); }
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
  if (!m) { setStatus("Can't see you — check your framing"); return; }
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
function startCalibration() {
  tab = "monitor"; notice = ""; calib = { phase: "countdown", until: performance.now() + COUNTDOWN_MS, samples: [] };
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
      const b = average(calib.samples); calib = null; monitor.reset();
      save({ baselines: { ...settings.baselines, [settings.mode]: b } });
      setStatus(`Calibrated for ${modeName(settings.mode)}`, "ok");
    } else {
      calib = null;
      notice = "Couldn't see you well enough to calibrate — check lighting and that your head and shoulders are in frame, then try again.";
      render(); syncCamera();
    }
  }
}

// ---------- desk setup guide ----------
function renderSetup() {
  const g = GUIDE[settings.mode];
  $("setupTitle").textContent = `Desk setup — ${modeName(settings.mode)}`;
  $("setupIntro").textContent = g.intro;
  $("steps").innerHTML = g.steps.map(s => `<li><b>${s.title}</b>${s.body}</li>`).join("");
  $("liveCheck").hidden = !setupLive;
  $("startLive").textContent = setupLive ? "Stop live check" : "Run live check";
  $("afterSetup").hidden = !settings.setupDone[settings.mode];
}

function renderChecks(result) {
  const keys = [...new Set(GUIDE[settings.mode].steps.flatMap(s => s.checks || []))];
  const icon = { ok: "✓", adjust: "!", unknown: "–" };
  $("checkList").innerHTML = keys.map(k => {
    const c = result?.[k] ?? { status: "unknown", note: "Looking for you…" };
    return `<li class="${c.status}"><span class="ic">${icon[c.status]}</span><span><b>${CHECK_LABELS[k]}:</b> ${c.note}</span></li>`;
  }).join("");
}

// ---------- rendering ----------
function render() {
  document.querySelectorAll("#modeSeg button").forEach(b => b.classList.toggle("on", b.dataset.mode === settings.mode));
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  for (const t of ["monitor", "setup", "privacy"]) $("tab-" + t).hidden = t !== tab;

  $("toggleMon").textContent = settings.monitoring ? "Pause monitoring" : "Start monitoring";
  $("togglePreview").textContent = previewOn ? "Hide preview" : "Show preview";
  $("calibrate").disabled = !!calib;
  $("calHint").textContent = notice || (baseline()
    ? `Calibrated for ${modeName(settings.mode)}. Recalibrate any time you change your setup.`
    : `Not calibrated for ${modeName(settings.mode)} yet. ${settings.setupDone[settings.mode] ? "" : "Tip: do the Desk setup first. "}Then press Calibrate.`);

  $("sens").value = settings.sensitivity; $("sensVal").textContent = (+settings.sensitivity).toFixed(2) + "×";
  $("delay").value = settings.delaySec; $("delayVal").textContent = settings.delaySec + "s";
  $("every").value = settings.checkEverySec; $("everyVal").textContent = (+settings.checkEverySec).toFixed(1) + "s";
  $("glowOn").checked = settings.glow; $("pillOn").checked = settings.pill;

  if (!calib && !wantMonitoring()) {
    setStatus(settings.monitoring && !baseline() ? `Calibrate for ${modeName(settings.mode)} to begin` : idle ? "Paused — screen locked" : "Not monitoring");
  }
  renderSetup();
}

// ---------- events ----------
document.querySelectorAll("#modeSeg button").forEach(b => b.onclick = () => {
  if (b.dataset.mode === settings.mode) return;
  monitor.reset(); window.posture.setWarning(false);
  save({ mode: b.dataset.mode });
});
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  if (tab !== "setup" && setupLive) { setupLive = false; }
  render(); syncCamera();
});

async function toggleMonitoring() {
  const on = !settings.monitoring;
  monitor.reset(); window.posture.setWarning(false);
  await save({ monitoring: on });
  if (on && !baseline()) startCalibration();
}
$("toggleMon").onclick = toggleMonitoring;
$("calibrate").onclick = startCalibration;
$("togglePreview").onclick = () => { previewOn = !previewOn; render(); syncCamera(); };
$("testNudge").onclick = () => window.posture.previewOverlay();
$("sens").oninput = e => save({ sensitivity: +e.target.value });
$("delay").oninput = e => save({ delaySec: +e.target.value });
$("every").oninput = e => save({ checkEverySec: +e.target.value });
$("glowOn").onchange = e => save({ glow: e.target.checked });
$("pillOn").onchange = e => save({ pill: e.target.checked });

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
render();
syncCamera(); // resumes monitoring if it was on last time and a baseline exists
