import { adminStatus, callAdmin } from "../admin-api.js";
import { escapeHTML, formatDateTime, formatPoints, loadingPage, shell, stat } from "../ui.js";

export async function renderAdminReport(root, context) {
  document.title = "Full Game Report · BigGame";
  root.innerHTML = loadingPage("Checking admin session…", { back: "/admin", wide: true });
  if (!(await adminStatus())) {
    context.navigate("/admin", { replace: true });
    return;
  }

  async function load() {
    root.innerHTML = loadingPage("Building the full report…", { back: "/admin", wide: true });
    try {
      const data = await callAdmin("reportData");
      if (context.isActive()) draw(data);
    } catch (error) {
      root.innerHTML = shell(`<div class="card card-pad center"><h1>Couldn’t build the report</h1><p class="alert alert-error">${escapeHTML(error.message)}</p><button id="report-retry" class="btn btn-primary">Try again</button></div>`, { back: "/admin", wide: true });
      root.querySelector("#report-retry")?.addEventListener("click", load);
    }
  }

  function stationReport(stations, teams, completions) {
    if (!stations.length) return `<div class="card empty">No stations have been created.</div>`;
    const byStationAndTeam = new Map(completions.map((item) => [`${item.station_id}:${item.team_id}`, item]));
    return stations.map((station, stationIndex) => {
      const completedCount = teams.filter((team) => byStationAndTeam.has(`${station.id}:${team.id}`)).length;
      const rows = teams.length ? teams.map((team) => {
        const completion = byStationAndTeam.get(`${station.id}:${team.id}`);
        return `<tr><td><strong>${escapeHTML(team.name)}</strong></td><td>${completion ? `<span class="badge badge-success">Completed</span>` : `<span class="badge badge-muted">Not completed</span>`}</td><td>${completion ? `<strong>${formatPoints(completion.score)}</strong> / ${formatPoints(station.max_score)}` : "—"}</td><td>${completion ? escapeHTML(formatDateTime(completion.created_at)) : "—"}</td></tr>`;
      }).join("") : `<tr><td colspan="4" class="empty">No teams registered.</td></tr>`;
      return `<article class="card report-block ${stationIndex ? "print-page-break" : ""}"><div class="report-block-header"><div><p class="eyebrow">Station ${stationIndex + 1}</p><h2>${escapeHTML(station.name)}</h2>${station.description ? `<p>${escapeHTML(station.description)}</p>` : ""}</div><div class="report-completion-count"><strong>${completedCount}/${teams.length}</strong><span>teams completed</span></div></div><div class="table-wrap"><table><thead><tr><th>Team</th><th>Status</th><th>Score</th><th>Completed at</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
    }).join("");
  }

  function taskStatus(submission) {
    if (!submission) return { key: "none", label: "Not submitted", badge: "badge-muted" };
    const statuses = {
      draft: { key: "draft", label: "Upload incomplete", badge: "badge-warn" },
      pending: { key: "pending", label: "Pending review", badge: "badge-warn" },
      approved: { key: "approved", label: "Approved", badge: "badge-success" },
      rejected: { key: "rejected", label: "Rejected", badge: "badge-error" },
    };
    return statuses[submission.status] || statuses.draft;
  }

  function taskReport(tasks, teams, submissions) {
    if (!tasks.length) return `<div class="card empty">No tasks have been created.</div>`;
    const byTaskAndTeam = new Map(submissions.map((item) => [`${item.task_id}:${item.team_id}`, item]));
    return tasks.map((task, taskIndex) => {
      const approvedCount = teams.filter((team) => byTaskAndTeam.get(`${task.id}:${team.id}`)?.status === "approved").length;
      const rows = teams.length ? teams.map((team) => {
        const submission = byTaskAndTeam.get(`${task.id}:${team.id}`);
        const status = taskStatus(submission);
        return `<tr><td><strong>${escapeHTML(team.name)}</strong></td><td><span class="badge ${status.badge}">${escapeHTML(status.label)}</span></td><td>${submission?.status === "approved" ? `<strong>${formatPoints(submission.score)}</strong> / ${formatPoints(task.max_score)}` : "—"}</td><td>${submission?.submitted_at ? escapeHTML(formatDateTime(submission.submitted_at)) : "—"}</td><td>${submission?.reviewed_at ? escapeHTML(formatDateTime(submission.reviewed_at)) : "—"}</td><td class="report-note">${submission?.leader_note ? escapeHTML(submission.leader_note) : "—"}</td></tr>`;
      }).join("") : `<tr><td colspan="6" class="empty">No teams registered.</td></tr>`;
      return `<article class="card report-block print-page-break"><div class="report-block-header"><div><p class="eyebrow">Task ${taskIndex + 1} ${task.active ? "" : "· Hidden"}</p><h2>${escapeHTML(task.title)}</h2>${task.description ? `<p>${escapeHTML(task.description)}</p>` : ""}</div><div class="report-completion-count"><strong>${approvedCount}/${teams.length}</strong><span>teams approved</span></div></div><div class="table-wrap"><table><thead><tr><th>Team</th><th>Status</th><th>Score</th><th>Submitted</th><th>Reviewed</th><th>Leader note</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
    }).join("");
  }

  function leaderboardReport(rows) {
    if (!rows.length) return `<div class="card empty">No leaderboard data yet.</div>`;
    return `<div class="card table-wrap"><table><thead><tr><th>Rank</th><th>Team</th><th>Stations</th><th>Tasks</th><th>Station points</th><th>Task points</th><th>Total</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>#${escapeHTML(row.rank)}</strong></td><td><strong>${escapeHTML(row.team_name)}</strong></td><td>${escapeHTML(row.stations_completed ?? row.tasks_completed ?? 0)}</td><td>${escapeHTML(row.stations_completed === undefined ? 0 : row.tasks_completed || 0)}</td><td>${formatPoints(row.station_points ?? row.total_points)}</td><td>${formatPoints(row.task_points || 0)}</td><td><strong>${formatPoints(row.total_points)}</strong></td></tr>`).join("")}</tbody></table></div>`;
  }

  function draw(data) {
    const stations = data.stations || [];
    const tasks = data.tasks || [];
    const teams = data.teams || [];
    const completions = data.completions || [];
    const submissions = data.taskSubmissions || [];
    const approved = submissions.filter((item) => item.status === "approved").length;
    const pending = submissions.filter((item) => item.status === "pending").length;
    root.innerHTML = shell(`<div class="report-page">
      <section class="report-title-row"><div><p class="eyebrow">Organizer report</p><h1 class="page-title">Full Game Report</h1><p class="muted">Generated ${escapeHTML(formatDateTime(data.generatedAt))}</p></div><div class="form-actions no-print"><button id="print-report" class="btn btn-primary" type="button">Print / Save PDF</button><button id="refresh-report" class="btn btn-ghost" type="button">Refresh report</button></div></section>
      <section class="grid-4">${stat("Teams", teams.length)}${stat("Stations", stations.length)}${stat("Tasks", tasks.length)}${stat("Scores", completions.length + approved)}</section>
      <section class="grid-2"><div class="card stat"><span class="stat-value">${completions.length}</span><span class="stat-label">Station completions</span></div><div class="card stat"><span class="stat-value">${approved} approved · ${pending} pending</span><span class="stat-label">Task submissions</span></div></section>
      <section class="report-section print-page-break"><div><p class="eyebrow">Overall</p><h2 class="section-title">Team totals and leaderboard</h2></div>${leaderboardReport(data.leaderboard || [])}</section>
      <section class="report-section print-page-break"><div><p class="eyebrow">Detailed report</p><h2 class="section-title">Stations</h2><p class="small muted">Every team, completion status, score, and completion time for each station.</p></div>${stationReport(stations, teams, completions)}</section>
      <section class="report-section print-page-break"><div><p class="eyebrow">Detailed report</p><h2 class="section-title">Tasks</h2><p class="small muted">Every team, evidence-review status, awarded score, timestamps, and leader notes for each task.</p></div>${taskReport(tasks, teams, submissions)}</section>
    </div>`, { back: "/admin", backLabel: "← Admin", wide: true });
    root.querySelector("#print-report")?.addEventListener("click", () => window.print());
    root.querySelector("#refresh-report")?.addEventListener("click", load);
  }

  await load();
}
