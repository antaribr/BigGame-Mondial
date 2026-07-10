import { randomInt } from "node:crypto";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUESTION_COUNT = 50;

function numberSetting(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function getEnvironment() {
  return {
    supabaseUrl: String(process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    pointsPerCorrect: numberSetting(process.env.QUIZ_POINTS_PER_CORRECT, 0.5, 0, 100),
    quizSeconds: numberSetting(process.env.QUIZ_SECONDS, 20, 5, 3600),
    questionCount: Math.trunc(numberSetting(process.env.QUIZ_QUESTION_COUNT, 20, 1, MAX_QUESTION_COUNT)),
  };
}

function required(value, field, maximum = 100) {
  const clean = String(value || "").trim();
  if (!clean) throw new Error(`${field} is required.`);
  if (clean.length > maximum) throw new Error(`${field} is too long.`);
  return clean;
}

function normalizeCode(value, field) {
  const code = required(value, field, 8).toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) throw new Error(`${field} is not valid.`);
  return code;
}

function requireUuid(value, field) {
  const id = required(value, field, 50);
  if (!UUID_PATTERN.test(id)) throw new Error(`${field} is not valid.`);
  return id;
}

async function rest(environment, table, {
  method = "GET",
  params = {},
  body,
  prefer = "",
} = {}) {
  const url = new URL(`${environment.supabaseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const headers = {
    apikey: environment.serviceKey,
    Authorization: `Bearer ${environment.serviceKey}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;

  const result = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await result.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { message: text }; }
  }
  if (!result.ok) {
    const error = new Error(data?.message || data?.details || `Database request failed (${result.status}).`);
    error.code = data?.code || "";
    error.status = result.status;
    throw error;
  }
  return data;
}

function read(environment, table, params = {}) {
  return rest(environment, table, { params: { select: "*", ...params } });
}

function insert(environment, table, body) {
  return rest(environment, table, {
    method: "POST",
    body,
    prefer: "return=minimal",
  });
}

async function insertReturning(environment, table, body) {
  const rows = await rest(environment, table, {
    method: "POST",
    body,
    prefer: "return=representation",
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function updateReturning(environment, table, body, params) {
  const rows = await rest(environment, table, {
    method: "PATCH",
    params,
    body,
    prefer: "return=representation",
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

function upsert(environment, table, body, conflict) {
  return rest(environment, table, {
    method: "POST",
    params: { on_conflict: conflict },
    body,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
}

function attemptResult(attempt) {
  return {
    score: Number(attempt?.score || 0),
    correct_answers: Number(attempt?.correct_answers || 0),
    questions_answered: Number(attempt?.questions_answered || 0),
  };
}

async function getTeamAndStation(environment, teamCode, stationCode) {
  const [teams, stations] = await Promise.all([
    read(environment, "teams", {
      select: "id,name,code",
      code: `eq.${normalizeCode(teamCode, "Team code")}`,
      limit: 1,
    }),
    read(environment, "stations", {
      select: "id,name,code,max_score",
      code: `eq.${normalizeCode(stationCode, "Station code")}`,
      limit: 1,
    }),
  ]);
  const team = teams?.[0];
  const station = stations?.[0];
  if (!team) throw new Error("Team not found.");
  if (!station) throw new Error("Quiz station not found.");
  return { team, station };
}

async function findAttempt(environment, teamId, stationId, attemptId = "") {
  const rows = await read(environment, "quiz_attempts", {
    ...(attemptId ? { id: `eq.${attemptId}` } : {}),
    team_id: `eq.${teamId}`,
    station_id: `eq.${stationId}`,
    limit: 1,
  });
  return rows?.[0] || null;
}

function secureShuffle(values) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const selected = randomInt(0, index + 1);
    [output[index], output[selected]] = [output[selected], output[index]];
  }
  return output;
}

async function ensureAssignedQuestions(environment, attemptId) {
  let assignments = await read(environment, "quiz_attempt_questions", {
    select: "question_id,position",
    attempt_id: `eq.${attemptId}`,
    order: "position.asc",
  });

  if (!assignments.length) {
    const allQuestions = await read(environment, "questions", { select: "id" });
    const selected = secureShuffle(allQuestions || []).slice(0, environment.questionCount);
    if (!selected.length) return [];
    const rows = selected.map((question, position) => ({
      attempt_id: attemptId,
      question_id: question.id,
      position,
    }));
    try {
      await insert(environment, "quiz_attempt_questions", rows);
    } catch (error) {
      if (error.code !== "23505") throw error;
    }
    assignments = await read(environment, "quiz_attempt_questions", {
      select: "question_id,position",
      attempt_id: `eq.${attemptId}`,
      order: "position.asc",
    });
  }
  return assignments;
}

async function publicQuestions(environment, assignments) {
  if (!assignments.length) return [];
  const ids = assignments.map((item) => item.question_id);
  const rows = await read(environment, "questions", {
    select: "id,question,option_a,option_b,option_c,option_d",
    id: `in.(${ids.join(",")})`,
  });
  const byId = new Map((rows || []).map((row) => [row.id, row]));
  return assignments.map((item) => byId.get(item.question_id)).filter(Boolean);
}

async function startAttempt(environment, team, station) {
  let attempt = await findAttempt(environment, team.id, station.id);
  if (!attempt) {
    try {
      attempt = await insertReturning(environment, "quiz_attempts", {
        team_id: team.id,
        station_id: station.id,
      });
    } catch (error) {
      if (error.code !== "23505") throw error;
      attempt = await findAttempt(environment, team.id, station.id);
    }
  }
  if (!attempt) throw new Error("Could not create the quiz attempt.");
  if (attempt.completed_at) {
    return { ok: true, attempt, results: attemptResult(attempt), questions: [] };
  }

  const assignments = await ensureAssignedQuestions(environment, attempt.id);
  return {
    ok: true,
    attempt,
    questions: await publicQuestions(environment, assignments),
    limits: {
      seconds: environment.quizSeconds,
      pointsPerCorrect: environment.pointsPerCorrect,
      questionCount: environment.questionCount,
    },
  };
}

async function submitAttempt(environment, body) {
  const { team, station } = await getTeamAndStation(environment, body.teamCode, body.stationCode);
  const attemptId = requireUuid(body.attemptId, "Attempt id");
  const attempt = await findAttempt(environment, team.id, station.id, attemptId);
  if (!attempt) throw new Error("Quiz attempt not found for this team.");
  if (attempt.completed_at) return { ok: true, attempt, results: attemptResult(attempt) };

  const assignments = await read(environment, "quiz_attempt_questions", {
    select: "question_id,position",
    attempt_id: `eq.${attempt.id}`,
    order: "position.asc",
  });
  if (!assignments.length) throw new Error("This attempt has no assigned questions.");

  const ids = assignments.map((item) => item.question_id);
  const correctRows = await read(environment, "questions", {
    select: "id,correct_option",
    id: `in.(${ids.join(",")})`,
  });
  const correctById = new Map((correctRows || []).map((row) => [row.id, row.correct_option]));
  const allowedIds = new Set(ids);
  const answerById = new Map();

  if (Array.isArray(body.answers) && body.answers.length <= MAX_QUESTION_COUNT) {
    for (const answer of body.answers) {
      const questionId = String(answer?.questionId || "");
      const option = answer?.selectedOption == null ? null : String(answer.selectedOption).toUpperCase();
      if (allowedIds.has(questionId) && (option === null || ["A", "B", "C", "D"].includes(option))) {
        answerById.set(questionId, option);
      }
    }
  }

  const startedAt = new Date(attempt.started_at).getTime();
  const expired = !Number.isFinite(startedAt) || Date.now() > startedAt + (environment.quizSeconds + 5) * 1000;
  let correctCount = 0;
  const answerRows = assignments.map((assignment) => {
    const selected = expired ? null : (answerById.get(assignment.question_id) ?? null);
    const isCorrect = selected !== null && selected === correctById.get(assignment.question_id);
    if (isCorrect) correctCount += 1;
    return {
      attempt_id: attempt.id,
      question_id: assignment.question_id,
      selected_option: selected,
      is_correct: isCorrect,
    };
  });

  await upsert(environment, "quiz_answers", answerRows, "attempt_id,question_id");
  const score = Math.min(Number(station.max_score), correctCount * environment.pointsPerCorrect);
  const completedAt = new Date().toISOString();

  await upsert(environment, "completions", {
    team_id: team.id,
    station_id: station.id,
    score,
    created_at: completedAt,
  }, "team_id,station_id");

  const completed = await updateReturning(environment, "quiz_attempts", {
    score,
    correct_answers: correctCount,
    questions_answered: assignments.length,
    completed_at: completedAt,
  }, {
    id: `eq.${attempt.id}`,
    completed_at: "is.null",
  });

  const finalAttempt = completed || await findAttempt(environment, team.id, station.id, attempt.id);
  return { ok: true, attempt: finalAttempt, results: attemptResult(finalAttempt), expired };
}

function parseBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return request.body;
  const source = Buffer.isBuffer(request.body) ? request.body.toString("utf8") : String(request.body || "");
  if (!source) return {};
  try { return JSON.parse(source); }
  catch { throw new Error("Request body must be valid JSON."); }
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed." });

  const environment = getEnvironment();
  if (!environment.supabaseUrl || !environment.serviceKey) {
    return response.status(500).json({
      ok: false,
      error: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables.",
    });
  }

  let body;
  try { body = parseBody(request); }
  catch (error) { return response.status(400).json({ ok: false, error: error.message }); }

  try {
    if (body.action === "status") {
      const { team, station } = await getTeamAndStation(environment, body.teamCode, body.stationCode);
      const attempt = await findAttempt(environment, team.id, station.id);
      return response.status(200).json({
        ok: true,
        attempt,
        results: attempt?.completed_at ? attemptResult(attempt) : null,
      });
    }
    if (body.action === "start") {
      const { team, station } = await getTeamAndStation(environment, body.teamCode, body.stationCode);
      return response.status(200).json(await startAttempt(environment, team, station));
    }
    if (body.action === "submit") {
      return response.status(200).json(await submitAttempt(environment, body));
    }
    return response.status(400).json({ ok: false, error: "Unknown quiz action." });
  } catch (error) {
    console.error(error);
    return response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Quiz request failed.",
    });
  }
}
