import {
  awardCompletion,
  fetchAllMembers,
  fetchCompletionsForStation,
  fetchStationByCode,
  fetchTeams,
  undoCompletion,
} from "../api.js";
import { subscribeToChanges } from "../realtime.js";
import { escapeHTML, formatPoints, loadingPage, shell, showToast, stat } from "../ui.js";

const STATION_KEY = "bg_station_code";

export async function renderAdvisorDashboard(root, context) {
  const code = context.params.code.toUpperCase();
  document.title = `${code} · Advisor · BigGame`;
  root.innerHTML = loadingPage("Loading station…", { back: "/advisor" });
  let station;
  let teams = [];
  let members = [];
  let completions = [];
  let query = "";
  let openId = "";
  let firstLoad = true;
  let busy = false;

  async function load() {
    try {
      station = await fetchStationByCode(code);
      if (!context.isActive()) return;
      if (!station) {
        root.innerHTML = shell(`<div class="card card-pad center"><h1 class="section-title">Station not found</h1><p class="muted">Check the advisor code and try again.</p><a href="/advisor" data-link class="btn btn-primary">Enter station code</a></div>`, { back: "/advisor" });
        return;
      }
      localStorage.setItem(STATION_KEY, station.code);
      [teams, members, completions] = await Promise.all([
        fetchTeams(),
        fetchAllMembers(),
        fetchCompletionsForStation(station.id),
      ]);
      if (!context.isActive()) return;
      draw();
      if (firstLoad) {
        firstLoad = false;
        context.onCleanup(subscribeToChanges(["teams", "members", "completions", "stations"], load));
      }
    } catch (error) {
      if (!context.isActive()) return;
      root.innerHTML = shell(`<div class="card card-pad center"><h1>Couldn’t load this station</h1><p class="alert alert-error">${escapeHTML(error.message)}</p><button id="advisor-retry" class="btn btn-primary">Try again</button></div>`, { back: "/advisor" });
      root.querySelector("#advisor-retry")?.addEventListener("click", load);
    }
  }

  function draw() {
    const byTeam = new Map(completions.map((item) => [item.team_id, item]));
    const counts = new Map();
    for (const member of members) counts.set(member.team_id, (counts.get(member.team_id) || 0) + 1);
    const filtered = teams.filter((team) => team.name.toLowerCase().includes(query.trim().toLowerCase()));

    const teamHTML = filtered.length ? filtered.map((team) => {
      const completion = byTeam.get(team.id);
      const open = openId === team.id;
      const max = Math.max(0, Math.trunc(Number(station.max_score || 0)));
      const scores = Array.from({ length: max + 1 }, (_, value) => {
        const hue = max > 0 ? (value / max) * 130 : 65;
        return `<button type="button" class="score-button" data-score="${value}" data-team="${team.id}" style="background:hsl(${hue},70%,42%)" ${busy ? "disabled" : ""}>${value}</button>`;
      }).join("");
      return `<article class="card team-item" data-team-card="${team.id}">
        <div class="team-row">
          <div class="team-main"><div class="team-name">${escapeHTML(team.name)}</div><div class="xsmall quiet">${counts.get(team.id) || 0} members</div></div>
          <div class="station-score ${completion ? "score-done" : "score-empty"}">${completion ? `${formatPoints(completion.score)}/${formatPoints(station.max_score)}` : "—"}</div>
        </div>
        <div class="form-actions" style="margin-top:.75rem">
          ${completion
            ? `<button type="button" class="btn btn-ghost btn-small edit-score" data-team="${team.id}" style="flex:1">${open ? "Close" : "Edit score"}</button><button type="button" class="btn btn-ghost btn-small undo-score" data-completion="${completion.id}" style="flex:1;color:var(--red)" ${busy ? "disabled" : ""}>Undo</button>`
            : `<button type="button" class="btn btn-primary award-score" data-team="${team.id}" style="width:100%">${open ? "Close scores" : "Award score"}</button>`}
        </div>
        ${open ? `<div style="margin-top:.8rem"><p class="center xsmall muted">Tap a score (0–${max})</p><div class="score-grid">${scores}</div></div>` : ""}
      </article>`;
    }).join("") : `<div class="card empty">No teams found.</div>`;

    root.innerHTML = shell(`
      <section class="center"><p class="eyebrow">Advisor station</p><h1 class="page-title">${escapeHTML(station.name)}</h1>${station.description ? `<p class="muted">${escapeHTML(station.description)}</p>` : ""}<span class="code-badge">${escapeHTML(station.code)}</span></section>
      <section class="grid-2">${stat("Teams scored", completions.length)}${stat("Total teams", teams.length)}</section>
      <section><label class="sr-only" for="team-search">Search teams</label><input id="team-search" class="input" placeholder="Search teams…" value="${escapeHTML(query)}"></section>
      <section class="team-list">${teamHTML}</section>
    `, { back: "/advisor", backLabel: "Change station" });

    const search = root.querySelector("#team-search");
    search?.addEventListener("input", (event) => {
      query = event.target.value;
      draw();
      const replacement = root.querySelector("#team-search");
      replacement.focus();
      replacement.setSelectionRange(query.length, query.length);
    });

    root.querySelectorAll(".award-score, .edit-score").forEach((button) => {
      button.addEventListener("click", () => {
        openId = openId === button.dataset.team ? "" : button.dataset.team;
        draw();
      });
    });
    root.querySelectorAll(".score-button").forEach((button) => button.addEventListener("click", () => score(button.dataset.team, Number(button.dataset.score))));
    root.querySelectorAll(".undo-score").forEach((button) => button.addEventListener("click", () => undo(button.dataset.completion)));
  }

  async function score(teamId, value) {
    if (busy) return;
    busy = true;
    draw();
    try {
      await awardCompletion(station.code, teamId, value);
      openId = "";
      showToast(`Score ${formatPoints(value)} saved`, "success");
      await load();
    } catch (error) {
      showToast(error.message || "Could not save the score.", "error");
    } finally {
      busy = false;
      if (context.isActive()) draw();
    }
  }

  async function undo(completionId) {
    if (busy || !window.confirm("Undo this team’s score?")) return;
    busy = true;
    draw();
    try {
      await undoCompletion(station.code, completionId);
      showToast("Score removed", "success");
      await load();
    } catch (error) {
      showToast(error.message || "Could not remove the score.", "error");
    } finally {
      busy = false;
      if (context.isActive()) draw();
    }
  }

  await load();
}
