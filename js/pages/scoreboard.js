import { fetchLeaderboard } from "../api.js";
import { subscribeToChanges } from "../realtime.js";
import { escapeHTML, formatPoints } from "../ui.js";

const MEDALS = ["🥇", "🥈", "🥉"];

export async function renderScoreboard(root, context) {
  document.title = "Live Scoreboard · BigGame";
  root.innerHTML = `<div class="scoreboard"><div class="container center"><span class="spinner"></span><p>Loading scoreboard…</p></div></div>`;
  let firstLoad = true;

  async function load() {
    try {
      const rows = await fetchLeaderboard();
      if (!context.isActive()) return;
      draw(rows);
      if (firstLoad) {
        firstLoad = false;
        context.onCleanup(subscribeToChanges(["completions", "teams"], load));
      }
    } catch (error) {
      if (!context.isActive()) return;
      root.innerHTML = `<div class="scoreboard"><div class="container center"><h1>Couldn’t load the scoreboard</h1><p style="color:#fca5a5">${escapeHTML(error.message)}</p><button id="scoreboard-retry" class="btn btn-primary">Try again</button></div></div>`;
      root.querySelector("#scoreboard-retry")?.addEventListener("click", load);
    }
  }

  function draw(rows) {
    const top = rows.slice(0, 3);
    const rest = rows.slice(3);
    const classes = ["first", "second", "third"];
    root.innerHTML = `<div class="scoreboard"><div class="container stack">
      <div class="center"><div class="small" style="color:#94a3b8"><span class="live-dot"></span>LIVE</div><h1 class="scoreboard-title">🏆 Scoreboard</h1></div>
      ${rows.length === 0 ? `<div class="card empty" style="border-color:#334155;background:#1e293b">No teams yet. Let the games begin! 🎮</div>` : `
        <section class="podium">${top.map((row, index) => `<article class="podium-card ${classes[index]}"><div class="podium-medal">${MEDALS[index]}</div><div class="podium-name">${escapeHTML(row.team_name)}</div><div class="podium-points">${formatPoints(row.total_points)}</div><div class="xsmall" style="opacity:.78">${escapeHTML(row.tasks_completed)} stations · rank #${escapeHTML(row.rank)}</div></article>`).join("")}</section>
        ${rest.length ? `<section class="stack-sm">${rest.map((row) => `<div class="scoreboard-row"><span class="rank">${escapeHTML(row.rank)}</span><span class="name">${escapeHTML(row.team_name)}</span><span class="small hide-mobile" style="color:#94a3b8">${escapeHTML(row.tasks_completed)} stations</span><span class="pts">${formatPoints(row.total_points)} pts</span></div>`).join("")}</section>` : ""}
      `}
      <div class="center"><a href="/team" data-link class="small" style="color:#64748b;text-decoration:none">← Team portal</a></div>
    </div></div>`;
  }

  await load();
}
