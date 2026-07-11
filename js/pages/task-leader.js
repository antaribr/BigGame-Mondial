import { callTaskLeader, clearTaskLeaderToken, taskLeaderLogin, taskLeaderStatus } from "../tasks-api.js";
import { brand, escapeHTML, formatPoints, formatTime, loadingPage, setButtonBusy, shell, showFormMessage, showToast, stat } from "../ui.js";

const EMPTY_TASK = { title: "", description: "", max_score: 10, sort_order: 0, active: true };

export async function renderTaskLeader(root, context) {
  document.title = "Task Leader · BigGame";
  root.innerHTML = loadingPage("Checking task-leader session…");
  if (!(await taskLeaderStatus())) {
    if (context.isActive()) renderLogin();
    return;
  }
  if (context.isActive()) await renderDashboard();

  function renderLogin() {
    root.innerHTML = `<div class="page"><header class="header"><div class="header-inner">${brand()}</div></header>
      <main class="main" style="display:grid;place-items:center"><div class="container narrow stack">
        <div class="center"><div style="font-size:3rem">📸</div><p class="eyebrow">Evidence review</p><h1 class="page-title">Task leader</h1><p class="muted">Enter the private task-leader code.</p></div>
        <form id="leader-login" class="card card-pad stack-sm"><label class="sr-only" for="leader-code">Task-leader code</label><input id="leader-code" type="password" class="input input-code" placeholder="LEADER CODE" maxlength="80" required autocomplete="current-password"><div id="leader-message"></div><button id="leader-login-submit" class="btn btn-primary w-full" type="submit">Open task manager →</button></form>
        <div class="center"><a href="/team" data-link class="small quiet" style="text-decoration:none">← Team portal</a></div>
      </div></main></div>`;
    root.querySelector("#leader-login").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = root.querySelector("#leader-login-submit");
      const message = root.querySelector("#leader-message");
      setButtonBusy(button, true, "Checking…");
      showFormMessage(message, "");
      try {
        await taskLeaderLogin(root.querySelector("#leader-code").value);
        await renderDashboard();
      } catch (error) {
        showFormMessage(message, error.message || "Login failed.");
        setButtonBusy(button, false);
      }
    });
  }

  async function renderDashboard() {
    let tasks = [];
    let submissions = [];
    let filter = "pending";
    let editingTask = null;
    let formDirty = false;
    let loading = false;
    let lastUpdated = null;

    function isEditingForm() {
      const active = document.activeElement;
      return Boolean(active && root.contains(active) && active.closest("#task-form, .review-form"));
    }

    function showRefreshPaused() {
      const status = root.querySelector("#leader-auto-refresh");
      if (status) status.textContent = "Auto-refresh paused while editing";
    }

    async function load(showLoading = true, automatic = false) {
      if (loading) return;
      if (automatic && (formDirty || editingTask || isEditingForm())) {
        showRefreshPaused();
        return;
      }
      loading = true;
      if (showLoading) root.innerHTML = loadingPage("Loading tasks and evidence…", { wide: true });
      try {
        const data = await callTaskLeader("leaderData");
        tasks = data.tasks || [];
        submissions = data.submissions || [];
        lastUpdated = new Date();
        formDirty = false;
        if (context.isActive()) draw();
      } catch (error) {
        root.innerHTML = shell(`<div class="card card-pad center"><h1>Couldn’t load task data</h1><p class="alert alert-error">${escapeHTML(error.message)}</p><button id="leader-retry" class="btn btn-primary">Try again</button></div>`, { wide: true, action: logoutButton() });
        root.querySelector("#leader-retry")?.addEventListener("click", () => load());
        bindLogout();
      } finally {
        loading = false;
      }
    }

    function logoutButton() {
      return `<button id="leader-logout" class="header-action" type="button">Logout</button>`;
    }

    function bindLogout() {
      root.querySelector("#leader-logout")?.addEventListener("click", () => {
        clearTaskLeaderToken();
        context.navigate("/task-leader", { replace: true });
      });
    }

    function evidenceHTML(items = []) {
      if (!items.length) return `<div class="alert alert-warn">No uploaded evidence is available.</div>`;
      return `<div class="leader-evidence-grid">${items.map((item) => item.url
        ? `<a href="${escapeHTML(item.url)}" target="_blank" rel="noopener"><img src="${escapeHTML(item.url)}" alt="Evidence from ${escapeHTML(item.original_name)}" loading="lazy"><span>${escapeHTML(item.original_name)}</span></a>`
        : `<div class="evidence-missing">${escapeHTML(item.original_name)} unavailable</div>`).join("")}</div>`;
    }

    function submissionCard(submission) {
      const canReview = submission.status !== "draft";
      const defaultScore = submission.status === "approved" ? submission.score : submission.task_max_score;
      return `<article class="card submission-card">
        <div class="submission-head"><div><p class="eyebrow">${escapeHTML(submission.task_title)}</p><h3>${escapeHTML(submission.team_name)}</h3><div class="xsmall quiet">Submitted ${formatTime(submission.submitted_at)} · Maximum ${formatPoints(submission.task_max_score)} points</div></div><span class="badge task-status status-${escapeHTML(submission.status)}">${escapeHTML(submission.status)}</span></div>
        ${evidenceHTML(submission.evidence)}
        ${submission.leader_note ? `<div class="alert alert-info"><strong>Current note:</strong> ${escapeHTML(submission.leader_note)}</div>` : ""}
        ${canReview ? `<form class="review-form stack-sm" data-submission="${submission.id}">
          <div class="form-grid"><div><label class="label">Points (0–${formatPoints(submission.task_max_score)})</label><input class="input" name="score" type="number" min="0" max="${Number(submission.task_max_score)}" step="0.01" value="${Number(defaultScore)}"></div><div><label class="label">Leader note</label><input class="input" name="note" maxlength="500" value="${escapeHTML(submission.leader_note || "")}" placeholder="Feedback for the team"></div></div>
          <div class="form-actions"><button type="submit" class="btn btn-primary" data-review-status="approved">Approve & award points</button><button type="submit" class="btn btn-danger" data-review-status="rejected">Reject for resubmission</button></div>
        </form>` : `<div class="alert alert-warn">Upload is incomplete. The team can restart it.</div>`}
      </article>`;
    }

    function draw() {
      const pending = submissions.filter((item) => item.status === "pending").length;
      const approved = submissions.filter((item) => item.status === "approved").length;
      const rejected = submissions.filter((item) => item.status === "rejected").length;
      const visible = submissions.filter((item) => filter === "all" || item.status === filter);
      const taskInput = editingTask || EMPTY_TASK;
      const taskRows = tasks.length ? tasks.map((task) => `<div class="task-admin-row">
        <div><strong>${escapeHTML(task.title)}</strong><div class="small muted">${formatPoints(task.max_score)} max points · order ${escapeHTML(task.sort_order)}</div>${task.description ? `<div class="xsmall quiet">${escapeHTML(task.description)}</div>` : ""}</div>
        <span class="badge ${task.active ? "badge-success" : "badge-muted"}">${task.active ? "Active" : "Hidden"}</span>
        <div class="form-actions"><button class="btn-link edit-task" data-id="${task.id}" type="button">Edit</button><button class="btn-link toggle-task" data-id="${task.id}" data-active="${task.active}" type="button">${task.active ? "Hide" : "Activate"}</button><button class="btn-link danger delete-task" data-id="${task.id}" type="button">Delete</button></div>
      </div>`).join("") : `<div class="empty">No tasks yet.</div>`;

      root.innerHTML = shell(`
        <section style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap"><div><p class="eyebrow">Evidence review</p><h1 class="page-title">Task Leader</h1><p class="muted">Create tasks, review team pictures, and award points.</p><p id="leader-auto-refresh" class="auto-refresh-status"><span aria-hidden="true">●</span> Auto-refresh every 10 seconds · Updated ${escapeHTML(lastUpdated?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) || "now")}</p></div><button id="refresh-leader" class="btn btn-ghost" type="button">Refresh now</button></section>
        <section class="grid-4">${stat("Tasks", tasks.length)}${stat("Pending", pending)}${stat("Approved", approved)}${stat("Rejected", rejected)}</section>
        <section class="card card-pad"><h2 class="section-title">${editingTask ? "Edit task" : "Create a task"}</h2>
          <form id="task-form" class="form-grid">
            <div><label class="label" for="task-title">Task name *</label><input id="task-title" name="title" class="input" maxlength="100" required value="${escapeHTML(taskInput.title)}"></div>
            <div><label class="label" for="task-max">Maximum points *</label><input id="task-max" name="max_score" class="input" type="number" min="0" max="1000" step="0.01" required value="${Number(taskInput.max_score)}"></div>
            <div><label class="label" for="task-description">Instructions</label><textarea id="task-description" name="description" class="input" maxlength="1000">${escapeHTML(taskInput.description || "")}</textarea></div>
            <div><label class="label" for="task-order">Display order</label><input id="task-order" name="sort_order" class="input" type="number" value="${Number(taskInput.sort_order || 0)}"></div>
            <div id="task-message"></div><div class="form-actions"><button id="task-save" class="btn btn-primary" type="submit">${editingTask ? "Update task" : "Create task"}</button>${editingTask ? `<button id="cancel-task-edit" class="btn btn-ghost" type="button">Cancel</button>` : ""}</div>
          </form>
        </section>
        <section class="card"><div class="card-header"><h2>Tasks</h2></div>${taskRows}</section>
        <section class="stack-sm"><div style="display:flex;justify-content:space-between;align-items:end;gap:1rem;flex-wrap:wrap"><div><h2 class="section-title">Team evidence</h2><p class="small muted">Review pictures and award points based on the evidence.</p></div><div class="form-actions">${["pending", "approved", "rejected", "all"].map((value) => `<button class="btn btn-small ${filter === value ? "btn-primary" : "btn-ghost"}" data-submission-filter="${value}" type="button">${value[0].toUpperCase() + value.slice(1)}</button>`).join("")}</div></div>
          <div class="submission-list">${visible.length ? visible.map(submissionCard).join("") : `<div class="card empty">No ${filter === "all" ? "" : `${filter} `}submissions.</div>`}</div>
        </section>
      `, { wide: true, action: logoutButton() });
      bindEvents();
    }

    function bindEvents() {
      bindLogout();
      root.querySelector("#refresh-leader")?.addEventListener("click", () => load(false));
      root.querySelector("#cancel-task-edit")?.addEventListener("click", () => { editingTask = null; formDirty = false; draw(); });
      root.querySelector("#task-form")?.addEventListener("input", () => { formDirty = true; showRefreshPaused(); });
      root.querySelector("#task-form")?.addEventListener("submit", saveTask);
      root.querySelectorAll(".edit-task").forEach((button) => button.addEventListener("click", () => {
        editingTask = tasks.find((task) => task.id === button.dataset.id) || null;
        draw();
        root.querySelector("#task-title")?.focus();
      }));
      root.querySelectorAll(".toggle-task").forEach((button) => button.addEventListener("click", async () => {
        try { await callTaskLeader("setTaskActive", { id: button.dataset.id, value: button.dataset.active !== "true" }); await load(false); }
        catch (error) { showToast(error.message, "error"); }
      }));
      root.querySelectorAll(".delete-task").forEach((button) => button.addEventListener("click", async () => {
        if (!window.confirm("Delete this task, all submissions, evidence, and awarded task points?")) return;
        try { await callTaskLeader("deleteTask", { id: button.dataset.id }); showToast("Task deleted", "success"); await load(false); }
        catch (error) { showToast(error.message, "error"); }
      }));
      root.querySelectorAll("[data-submission-filter]").forEach((button) => button.addEventListener("click", () => { filter = button.dataset.submissionFilter; formDirty = false; draw(); }));
      root.querySelectorAll(".review-form").forEach((form) => {
        form.addEventListener("input", () => { formDirty = true; showRefreshPaused(); });
        form.addEventListener("submit", reviewSubmission);
      });
    }

    async function saveTask(event) {
      event.preventDefault();
      const button = root.querySelector("#task-save");
      const message = root.querySelector("#task-message");
      const data = Object.fromEntries(new FormData(event.currentTarget));
      data.max_score = Number(data.max_score);
      data.sort_order = Number(data.sort_order) || 0;
      data.active = editingTask ? editingTask.active : true;
      if (editingTask) data.id = editingTask.id;
      setButtonBusy(button, true, "Saving…");
      showFormMessage(message, "");
      try {
        await callTaskLeader(editingTask ? "updateTask" : "createTask", { task: data });
        showToast(editingTask ? "Task updated" : "Task created", "success");
        editingTask = null;
        await load(false);
      } catch (error) {
        showFormMessage(message, error.message);
        setButtonBusy(button, false);
      }
    }

    async function reviewSubmission(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const button = event.submitter;
      const status = button?.dataset.reviewStatus;
      const values = Object.fromEntries(new FormData(form));
      form.querySelectorAll("button").forEach((item) => { item.disabled = true; });
      try {
        await callTaskLeader("reviewSubmission", {
          id: form.dataset.submission,
          status,
          score: Number(values.score),
          note: values.note,
        });
        showToast(status === "approved" ? "Evidence approved and points awarded" : "Evidence rejected for resubmission", "success");
        await load(false);
      } catch (error) {
        showToast(error.message, "error");
        form.querySelectorAll("button").forEach((item) => { item.disabled = false; });
      }
    }

    await load();
    const autoRefresh = window.setInterval(() => {
      if (context.isActive() && document.visibilityState === "visible") load(false, true);
    }, 10000);
    context.onCleanup(() => window.clearInterval(autoRefresh));
  }
}
