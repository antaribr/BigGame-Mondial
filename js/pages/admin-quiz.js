import { adminStatus, callAdmin } from "../admin-api.js";
import { escapeHTML, formatPoints, formatTime, loadingPage, setButtonBusy, shell, showToast, stat } from "../ui.js";

const EMPTY_QUESTION = { question: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A" };

export async function renderAdminQuiz(root, context) {
  document.title = "Quiz Manager · BigGame";
  root.innerHTML = loadingPage("Checking admin session…", { back: "/admin", wide: true });
  if (!(await adminStatus())) {
    context.navigate("/admin", { replace: true });
    return;
  }

  let questions = [];
  let attempts = [];
  let teams = [];
  let filter = "all";
  let formOpen = false;
  let editing = null;

  async function load() {
    root.innerHTML = loadingPage("Loading quiz manager…", { back: "/admin", wide: true });
    try {
      const data = await callAdmin("quizData");
      questions = data.questions || [];
      attempts = data.attempts || [];
      teams = data.teams || [];
      if (context.isActive()) draw();
    } catch (error) {
      root.innerHTML = shell(`<div class="card card-pad center"><h1>Couldn’t load quiz data</h1><p class="alert alert-error">${escapeHTML(error.message)}</p><button id="quiz-retry" class="btn btn-primary">Try again</button></div>`, { back: "/admin", wide: true });
      root.querySelector("#quiz-retry")?.addEventListener("click", load);
    }
  }

  function draw() {
    const teamMap = new Map(teams.map((team) => [team.id, team]));
    const completed = attempts.filter((attempt) => attempt.completed_at);
    const filtered = attempts.filter((attempt) => filter === "all" || (filter === "completed" ? attempt.completed_at : !attempt.completed_at));
    const totalPoints = completed.reduce((sum, attempt) => sum + Number(attempt.score || 0), 0);

    const questionForm = formOpen ? `<section class="card card-pad" style="border:2px solid #c7d2fe">
      <h2 class="section-title">${editing ? "✏️ Edit question" : "➕ Add question"}</h2>
      <form id="question-form" class="stack-sm">
        <div><label class="label" for="question-text">Question</label><textarea id="question-text" name="question" class="input" required>${escapeHTML(editing?.question || "")}</textarea></div>
        <div class="form-grid">${["A", "B", "C", "D"].map((option) => `<div><label class="label" for="option-${option}">Option ${option}</label><input id="option-${option}" name="option_${option.toLowerCase()}" class="input" required value="${escapeHTML(editing?.[`option_${option.toLowerCase()}`] || "")}"></div>`).join("")}</div>
        <fieldset style="border:0;padding:0;margin:0"><legend class="label">Correct answer</legend><div class="answer-choice-grid">${["A", "B", "C", "D"].map((option) => `<label class="answer-choice ${(editing?.correct_option || "A") === option ? "selected" : ""}"><input class="sr-only correct-radio" type="radio" name="correct_option" value="${option}" ${(editing?.correct_option || "A") === option ? "checked" : ""}>Option ${option}</label>`).join("")}</div></fieldset>
        <div id="question-message"></div><div class="form-actions"><button id="question-save" class="btn btn-primary" type="submit">${editing ? "Update question" : "Add question"}</button><button id="question-cancel" class="btn btn-ghost" type="button">Cancel</button></div>
      </form>
    </section>` : "";

    const questionList = questions.length ? questions.map((question, index) => `<article class="card card-pad">
      <div style="display:flex;align-items:flex-start;gap:1rem"><span class="quiet small">#${index + 1}</span><div style="flex:1;min-width:0"><strong>${escapeHTML(question.question)}</strong><div class="form-grid" style="gap:.4rem;margin-top:.65rem">${["A", "B", "C", "D"].map((option) => `<div class="small" style="padding:.35rem .5rem;border-radius:.4rem;background:${question.correct_option === option ? "#d1fae5" : "#f8fafc"};color:${question.correct_option === option ? "#047857" : "#475569"}">${option}. ${escapeHTML(question[`option_${option.toLowerCase()}`])}${question.correct_option === option ? " ✓" : ""}</div>`).join("")}</div></div><div class="form-actions"><button class="btn-link edit-question" data-id="${question.id}" type="button">Edit</button><button class="btn-link danger delete-question" data-id="${question.id}" type="button">Delete</button></div></div>
    </article>`).join("") : `<div class="card empty">No questions yet. Add a question or import the JSON samples.</div>`;

    const attemptRows = filtered.length ? filtered.map((attempt) => {
      const team = teamMap.get(attempt.team_id);
      return `<tr><td><strong>${escapeHTML(team?.name || "Unknown team")}</strong><div class="xsmall quiet">${escapeHTML(team?.code || "")}</div></td><td>${attempt.completed_at ? `<span class="badge badge-success">✓ Completed</span>` : `<span class="badge badge-warn">⏳ In progress</span>`}</td><td>${attempt.completed_at ? `${escapeHTML(attempt.correct_answers)}/${escapeHTML(attempt.questions_answered)}` : "—"}</td><td><strong>${attempt.completed_at ? `${formatPoints(attempt.score)} pts` : "—"}</strong></td><td>${formatTime(attempt.started_at)}</td><td>${formatTime(attempt.completed_at)}</td></tr>`;
    }).join("") : `<tr><td colspan="6" class="empty">No matching quiz attempts.</td></tr>`;

    root.innerHTML = shell(`
      <section style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap"><div><h1 class="page-title" style="font-size:1.8rem">📱 QR Quiz Manager</h1><p class="muted">Manage quiz questions and team attempts.</p></div><div class="form-actions"><button id="refresh-quiz" class="btn btn-ghost" type="button">Refresh</button><button id="add-question" class="btn btn-primary" type="button">+ Add question</button></div></section>
      ${questionForm}
      <section class="stack-sm"><div style="display:flex;justify-content:space-between;align-items:end;gap:1rem;flex-wrap:wrap"><div><h2 class="section-title">Questions</h2><p class="small muted">${questions.length} questions · answers are graded securely in the Edge Function.</p></div><button id="import-questions" class="btn btn-ghost btn-small" type="button">Import sample-questions.json</button></div>${questionList}</section>
      <hr style="border:0;border-top:1px solid var(--line)">
      <section class="stack-sm"><div><h2 class="section-title">Quiz attempts</h2><p class="small muted">Monitor team progress and reset attempts when needed.</p></div>
        <div class="grid-4">${stat("Attempts", attempts.length)}${stat("Completed", completed.length)}${stat("In progress", attempts.length - completed.length)}${stat("Points given", formatPoints(totalPoints))}</div>
        <div class="form-actions" id="attempt-filters">${["all", "completed", "pending"].map((value) => `<button class="btn btn-small ${filter === value ? "btn-primary" : "btn-ghost"}" data-filter="${value}" type="button">${value[0].toUpperCase() + value.slice(1)}</button>`).join("")}</div>
        <div class="card table-wrap"><table><thead><tr><th>Team</th><th>Status</th><th>Correct</th><th>Score</th><th>Started</th><th>Completed</th></tr></thead><tbody>${attemptRows}</tbody></table></div>
        <div class="card card-pad danger-zone"><h3 class="section-title">Reset quiz attempts</h3><p class="small">Deletes attempts and quiz answers so teams can retake the quiz. Existing station points are left unchanged.</p><button id="reset-attempts" class="btn btn-danger" type="button">Reset all quiz attempts</button></div>
      </section>
    `, { back: "/admin", backLabel: "← Admin", wide: true });
    bindEvents();
  }

  function bindEvents() {
    root.querySelector("#refresh-quiz")?.addEventListener("click", load);
    root.querySelector("#add-question")?.addEventListener("click", () => { editing = { ...EMPTY_QUESTION }; formOpen = true; draw(); root.querySelector("#question-text")?.focus(); });
    root.querySelector("#question-cancel")?.addEventListener("click", () => { editing = null; formOpen = false; draw(); });
    root.querySelectorAll(".correct-radio").forEach((radio) => radio.addEventListener("change", () => {
      root.querySelectorAll(".answer-choice").forEach((label) => label.classList.toggle("selected", label.contains(radio)));
    }));
    root.querySelector("#question-form")?.addEventListener("submit", saveQuestion);
    root.querySelectorAll(".edit-question").forEach((button) => button.addEventListener("click", () => {
      editing = questions.find((question) => question.id === button.dataset.id) || null;
      formOpen = Boolean(editing);
      draw();
      root.querySelector("#question-text")?.focus();
    }));
    root.querySelectorAll(".delete-question").forEach((button) => button.addEventListener("click", async () => {
      if (!window.confirm("Delete this question?")) return;
      try { await callAdmin("deleteQuestion", { id: button.dataset.id }); showToast("Question deleted", "success"); await load(); }
      catch (error) { showToast(error.message, "error"); }
    }));
    root.querySelector("#import-questions")?.addEventListener("click", importQuestions);
    root.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { filter = button.dataset.filter; draw(); }));
    root.querySelector("#reset-attempts")?.addEventListener("click", async (event) => {
      if (!window.confirm("Delete ALL quiz attempts and answers?")) return;
      const button = event.currentTarget;
      setButtonBusy(button, true, "Resetting…");
      try { await callAdmin("resetQuizAttempts"); showToast("Quiz attempts reset", "success"); await load(); }
      catch (error) { showToast(error.message, "error"); setButtonBusy(button, false); }
    });
  }

  async function saveQuestion(event) {
    event.preventDefault();
    const button = root.querySelector("#question-save");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (editing?.id) data.id = editing.id;
    setButtonBusy(button, true, "Saving…");
    try { await callAdmin("saveQuestion", { question: data }); showToast(editing?.id ? "Question updated" : "Question added", "success"); editing = null; formOpen = false; await load(); }
    catch (error) { showToast(error.message, "error"); setButtonBusy(button, false); }
  }

  async function importQuestions(event) {
    const button = event.currentTarget;
    setButtonBusy(button, true, "Importing…");
    try {
      const response = await fetch("/data/sample-questions.json");
      if (!response.ok) throw new Error("Could not load sample-questions.json");
      const samples = await response.json();
      await callAdmin("importQuestions", { questions: samples });
      showToast("Sample questions imported", "success");
      await load();
    } catch (error) {
      showToast(error.message, "error");
      setButtonBusy(button, false);
    }
  }

  await load();
}
