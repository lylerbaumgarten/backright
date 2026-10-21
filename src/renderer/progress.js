import * as H from "./history.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = key => { const d = new Date(key + "T00:00:00Z"); return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };
const pct = v => (v === null || v === undefined ? "–" : `${Math.round(v)}%`);

/** Bar chart of good-posture % per day, as inline SVG (no libraries). */
export function chartSvg(days) {
  const W = 640, Ht = 176, padL = 34, padR = 6, padT = 10, padB = 30, area = W - padL - padR, slot = area / days.length, bw = Math.max(4, slot * 0.62);
  const y = p => padT + (Ht - padT - padB) * (1 - p / 100);
  const grid = [0, 50, 100].map(p => `<line class="c-grid" x1="${padL}" x2="${W - padR}" y1="${y(p)}" y2="${y(p)}"/><text class="c-axis" x="${padL - 6}" y="${y(p) + 4}" text-anchor="end">${p}</text>`).join("");
  const bars = days.map((d, i) => {
    const x = padL + i * slot + (slot - bw) / 2, hasData = d.monitoredSec >= 300, some = d.monitoredSec > 0;
    const tip = some ? `${dayLabel(d.date)} — ${pct(d.goodPct)} good posture, ${d.slips} slip${d.slips === 1 ? "" : "s"}, ${H.formatDuration(d.monitoredSec)} monitored${d.breaks ? `, ${d.breaks} break${d.breaks === 1 ? "" : "s"}` : ""}` : `${dayLabel(d.date)} — no data`;
    const cls = !some ? "empty" : !hasData ? "thin" : d.goodPct >= 85 ? "good" : d.goodPct >= 65 ? "fair" : "poor";
    const h = !some ? 2 : Math.max(2, (Ht - padT - padB) * (d.goodPct / 100));
    const showLabel = days.length <= 14 || i % 5 === days.length % 5 || i === days.length - 1;
    const label = showLabel ? `<text class="c-axis" x="${x + bw / 2}" y="${Ht - 10}" text-anchor="middle">${days.length <= 14 ? WEEKDAY[new Date(d.date + "T00:00:00Z").getUTCDay()][0] : ""}</text><text class="c-axis" x="${x + bw / 2}" y="${Ht}" text-anchor="middle">${+d.date.slice(8)}</text>` : "";
    return `<g><title>${esc(tip)}</title><rect class="c-bar ${cls}" x="${x}" y="${Ht - padB - h}" width="${bw}" height="${h}" rx="3"/>${label}</g>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${Ht + 2}" role="img" aria-label="Good posture per day">${grid}${bars}</svg>`;
}

/**
 * The Progress tab: today, "is it getting better?", a daily chart, and your data (export / delete).
 * api: { data(), now(), exportCsv(): Promise<path|null>, clear(): Promise }
 */
export function createProgress(root, api) {
  let range = 14, confirming = false, message = "";

  function trendRows(t) {
    const a = t.thisWeek, b = t.lastWeek;
    const goodArrow = Math.abs(t.goodDelta) < 1 ? "≈ about the same" : t.goodDelta > 0 ? `▲ ${t.goodDelta.toFixed(0)} points up` : `▼ ${Math.abs(t.goodDelta).toFixed(0)} points down`;
    const slipsArrow = t.slipsChange === null ? "" : Math.abs(t.slipsChange) < 0.05 ? "≈ about the same" : t.slipsChange < 0 ? `▼ ${Math.round(-t.slipsChange * 100)}% fewer` : `▲ ${Math.round(t.slipsChange * 100)}% more`;
    const cls = (better) => (better === null ? "" : better ? "up" : "down");
    return `<div class="trend-rows">
      <div class="trow ${cls(Math.abs(t.goodDelta) < 1 ? null : t.goodDelta > 0)}"><span>Good posture</span><b>${pct(a.goodPct)}</b><small>last week ${pct(b.goodPct)} · ${goodArrow}</small></div>
      <div class="trow ${cls(t.slipsChange === null || Math.abs(t.slipsChange) < 0.05 ? null : t.slipsChange < 0)}"><span>Slips per hour</span><b>${a.slipsPerHour === null ? "–" : a.slipsPerHour.toFixed(1)}</b><small>last week ${b.slipsPerHour === null ? "–" : b.slipsPerHour.toFixed(1)}${slipsArrow ? " · " + slipsArrow : ""}</small></div>
      <div class="trow"><span>Breaks taken</span><b>${a.breaks}</b><small>last week ${b.breaks}</small></div>
    </div>`;
  }

  const VERDICT = {
    better: "Yes — your posture is better than last week.",
    worse: "A bit worse than last week. That happens — long days, a new setup. A break or a fresh calibration can help.",
    steady: "About the same as last week.",
    unknown: "Keep monitoring — trends appear once you have about a week of data (and the week before it).",
  };

  function render() {
    const data = api.data(), end = H.dateKey(api.now());
    const t = H.today(data, end), tr = H.trend(data, end), days = H.lastDays(data, end, range);
    const empty = Object.keys(data.days).length === 0;
    const todayGood = t.monitoredSec >= 60 ? pct(t.goodPct) : "–";
    root.innerHTML = `
      <div class="card">
        <h2>Today</h2>
        <div class="stats">
          <div><b>${todayGood}</b><span>good posture</span></div>
          <div><b>${t.monitoredSec > 0 ? H.formatDuration(t.monitoredSec) : "–"}</b><span>monitored</span></div>
          <div><b>${t.slips}</b><span>slip${t.slips === 1 ? "" : "s"}</span></div>
          <div><b>${t.breaks}</b><span>break${t.breaks === 1 ? "" : "s"}</span></div>
        </div>
        ${empty ? `<p class="hint">Nothing here yet. Start monitoring and your numbers build up as you work — only totals are kept, never pictures.</p>`
                : `<p class="hint">A "slip" is each time you drifted far enough, for long enough, that BackRight would have nudged you.</p>`}
      </div>

      <div class="card">
        <h2>Is it getting better?</h2>
        <p class="verdict ${tr.verdict}">${VERDICT[tr.verdict]}</p>
        ${tr.enough ? trendRows(tr) : ""}
        <p class="hint tiny">This week = the last 7 days, compared with the 7 days before. Sitting and standing are combined.</p>
      </div>

      <div class="card">
        <div class="card-head"><h2>Last ${range} days</h2>
          <div class="seg small" role="group" aria-label="Range">${[14, 30].map(n => `<button data-range="${n}" class="${range === n ? "on" : ""}">${n} days</button>`).join("")}</div>
        </div>
        ${chartSvg(days)}
        <p class="hint tiny">Each bar is the share of that day's monitored time with good posture. Hover a bar for details.${H.sensitivityChanged(data, end, range) ? " <b>You changed the sensitivity during this period</b>, so days aren't strictly comparable." : ""}</p>
      </div>

      <div class="card">
        <h2>Your data</h2>
        <p class="hint">Stored only on this Mac, in a small file of daily totals — minutes monitored, minutes slipping, slips and breaks. Numbers only; no images, ever.</p>
        ${confirming
          ? `<div class="notice warn"><b>Delete all your posture history?</b> This can't be undone.<div class="row"><button class="primary" data-act="really">Yes, delete it</button><button data-act="cancel">Cancel</button></div></div>`
          : `<div class="row"><button data-act="export" ${empty ? "disabled" : ""}>Export as CSV…</button><button data-act="delete" ${empty ? "disabled" : ""}>Delete history…</button></div>`}
        ${message ? `<p class="hint">${esc(message)}</p>` : ""}
      </div>`;
  }

  root.addEventListener("click", async e => {
    const r = e.target.closest("[data-range]"); if (r) { range = +r.dataset.range; render(); return; }
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "delete") { confirming = true; message = ""; render(); }
    else if (act === "cancel") { confirming = false; render(); }
    else if (act === "really") { await api.clear(); confirming = false; message = "History deleted."; render(); }
    else if (act === "export") { const where = await api.exportCsv(); message = where ? `Saved to ${where}` : ""; render(); }
  });
  return { render };
}
