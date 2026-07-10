import { fetchStationByCode, fetchTeamByCode } from "../api.js";
import { callQuiz } from "../admin-api.js";
import { escapeHTML, formatPoints, loadingPage, shell, showToast } from "../ui.js";

const TEAM_KEY = "bg_team_code";

export async function renderQuiz(root, context) {
  const stationCode = context.params.stationCode.toUpperCase();
  document.title = "QR Quiz · BigGame";
  root.innerHTML = loadingPage("Loading quiz…", { back: "/team" });

  let station;
  let selectedTeam = null;
  let attempt = null;
  let questions = [];
  let current = 0;
  let answers = new Map();
  let results = null;
  let timer = null;
  let deadline = 0;
  let submitting = false;

  try {
    station = await fetchStationByCode(stationCode);
    if (!context.isActive()) return;
    if (!station) {
      root.innerHTML = shell(`<div class="card card-pad center"><h1>Quiz station not found</h1><p class="muted">The QR link may be invalid.</p><a href="/team" data-link class="btn btn-primary">Team portal</a></div>`, { back: "/team" });
      return;
    }
    drawTeamSelection();
  } catch (error) {
    root.innerHTML = shell(`<div class="card card-pad center"><h1>Couldn’t load the quiz</h1><p class="alert alert-error">${escapeHTML(error.message)}</p></div>`, { back: "/team" });
  }

  function drawTeamSelection() {
    const savedCode = localStorage.getItem(TEAM_KEY) || "";
    root.innerHTML = shell(`
      <section class="center"><div style="font-size:3rem">📱</div><p class="eyebrow">QR code quiz</p><h1 class="page-title">${escapeHTML(station.name)}</h1><p class="muted">Enter your private team code to continue.</p></section>
      <form id="quiz-team-form" class="card card-pad stack-sm"><label class="label" for="quiz-team-code">Team code</label><input id="quiz-team-code" class="input input-code" maxlength="8" placeholder="FX7Q2" value="${escapeHTML(savedCode)}" required autocomplete="off" autocapitalize="characters"><div id="quiz-team-message"></div><button id="quiz-team-submit" class="btn btn-primary w-full" type="submit">Continue →</button></form>
    `, { back: "/team" });
    const form = root.querySelector("#quiz-team-form");
    const input = root.querySelector("#quiz-team-code");
    input.addEventListener("input", () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = root.querySelector("#quiz-team-submit");
      const message = root.querySelector("#quiz-team-message");
      button.disabled = true;
      button.textContent = "Checking…";
      message.innerHTML = "";
      try {
        selectedTeam = await fetchTeamByCode(input.value);
        if (!selectedTeam) throw new Error("No team was found with that code.");
        localStorage.setItem(TEAM_KEY, selectedTeam.code);
        root.innerHTML = loadingPage("Checking quiz attempt…", { back: "/team" });
        const response = await callQuiz("status", { teamCode: selectedTeam.code, stationCode });
        if (response.attempt?.completed_at) {
          results = response.results;
          drawAlreadyDone();
        } else {
          drawReady();
        }
      } catch (error) {
        const errorMessage = error.message || "Could not find that team.";
        drawTeamSelection();
        const currentMessage = root.querySelector("#quiz-team-message");
        if (currentMessage) currentMessage.innerHTML = `<div class="alert alert-error">${escapeHTML(errorMessage)}</div>`;
      }
    });
  }

  function drawReady() {
    const config = window.bigGameConfig;
    root.innerHTML = shell(`
      <section class="center"><div style="font-size:4rem">🎯</div><h1 class="page-title">Ready, ${escapeHTML(selectedTeam.name)}?</h1><p class="muted">Answer up to <strong>${config.quiz.questionCount} questions</strong> in <strong>${config.quiz.seconds} seconds</strong>.</p><p class="small quiet">Each correct answer earns ${formatPoints(config.quiz.pointsPerCorrect)} points. One attempt per team.</p><button id="start-quiz" class="btn btn-primary" style="margin-top:1.5rem;padding:1rem 2rem">🚀 Start quiz</button><button id="change-quiz-team" class="btn btn-ghost" style="margin:1.5rem 0 0 .5rem">Change team</button></section>
    `, { back: "/team" });
    root.querySelector("#start-quiz").addEventListener("click", startQuiz);
    root.querySelector("#change-quiz-team").addEventListener("click", drawTeamSelection);
  }

  async function startQuiz(event) {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Starting…";
    try {
      const config = window.bigGameConfig;
      const response = await callQuiz("start", {
        teamCode: selectedTeam.code,
        stationCode,
        questionCount: config.quiz.questionCount,
      });
      if (response.attempt?.completed_at) {
        results = response.results;
        drawAlreadyDone();
        return;
      }
      attempt = response.attempt;
      questions = response.questions || [];
      if (!questions.length) throw new Error("No quiz questions are available. Ask the organizer to add some.");
      answers = new Map();
      current = 0;
      const started = new Date(attempt.started_at).getTime();
      const enforcedSeconds = Number(response.limits?.seconds) || config.quiz.seconds;
      deadline = started + enforcedSeconds * 1000;
      drawQuestion();
      startTimer();
    } catch (error) {
      showToast(error.message, "error");
      drawReady();
    }
  }

  function startTimer() {
    clearInterval(timer);
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      const element = root.querySelector("#quiz-timer");
      if (element) {
        element.textContent = `⏱️ ${seconds}s`;
        element.classList.toggle("low", seconds <= 5);
      }
      if (seconds <= 0) {
        clearInterval(timer);
        submitQuiz();
      }
    };
    tick();
    timer = setInterval(tick, 250);
    context.onCleanup(() => clearInterval(timer));
  }

  function drawQuestion() {
    if (!questions[current] || submitting) return;
    const question = questions[current];
    const progress = Math.round(((current + 1) / questions.length) * 100);
    root.innerHTML = shell(`
      <section class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem"><span class="small muted">Question ${current + 1} of ${questions.length}</span><span id="quiz-timer" class="timer">⏱️</span></div>
        <div class="progress" style="margin-top:.6rem"><div class="progress-bar" style="width:${progress}%"></div></div>
      </section>
      <section class="card card-pad"><h1 class="section-title" style="line-height:1.45;margin-bottom:1.25rem">${escapeHTML(question.question)}</h1><div class="stack-sm">${["A", "B", "C", "D"].map((option) => `<button type="button" class="quiz-option ${answers.get(question.id) === option ? "selected" : ""}" data-option="${option}"><span class="option-letter">${option}</span>${escapeHTML(question[`option_${option.toLowerCase()}`])}</button>`).join("")}</div></section>
      <section class="quiz-dots">${questions.map((item, index) => `<button type="button" class="quiz-dot ${index === current ? "current" : answers.has(item.id) ? "answered" : ""}" data-question-index="${index}" aria-label="Go to question ${index + 1}"></button>`).join("")}</section>
      <section class="form-actions" style="justify-content:space-between"><button id="previous-question" class="btn btn-ghost" ${current === 0 ? "disabled" : ""}>← Previous</button>${answers.size === questions.length ? `<button id="submit-quiz" class="btn btn-primary">Submit answers (${answers.size}/${questions.length})</button>` : `<button id="next-question" class="btn btn-ghost" ${current === questions.length - 1 ? "disabled" : ""}>Next →</button>`}</section>
    `, { back: "/team" });
    root.querySelectorAll(".quiz-option").forEach((button) => button.addEventListener("click", () => {
      const answeredIndex = current;
      answers.set(question.id, button.dataset.option);
      drawQuestion();
      if (answeredIndex < questions.length - 1) setTimeout(() => {
        if (context.isActive() && current === answeredIndex && answers.has(question.id)) {
          current += 1;
          drawQuestion();
        }
      }, 220);
    }));
    root.querySelectorAll("[data-question-index]").forEach((button) => button.addEventListener("click", () => { current = Number(button.dataset.questionIndex); drawQuestion(); }));
    root.querySelector("#previous-question")?.addEventListener("click", () => { current -= 1; drawQuestion(); });
    root.querySelector("#next-question")?.addEventListener("click", () => { current += 1; drawQuestion(); });
    root.querySelector("#submit-quiz")?.addEventListener("click", submitQuiz);
  }

  async function submitQuiz() {
    if (submitting || !attempt) return;
    submitting = true;
    clearInterval(timer);
    root.innerHTML = loadingPage("Grading your answers…", { back: "/team" });
    try {
      const response = await callQuiz("submit", {
        attemptId: attempt.id,
        teamCode: selectedTeam.code,
        stationCode,
        answers: questions.map((question) => ({ questionId: question.id, selectedOption: answers.get(question.id) || null })),
      });
      results = response.results;
      drawResults();
    } catch (error) {
      submitting = false;
      showToast(error.message, "error");
      drawQuestion();
      startTimer();
    }
  }

  function resultContent(already = false) {
    const total = Number(results?.questions_answered || 0);
    const percentage = total ? Math.round((Number(results.correct_answers) / total) * 100) : 0;
    const icon = already ? "✅" : percentage >= 80 ? "🏆" : percentage >= 50 ? "👍" : "📚";
    return `<section class="center"><div style="font-size:4rem">${icon}</div><h1 class="page-title">${already ? "Quiz already completed" : "Quiz complete!"}</h1><p class="muted">${escapeHTML(selectedTeam?.name || "Team")}, ${already ? "this team has already taken the quiz." : "your results are in."}</p>
      <div class="grid-3" style="margin-top:1.5rem"><div class="card stat"><span class="stat-value" style="color:var(--indigo)">${formatPoints(results?.score)}</span><span class="stat-label">Points</span></div><div class="card stat"><span class="stat-value" style="color:var(--green)">${escapeHTML(results?.correct_answers || 0)}</span><span class="stat-label">Correct</span></div><div class="card stat"><span class="stat-value">${percentage}%</span><span class="stat-label">Accuracy</span></div></div>
      <p class="small muted" style="margin-top:1.5rem">${already ? "Only one attempt is allowed per team." : "Points were added to your team automatically. 🎉"}</p><a href="/team" data-link class="btn btn-primary" style="margin-top:.5rem">Back to team portal</a></section>`;
  }

  function drawAlreadyDone() { root.innerHTML = shell(resultContent(true), { back: "/team" }); }
  function drawResults() { root.innerHTML = shell(resultContent(false), { back: "/team" }); }
}
