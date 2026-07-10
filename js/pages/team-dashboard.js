import {
  fetchCompletionsForTeam,
  fetchLeaderboard,
  fetchMembers,
  fetchSettings,
  fetchStations,
  fetchTeamByCode,
} from "../api.js";
import { subscribeToChanges } from "../realtime.js";
import { escapeHTML, formatPoints, leaderboardList, loadingPage, shell, stat } from "../ui.js";

const TEAM_KEY = "bg_team_code";

export async function renderTeamDashboard(root, context) {
  const code = context.params.code.toUpperCase();
  document.title = `${code} · Team · BigGame`;
  root.innerHTML = loadingPage("Loading your team…", { back: "/team" });

  let firstLoad = true;
  async function load() {
    try {
      const team = await fetchTeamByCode(code);
      if (!context.isActive()) return;
      if (!team) {
        root.innerHTML = shell(`<div class="card card-pad center"><h1 class="section-title">Team not found</h1><p class="muted">Check the code and try again.</p><a href="/team" data-link class="btn btn-primary">Enter team code</a></div>`, { back: "/team" });
        return;
      }
      localStorage.setItem(TEAM_KEY, team.code);
      const [members, stations, completions, board, settings] = await Promise.all([
        fetchMembers(team.id),
        fetchStations(),
        fetchCompletionsForTeam(team.id),
        fetchLeaderboard(),
        fetchSettings(),
      ]);
      if (!context.isActive()) return;
      renderView(team, members, stations, completions, board, settings);
      if (firstLoad) {
        firstLoad = false;
        context.onCleanup(subscribeToChanges(["completions", "stations", "teams", "members", "settings"], load));
      }
    } catch (error) {
      if (!context.isActive()) return;
      root.innerHTML = shell(`<div class="card card-pad center"><h1 class="section-title">Couldn’t load this team</h1><p class="alert alert-error">${escapeHTML(error.message)}</p><button id="team-retry" class="btn btn-primary">Try again</button></div>`, { back: "/team" });
      root.querySelector("#team-retry")?.addEventListener("click", load);
    }
  }

  function renderView(team, members, stations, completions, board, settings) {
    const completionByStation = new Map(completions.map((item) => [item.station_id, item]));
    const myBoardRow = board.find((row) => row.team_id === team.id);
    const total = myBoardRow?.total_points || 0;
    const completed = myBoardRow?.tasks_completed || completions.length;
    const maxTotal = stations.reduce((sum, station) => sum + Number(station.max_score || 0), 0);
    const progress = stations.length ? Math.min(100, Math.round((completed / stations.length) * 100)) : 0;

    const stationHTML = stations.length
      ? stations.map((station) => {
          const completion = completionByStation.get(station.id);
          return `<article class="card station-item">
            <div class="station-row">
              <div class="station-icon" aria-hidden="true">${completion ? "✓" : "🎯"}</div>
              <div class="station-main"><div class="station-name">${escapeHTML(station.name)}</div>${station.description ? `<div class="xsmall muted">${escapeHTML(station.description)}</div>` : ""}<div class="xsmall quiet">Maximum ${formatPoints(station.max_score)} points</div></div>
              <div class="station-score ${completion ? "score-done" : "score-empty"}">${completion ? `${formatPoints(completion.score)}<span class="xsmall">/${formatPoints(station.max_score)}</span>` : "—"}</div>
            </div>
          </article>`;
        }).join("")
      : `<div class="card empty">No stations have been added yet.</div>`;

    const leaderboardSection = settings.leaderboard_public
      ? `<section class="stack-sm"><div><h2 class="section-title">Live leaderboard</h2><p class="small muted">Updates automatically as advisors award scores.</p></div>${leaderboardList(board, team.id)}</section>`
      : `<section class="card card-pad center"><div style="font-size:2rem">🔒</div><h2 class="section-title">Leaderboard hidden</h2><p class="small muted" style="margin-bottom:0">The organizer has hidden other teams’ scores for now.</p></section>`;

    root.innerHTML = shell(`
      <section class="center">
        <p class="eyebrow">Team dashboard</p>
        <h1 class="page-title">${escapeHTML(team.name)}</h1>
        <button id="copy-team-code" class="code-badge" type="button" title="Copy team code">${escapeHTML(team.code)} ⧉</button>
        <p class="xsmall quiet" style="margin-top:.45rem">Save this code to rejoin later</p>
      </section>
      <section class="grid-3">
        ${stat("Points", `${formatPoints(total)}${maxTotal ? ` / ${formatPoints(maxTotal)}` : ""}`)}
        ${stat("Stations", `${completed} / ${stations.length}`)}
        ${stat("Rank", settings.leaderboard_public && myBoardRow ? `#${myBoardRow.rank}` : "—")}
      </section>
      <section class="card card-pad">
        <div style="display:flex;justify-content:space-between;gap:1rem"><strong>Game progress</strong><span class="small muted">${progress}%</span></div>
        <div class="progress" style="margin-top:.65rem"><div class="progress-bar" style="width:${progress}%"></div></div>
        ${members.length ? `<div class="member-chips" style="margin-top:1rem">${members.map((member) => `<span class="member-chip">${escapeHTML(member.name)}</span>`).join("")}</div>` : ""}
      </section>
      <section class="stack-sm"><div><h2 class="section-title">Stations</h2><p class="small muted">Your scores and completed activities.</p></div><div class="station-list">${stationHTML}</div></section>
      ${leaderboardSection}
      <div class="center"><button id="forget-team" class="btn-link danger" type="button">Forget saved team on this device</button></div>
    `, { back: "/team", backLabel: "Switch team" });

    root.querySelector("#copy-team-code")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(team.code); root.querySelector("#copy-team-code").textContent = `${team.code} ✓`; }
      catch { window.prompt("Your team code:", team.code); }
    });
    root.querySelector("#forget-team")?.addEventListener("click", () => {
      localStorage.removeItem(TEAM_KEY);
      context.navigate("/team");
    });
  }

  await load();
}
