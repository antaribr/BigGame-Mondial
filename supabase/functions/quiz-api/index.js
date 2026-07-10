import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const pointsPerCorrect = Math.max(0, Number(Deno.env.get("QUIZ_POINTS_PER_CORRECT") || 0.5));
const quizSeconds = Math.max(5, Number(Deno.env.get("QUIZ_SECONDS") || 20));
const maxQuestionCount = 50;
const quizQuestionCount = Math.max(1, Math.min(maxQuestionCount, Math.trunc(Number(Deno.env.get("QUIZ_QUESTION_COUNT") || 20))));
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function check(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function required(value, field) {
  const clean = String(value || "").trim();
  if (!clean) throw new Error(`${field} is required.`);
  return clean;
}

function resultFromAttempt(attempt) {
  return {
    score: Number(attempt?.score || 0),
    correct_answers: Number(attempt?.correct_answers || 0),
    questions_answered: Number(attempt?.questions_answered || 0),
  };
}

async function getTeamAndStation(teamCode, stationCode) {
  const [teamResult, stationResult] = await Promise.all([
    db.from("teams").select("id,name,code").eq("code", required(teamCode, "Team code").toUpperCase()).maybeSingle(),
    db.from("stations").select("id,name,code,max_score").eq("code", required(stationCode, "Station code").toUpperCase()).maybeSingle(),
  ]);
  const team = check(teamResult);
  const station = check(stationResult);
  if (!team) throw new Error("Team not found.");
  if (!station) throw new Error("Quiz station not found.");
  return { team, station };
}

async function findAttempt(teamId, stationId) {
  return check(await db.from("quiz_attempts").select("*").eq("team_id", teamId).eq("station_id", stationId).maybeSingle());
}

function secureShuffle(values) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [output[index], output[random]] = [output[random], output[index]];
  }
  return output;
}

async function ensureAssignedQuestions(attemptId, requestedCount) {
  let assignments = check(await db.from("quiz_attempt_questions").select("question_id,position").eq("attempt_id", attemptId).order("position")) || [];
  if (!assignments.length) {
    const allQuestions = check(await db.from("questions").select("id")) || [];
    const count = Math.max(1, Math.min(maxQuestionCount, Math.trunc(Number(requestedCount)) || 20));
    const selected = secureShuffle(allQuestions).slice(0, count);
    if (!selected.length) return [];
    const rows = selected.map((question, position) => ({ attempt_id: attemptId, question_id: question.id, position }));
    const insertResult = await db.from("quiz_attempt_questions").insert(rows);
    if (insertResult.error && insertResult.error.code !== "23505") throw new Error(insertResult.error.message);
    assignments = check(await db.from("quiz_attempt_questions").select("question_id,position").eq("attempt_id", attemptId).order("position")) || [];
  }
  return assignments;
}

async function publicQuestions(assignments) {
  if (!assignments.length) return [];
  const ids = assignments.map((item) => item.question_id);
  const rows = check(await db.from("questions").select("id,question,option_a,option_b,option_c,option_d").in("id", ids)) || [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  return assignments.map((item) => byId.get(item.question_id)).filter(Boolean);
}

async function startAttempt(team, station) {
  let attempt = await findAttempt(team.id, station.id);
  if (!attempt) {
    const inserted = await db.from("quiz_attempts").insert({ team_id: team.id, station_id: station.id }).select("*").single();
    if (inserted.error?.code === "23505") attempt = await findAttempt(team.id, station.id);
    else attempt = check(inserted);
  }
  if (attempt.completed_at) return { ok: true, attempt, results: resultFromAttempt(attempt), questions: [] };
  const assignments = await ensureAssignedQuestions(attempt.id, quizQuestionCount);
  return { ok: true, attempt, questions: await publicQuestions(assignments), limits: { seconds: quizSeconds, pointsPerCorrect, questionCount: quizQuestionCount } };
}

async function submitAttempt(attemptId, submittedAnswers) {
  const attempt = check(await db.from("quiz_attempts").select("*").eq("id", required(attemptId, "Attempt id")).maybeSingle());
  if (!attempt) throw new Error("Quiz attempt not found.");
  if (attempt.completed_at) return { ok: true, attempt, results: resultFromAttempt(attempt) };

  const assignments = check(await db.from("quiz_attempt_questions").select("question_id,position").eq("attempt_id", attempt.id).order("position")) || [];
  if (!assignments.length) throw new Error("This attempt has no assigned questions.");
  const ids = assignments.map((item) => item.question_id);
  const correctRows = check(await db.from("questions").select("id,correct_option").in("id", ids)) || [];
  const correctById = new Map(correctRows.map((row) => [row.id, row.correct_option]));
  const allowedIds = new Set(ids);
  const answerById = new Map();
  if (Array.isArray(submittedAnswers)) {
    for (const answer of submittedAnswers) {
      const questionId = String(answer?.questionId || "");
      const option = answer?.selectedOption == null ? null : String(answer.selectedOption).toUpperCase();
      if (allowedIds.has(questionId) && (option === null || ["A", "B", "C", "D"].includes(option))) answerById.set(questionId, option);
    }
  }

  // A small grace period allows the automatic submission request to arrive.
  // Answers received much later are stored as blank, preventing unlimited-time cheating.
  const expired = Date.now() > new Date(attempt.started_at).getTime() + (quizSeconds + 5) * 1000;
  let correctCount = 0;
  const answerRows = assignments.map((assignment) => {
    const selected = expired ? null : (answerById.get(assignment.question_id) ?? null);
    const isCorrect = selected !== null && selected === correctById.get(assignment.question_id);
    if (isCorrect) correctCount += 1;
    return { attempt_id: attempt.id, question_id: assignment.question_id, selected_option: selected, is_correct: isCorrect };
  });

  check(await db.from("quiz_answers").upsert(answerRows, { onConflict: "attempt_id,question_id" }));
  const station = check(await db.from("stations").select("id,max_score").eq("id", attempt.station_id).single());
  const score = Math.min(Number(station.max_score), correctCount * pointsPerCorrect);

  // Award the station score before marking the attempt complete. If a temporary
  // database error occurs, the client can safely retry this idempotent sequence.
  check(await db.from("completions").upsert({ team_id: attempt.team_id, station_id: attempt.station_id, score, created_at: new Date().toISOString() }, { onConflict: "team_id,station_id" }));
  const completed = check(await db.from("quiz_attempts").update({ score, correct_answers: correctCount, questions_answered: assignments.length, completed_at: new Date().toISOString() }).eq("id", attempt.id).select("*").single());
  return { ok: true, attempt: completed, results: resultFromAttempt(completed), expired };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ ok: false, error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return response({ ok: false, error: "Supabase function secrets are unavailable." }, 500);

  let body;
  try { body = await request.json(); }
  catch { return response({ ok: false, error: "Request body must be JSON." }, 400); }

  try {
    if (body.action === "status") {
      const { team, station } = await getTeamAndStation(body.teamCode, body.stationCode);
      const attempt = await findAttempt(team.id, station.id);
      return response({ ok: true, attempt, results: attempt?.completed_at ? resultFromAttempt(attempt) : null });
    }
    if (body.action === "start") {
      const { team, station } = await getTeamAndStation(body.teamCode, body.stationCode);
      return response(await startAttempt(team, station));
    }
    if (body.action === "submit") return response(await submitAttempt(body.attemptId, body.answers));
    return response({ ok: false, error: "Unknown quiz action." }, 400);
  } catch (error) {
    console.error(error);
    return response({ ok: false, error: error instanceof Error ? error.message : "Quiz request failed." }, 400);
  }
});
