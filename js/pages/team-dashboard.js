import {
  fetchCompletionsForTeam,
  fetchLeaderboard,
  fetchMembers,
  fetchSettings,
  fetchStations,
  fetchTeamByCode,
} from "../api.js";
import { subscribeToChanges } from "../realtime.js";
import { getSupabase } from "../supabase-client.js";
import { callTeamTasks } from "../tasks-api.js";
import { escapeHTML, formatPoints, leaderboardList, loadingPage, shell, showToast, stat } from "../ui.js";

const TEAM_KEY = "bg_team_code";

export async function renderTeamDashboard(root, context) {
  const code = context.params.code.toUpperCase();
  document.title = `${code} · Team · BigGame`;
  root.innerHTML = loadingPage("Loading your team…", { back: "/team" });

  let firstLoad = true;
  let activeSection = "activities";
  let modalOpen = false;
  let latest = null;

  async function load() {
    try {
      const team = await fetchTeamByCode(code);
      if (!context.isActive()) return;
      if (!team) {
        root.innerHTML = shell(`<div class="card card-pad center"><h1 class="section-title">Team not found</h1><p class="muted">Check the code and try again.</p><a href="/team" data-link class="btn btn-primary">Enter team code</a></div>`, { back: "/team" });
        return;
      }
      localStorage.setItem(TEAM_KEY, team.code);
      const [members, stations, completions, board, settings, taskData] = await Promise.all([
        fetchMembers(team.id),
        fetchStations(),
        fetchCompletionsForTeam(team.id),
        fetchLeaderboard(),
        fetchSettings(),
        callTeamTasks("teamData", { teamCode: team.code }),
      ]);
      if (!context.isActive()) return;
      latest = { team, members, stations, completions, board, settings, taskData };
      renderView();
      if (firstLoad) {
        firstLoad = false;
        context.onCleanup(subscribeToChanges(["completions", "stations", "teams", "members", "settings"], load));
        const poll = window.setInterval(() => {
          if (!modalOpen && context.isActive()) load();
        }, 15000);
        context.onCleanup(() => window.clearInterval(poll));
      }
    } catch (error) {
      if (!context.isActive()) return;
      root.innerHTML = shell(`<div class="card card-pad center"><h1 class="section-title">Couldn’t load this team</h1><p class="alert alert-error">${escapeHTML(error.message)}</p><button id="team-retry" class="btn btn-primary">Try again</button></div>`, { back: "/team" });
      root.querySelector("#team-retry")?.addEventListener("click", load);
    }
  }

  function evidenceHTML(evidence = []) {
    if (!evidence.length) return "";
    return `<div class="evidence-grid">${evidence.map((item) => item.url
      ? `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener" title="${escapeHTML(item.original_name)}"><img src="${escapeHTML(item.url)}" alt="Task evidence: ${escapeHTML(item.original_name)}" loading="lazy"></a>`
      : `<div class="evidence-missing">Image unavailable</div>`).join("")}</div>`;
  }

  function taskCard(task, submission) {
    const status = submission?.status || "not-submitted";
    const statusLabels = {
      draft: "Draft",
      pending: "Awaiting review",
      approved: "Approved",
      rejected: "Needs resubmission",
      "not-submitted": "Not submitted",
    };
    const button = ["not-submitted", "draft", "rejected"].includes(status)
      ? `<button class="btn ${status === "rejected" ? "btn-ghost" : "btn-primary"} submit-task-evidence" data-task="${task.id}" type="button">${status === "rejected" ? "Resubmit evidence" : status === "draft" ? "Start upload again" : "Submit evidence"}</button>`
      : "";
    return `<article class="card task-card">
      <div class="task-card-head"><div><div class="task-title">${escapeHTML(task.title)}</div><div class="small muted">Up to ${formatPoints(task.max_score)} points</div></div><span class="badge task-status status-${status}">${escapeHTML(statusLabels[status])}</span></div>
      ${task.description ? `<p class="small muted task-description">${escapeHTML(task.description)}</p>` : ""}
      ${submission?.status === "approved" ? `<div class="task-award">+${formatPoints(submission.score)} points</div>` : ""}
      ${submission?.leader_note ? `<div class="alert ${submission.status === "rejected" ? "alert-error" : "alert-info"}"><strong>Leader note:</strong> ${escapeHTML(submission.leader_note)}</div>` : ""}
      ${evidenceHTML(submission?.evidence)}
      ${button ? `<div class="task-actions">${button}</div>` : ""}
    </article>`;
  }

  function renderView() {
    if (!latest) return;
    const { team, members, stations, completions, board, settings, taskData } = latest;
    const tasks = taskData.tasks || [];
    const submissions = taskData.submissions || [];
    const submissionByTask = new Map(submissions.map((item) => [item.task_id, item]));
    const completionByStation = new Map(completions.map((item) => [item.station_id, item]));
    const myBoardRow = board.find((row) => row.team_id === team.id);
    const total = myBoardRow?.total_points || 0;
    const stationsCompleted = Number(myBoardRow?.stations_completed ?? completions.length);
    const tasksCompleted = Number(myBoardRow?.tasks_completed ?? submissions.filter((item) => item.status === "approved").length);
    const totalActivities = stations.length + tasks.length;
    const completedActivities = stationsCompleted + tasksCompleted;
    const maxTotal = stations.reduce((sum, station) => sum + Number(station.max_score || 0), 0)
      + tasks.reduce((sum, task) => sum + Number(task.max_score || 0), 0);
    const progress = totalActivities ? Math.min(100, Math.round((completedActivities / totalActivities) * 100)) : 0;

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

    const tasksHTML = tasks.length
      ? tasks.map((task) => taskCard(task, submissionByTask.get(task.id))).join("")
      : `<div class="card empty">No evidence tasks have been added yet.</div>`;

    const activitiesSection = `<section class="stack-sm">
      <div><h2 class="section-title">Stations</h2><p class="small muted">Complete the live activity stations first.</p></div>
      <div class="station-list">${stationHTML}</div>
    </section>
    <section class="stack-sm">
      <div><h2 class="section-title">Tasks</h2><p class="small muted">Complete a task and submit up to ${taskData.limits?.maxFiles || 5} evidence pictures for review.</p></div>
      <div class="task-list">${tasksHTML}</div>
    </section>`;

    const leaderboardSection = settings.leaderboard_public
      ? `<section class="stack-sm"><div><h2 class="section-title">Live leaderboard</h2><p class="small muted">Station scores and approved task points are included.</p></div>${leaderboardList(board, team.id)}</section>`
      : `<section class="card card-pad center"><div style="font-size:2rem">🔒</div><h2 class="section-title">Leaderboard hidden</h2><p class="small muted" style="margin-bottom:0">The organizer has hidden rankings for now.</p></section>`;

    root.innerHTML = shell(`
      <section class="center">
        <p class="eyebrow">Team dashboard</p>
        <h1 class="page-title">${escapeHTML(team.name)}</h1>
        <button id="copy-team-code" class="code-badge" type="button" title="Copy team code">${escapeHTML(team.code)} ⧉</button>
        <p class="xsmall quiet" style="margin-top:.45rem">Save this code to rejoin later</p>
      </section>
      <section class="grid-3">
        ${stat("Points", `${formatPoints(total)}${maxTotal ? ` / ${formatPoints(maxTotal)}` : ""}`)}
        ${stat("Completed", `${completedActivities} / ${totalActivities}`)}
        ${stat("Rank", settings.leaderboard_public && myBoardRow ? `#${myBoardRow.rank}` : "—")}
      </section>
      <section class="card card-pad">
        <div style="display:flex;justify-content:space-between;gap:1rem"><strong>Game progress</strong><span class="small muted">${progress}%</span></div>
        <div class="progress" style="margin-top:.65rem"><div class="progress-bar" style="width:${progress}%"></div></div>
        <div class="small muted" style="margin-top:.65rem">${stationsCompleted}/${stations.length} stations · ${tasksCompleted}/${tasks.length} tasks approved</div>
        ${members.length ? `<div class="member-chips" style="margin-top:1rem">${members.map((member) => `<span class="member-chip">${escapeHTML(member.name)}</span>`).join("")}</div>` : ""}
      </section>
      <section class="team-section-buttons" aria-label="Team dashboard sections">
        <button type="button" class="team-section-button ${activeSection === "activities" ? "active" : ""}" data-team-section="activities"><span class="section-button-icon">🎯</span><span><strong>Tasks & Stations</strong><small>Activities and evidence</small></span></button>
        <button type="button" class="team-section-button ${activeSection === "leaderboard" ? "active" : ""}" data-team-section="leaderboard"><span class="section-button-icon">🏆</span><span><strong>Leaderboard</strong><small>Live team rankings</small></span></button>
      </section>
      ${activeSection === "activities" ? activitiesSection : leaderboardSection}
      <div class="center"><button id="forget-team" class="btn-link danger" type="button">Forget saved team on this device</button></div>
    `, { back: "/team", backLabel: "Switch team" });

    root.querySelectorAll("[data-team-section]").forEach((button) => button.addEventListener("click", () => {
      activeSection = button.dataset.teamSection;
      renderView();
    }));
    root.querySelectorAll(".submit-task-evidence").forEach((button) => button.addEventListener("click", () => {
      const task = tasks.find((item) => item.id === button.dataset.task);
      if (task) openEvidenceModal(task, submissionByTask.get(task.id));
    }));
    root.querySelector("#copy-team-code")?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(team.code); root.querySelector("#copy-team-code").textContent = `${team.code} ✓`; }
      catch { window.prompt("Your team code:", team.code); }
    });
    root.querySelector("#forget-team")?.addEventListener("click", () => {
      localStorage.removeItem(TEAM_KEY);
      context.navigate("/team");
    });
  }

  function openEvidenceModal(task, submission) {
    if (modalOpen) return;
    modalOpen = true;
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal card"><div class="task-card-head"><div><p class="eyebrow">Submit task evidence</p><h2 style="margin-bottom:.25rem">${escapeHTML(task.title)}</h2><p class="small muted">Up to ${formatPoints(task.max_score)} points</p></div><button id="close-evidence" class="btn btn-ghost btn-small" type="button" aria-label="Close">✕</button></div>
      ${submission?.status === "rejected" && submission.leader_note ? `<div class="alert alert-error"><strong>Previous review:</strong> ${escapeHTML(submission.leader_note)}</div>` : ""}
      <form id="evidence-form" class="stack-sm" style="margin-top:1rem">
        <div><label class="label" for="evidence-files">Evidence pictures</label><input id="evidence-files" class="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple required><p class="xsmall quiet" style="margin:.4rem 0 0">Choose 1–${latest.taskData.limits?.maxFiles || 5} images. Maximum 5 MB each.</p></div>
        <div id="evidence-file-list" class="small muted"></div>
        <div id="evidence-message"></div>
        <button id="evidence-submit" class="btn btn-primary w-full" type="submit">Upload and submit for review</button>
      </form></div>`;
    document.body.append(backdrop);
    const close = () => {
      backdrop.remove();
      modalOpen = false;
    };
    backdrop.querySelector("#close-evidence").addEventListener("click", close);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
    const input = backdrop.querySelector("#evidence-files");
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      backdrop.querySelector("#evidence-file-list").textContent = files.length ? files.map((file) => file.name).join(" · ") : "";
    });
    backdrop.querySelector("#evidence-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const files = Array.from(input.files || []);
      const button = backdrop.querySelector("#evidence-submit");
      const message = backdrop.querySelector("#evidence-message");
      message.innerHTML = "";
      if (!files.length || files.length > (latest.taskData.limits?.maxFiles || 5)) {
        message.innerHTML = `<div class="alert alert-error">Choose 1–${latest.taskData.limits?.maxFiles || 5} pictures.</div>`;
        return;
      }
      button.disabled = true;
      button.textContent = "Preparing upload…";
      try {
        const prepared = await callTeamTasks("prepareSubmission", {
          teamCode: latest.team.code,
          taskId: task.id,
          files: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
        });
        if (prepared.uploads.length !== files.length) throw new Error("The upload could not be prepared.");
        for (let index = 0; index < files.length; index += 1) {
          button.textContent = `Uploading ${index + 1} of ${files.length}…`;
          const upload = prepared.uploads[index];
          const result = await getSupabase().storage.from(prepared.bucket).uploadToSignedUrl(
            upload.path,
            upload.token,
            files[index],
            { contentType: files[index].type, upsert: false },
          );
          if (result.error) throw new Error(result.error.message);
        }
        button.textContent = "Submitting for review…";
        await callTeamTasks("finalizeSubmission", {
          teamCode: latest.team.code,
          submissionId: prepared.submissionId,
        });
        showToast("Evidence submitted to the task leader", "success");
        close();
        await load();
      } catch (error) {
        message.innerHTML = `<div class="alert alert-error">${escapeHTML(error.message || "Evidence upload failed.")}</div>`;
        button.disabled = false;
        button.textContent = "Try upload again";
      }
    });
  }

  await load();
}
