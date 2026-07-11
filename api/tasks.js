import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const BUCKET = "task-evidence";
const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getEnvironment() {
  return {
    supabaseUrl: String(process.env.SUPABASE_URL || "").replace(/\/$/, ""),
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    leaderCode: process.env.TASK_LEADER_CODE || "",
    sessionSecret: process.env.ADMIN_SESSION_SECRET || "",
  };
}

function required(value, field, maximum = 500) {
  const clean = String(value || "").trim();
  if (!clean) throw new Error(`${field} is required.`);
  if (clean.length > maximum) throw new Error(`${field} is too long.`);
  return clean;
}

function requireUuid(value, field) {
  const id = required(value, field, 50);
  if (!UUID_PATTERN.test(id)) throw new Error(`${field} is not valid.`);
  return id;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function constantTimeEqual(left, right) {
  const a = createHash("sha256").update(String(left)).digest();
  const b = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(a, b);
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function createLeaderToken(secret) {
  const payload = Buffer.from(JSON.stringify({
    role: "biggame-task-leader",
    exp: Date.now() + 12 * 60 * 60 * 1000,
  })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function verifyLeaderToken(token, secret) {
  if (!token || !secret) return false;
  const [payload, signature, extra] = String(token).split(".");
  if (!payload || !signature || extra || !constantTimeEqual(signature, sign(payload, secret))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "biggame-task-leader" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
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
  return rest(environment, table, { method: "POST", body, prefer: "return=minimal" });
}

async function insertReturning(environment, table, body) {
  const rows = await rest(environment, table, { method: "POST", body, prefer: "return=representation" });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function updateReturning(environment, table, body, params) {
  const rows = await rest(environment, table, { method: "PATCH", params, body, prefer: "return=representation" });
  return Array.isArray(rows) ? rows[0] : rows;
}

function remove(environment, table, params) {
  return rest(environment, table, { method: "DELETE", params, prefer: "return=minimal" });
}

function encodedPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function storageRequest(environment, path, { method = "POST", body, extraHeaders = {} } = {}) {
  const result = await fetch(`${environment.supabaseUrl}/storage/v1${path}`, {
    method,
    headers: {
      apikey: environment.serviceKey,
      Authorization: `Bearer ${environment.serviceKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await result.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = { message: text }; }
  }
  if (!result.ok) throw new Error(data?.message || data?.error || `Storage request failed (${result.status}).`);
  return data;
}

function absoluteStorageUrl(environment, value) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${environment.supabaseUrl}/storage/v1${value.startsWith("/") ? "" : "/"}${value}`;
}

async function createSignedUpload(environment, path) {
  const data = await storageRequest(environment, `/object/upload/sign/${BUCKET}/${encodedPath(path)}`, {
    method: "POST",
    body: {},
    extraHeaders: { "x-upsert": "false" },
  });
  const signedUrl = absoluteStorageUrl(environment, data.url || "");
  const token = new URL(signedUrl).searchParams.get("token");
  if (!token) throw new Error("Supabase did not return an upload token.");
  return { path, token };
}

async function createSignedDownload(environment, path) {
  try {
    const data = await storageRequest(environment, `/object/sign/${BUCKET}/${encodedPath(path)}`, {
      method: "POST",
      body: { expiresIn: 60 * 60 },
    });
    const value = data?.signedURL || data?.signedUrl || "";
    return value ? absoluteStorageUrl(environment, value) : "";
  } catch (error) {
    console.warn(`Could not sign evidence ${path}:`, error.message);
    return "";
  }
}

async function deleteStorageObjects(environment, paths) {
  if (!paths.length) return;
  try {
    await storageRequest(environment, `/object/${BUCKET}`, {
      method: "DELETE",
      body: { prefixes: paths },
    });
  } catch (error) {
    console.warn("Could not remove one or more old evidence files:", error.message);
  }
}

async function findTeam(environment, code) {
  const clean = normalizeCode(code);
  if (!/^[A-Z0-9]{2,8}$/.test(clean)) throw new Error("Team code is not valid.");
  const rows = await read(environment, "teams", { code: `eq.${clean}`, limit: 1 });
  const team = rows?.[0];
  if (!team) throw new Error("Team not found.");
  return team;
}

async function findTask(environment, id, activeOnly = false) {
  const rows = await read(environment, "tasks", {
    id: `eq.${requireUuid(id, "Task id")}`,
    ...(activeOnly ? { active: "eq.true" } : {}),
    limit: 1,
  });
  const task = rows?.[0];
  if (!task) throw new Error("Task not found.");
  return task;
}

async function findSubmission(environment, teamId, taskId) {
  const rows = await read(environment, "task_submissions", {
    team_id: `eq.${teamId}`,
    task_id: `eq.${taskId}`,
    limit: 1,
  });
  return rows?.[0] || null;
}

async function evidenceForSubmissions(environment, submissionIds) {
  if (!submissionIds.length) return [];
  const rows = await read(environment, "task_evidence", {
    submission_id: `in.(${submissionIds.join(",")})`,
    order: "created_at.asc",
  });
  return Promise.all((rows || []).map(async (item) => ({
    id: item.id,
    submission_id: item.submission_id,
    original_name: item.original_name,
    mime_type: item.mime_type,
    size_bytes: item.size_bytes,
    url: await createSignedDownload(environment, item.storage_path),
  })));
}

function attachEvidence(submissions, evidence) {
  const grouped = new Map();
  for (const item of evidence) {
    if (!grouped.has(item.submission_id)) grouped.set(item.submission_id, []);
    grouped.get(item.submission_id).push(item);
  }
  return submissions.map((submission) => ({
    ...submission,
    evidence: grouped.get(submission.id) || [],
  }));
}

async function teamData(environment, body) {
  const team = await findTeam(environment, body.teamCode);
  const [tasks, submissions] = await Promise.all([
    read(environment, "tasks", { active: "eq.true", order: "sort_order.asc,title.asc" }),
    read(environment, "task_submissions", { team_id: `eq.${team.id}`, order: "created_at.desc" }),
  ]);
  const evidence = await evidenceForSubmissions(environment, submissions.map((item) => item.id));
  return {
    ok: true,
    team: { id: team.id, name: team.name },
    tasks,
    submissions: attachEvidence(submissions, evidence),
    limits: { maxFiles: MAX_FILES, maxFileSize: MAX_FILE_SIZE },
  };
}

function validateFiles(files) {
  if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) {
    throw new Error(`Choose 1–${MAX_FILES} evidence pictures.`);
  }
  return files.map((file, index) => {
    const name = required(file?.name, `File ${index + 1} name`, 180);
    const type = String(file?.type || "").toLowerCase();
    const size = Number(file?.size);
    if (!ALLOWED_TYPES.has(type)) throw new Error(`${name} must be a JPG, PNG, WebP, or GIF image.`);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) throw new Error(`${name} must be 5 MB or smaller.`);
    return { name, type, size: Math.trunc(size), extension: ALLOWED_TYPES.get(type) };
  });
}

async function prepareSubmission(environment, body) {
  const [team, task] = await Promise.all([
    findTeam(environment, body.teamCode),
    findTask(environment, body.taskId, true),
  ]);
  const files = validateFiles(body.files);
  let submission = await findSubmission(environment, team.id, task.id);
  if (submission && ["pending", "approved"].includes(submission.status)) {
    throw new Error(submission.status === "pending" ? "This evidence is already awaiting review." : "This task has already been approved.");
  }

  if (!submission) {
    try {
      submission = await insertReturning(environment, "task_submissions", {
        team_id: team.id,
        task_id: task.id,
        status: "draft",
        score: 0,
      });
    } catch (error) {
      if (error.code !== "23505") throw error;
      submission = await findSubmission(environment, team.id, task.id);
    }
  } else {
    const oldEvidence = await read(environment, "task_evidence", { submission_id: `eq.${submission.id}` });
    await deleteStorageObjects(environment, oldEvidence.map((item) => item.storage_path));
    await remove(environment, "task_evidence", { submission_id: `eq.${submission.id}` });
    submission = await updateReturning(environment, "task_submissions", {
      status: "draft",
      score: 0,
      leader_note: null,
      submitted_at: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    }, { id: `eq.${submission.id}` });
  }
  if (!submission) throw new Error("Could not prepare the task submission.");

  const rows = files.map((file) => ({
    id: randomUUID(),
    submission_id: submission.id,
    storage_path: `${team.id}/${task.id}/${submission.id}/${randomUUID()}.${file.extension}`,
    original_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  }));
  const uploads = await Promise.all(rows.map((row) => createSignedUpload(environment, row.storage_path)));
  await insert(environment, "task_evidence", rows);
  return { ok: true, submissionId: submission.id, bucket: BUCKET, uploads };
}

async function finalizeSubmission(environment, body) {
  const team = await findTeam(environment, body.teamCode);
  const submissionId = requireUuid(body.submissionId, "Submission id");
  const rows = await read(environment, "task_submissions", {
    id: `eq.${submissionId}`,
    team_id: `eq.${team.id}`,
    status: "eq.draft",
    limit: 1,
  });
  const submission = rows?.[0];
  if (!submission) throw new Error("Draft submission not found.");
  const evidence = await read(environment, "task_evidence", { submission_id: `eq.${submission.id}` });
  if (!evidence.length) throw new Error("Upload at least one evidence picture.");
  const now = new Date().toISOString();
  const updated = await updateReturning(environment, "task_submissions", {
    status: "pending",
    score: 0,
    leader_note: null,
    submitted_at: now,
    reviewed_at: null,
    updated_at: now,
  }, { id: `eq.${submission.id}`, status: "eq.draft" });
  if (!updated) throw new Error("Could not submit the evidence for review.");
  return { ok: true, submission: updated };
}

function cleanTaskInput(input = {}) {
  const maxScore = Number(input.max_score);
  if (!Number.isFinite(maxScore) || maxScore < 0 || maxScore > 1000) throw new Error("Maximum points must be between 0 and 1000.");
  return {
    title: required(input.title, "Task title", 100),
    description: String(input.description || "").trim().slice(0, 1000) || null,
    max_score: Math.round(maxScore * 100) / 100,
    sort_order: Math.trunc(Number(input.sort_order)) || 0,
    active: input.active === undefined ? true : Boolean(input.active),
    updated_at: new Date().toISOString(),
  };
}

async function leaderData(environment) {
  const [tasks, submissions, teams] = await Promise.all([
    read(environment, "tasks", { order: "sort_order.asc,title.asc" }),
    read(environment, "task_submissions", { order: "submitted_at.desc.nullslast,created_at.desc" }),
    read(environment, "teams", { select: "id,name" }),
  ]);
  const evidence = await evidenceForSubmissions(environment, submissions.map((item) => item.id));
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  return {
    ok: true,
    tasks,
    submissions: attachEvidence(submissions, evidence).map((submission) => ({
      ...submission,
      task_title: taskMap.get(submission.task_id)?.title || "Deleted task",
      task_max_score: Number(taskMap.get(submission.task_id)?.max_score || 0),
      team_name: teamMap.get(submission.team_id)?.name || "Deleted team",
    })),
  };
}

async function handleLeaderAction(environment, body) {
  switch (body.action) {
    case "leaderData":
      return leaderData(environment);
    case "createTask": {
      const task = await insertReturning(environment, "tasks", cleanTaskInput(body.task));
      return { ok: true, task };
    }
    case "updateTask": {
      const id = requireUuid(body.task?.id, "Task id");
      const task = await updateReturning(environment, "tasks", cleanTaskInput(body.task), { id: `eq.${id}` });
      if (!task) throw new Error("Task not found.");
      return { ok: true, task };
    }
    case "setTaskActive": {
      const id = requireUuid(body.id, "Task id");
      await updateReturning(environment, "tasks", {
        active: Boolean(body.value),
        updated_at: new Date().toISOString(),
      }, { id: `eq.${id}` });
      return { ok: true };
    }
    case "deleteTask": {
      const id = requireUuid(body.id, "Task id");
      const submissions = await read(environment, "task_submissions", { task_id: `eq.${id}`, select: "id" });
      const evidence = submissions.length
        ? await read(environment, "task_evidence", { submission_id: `in.(${submissions.map((item) => item.id).join(",")})` })
        : [];
      await deleteStorageObjects(environment, evidence.map((item) => item.storage_path));
      await remove(environment, "tasks", { id: `eq.${id}` });
      return { ok: true, removedEvidence: evidence.length };
    }
    case "reviewSubmission": {
      const id = requireUuid(body.id, "Submission id");
      const status = String(body.status || "");
      if (!["approved", "rejected"].includes(status)) throw new Error("Choose approve or reject.");
      const rows = await read(environment, "task_submissions", { id: `eq.${id}`, limit: 1 });
      const submission = rows?.[0];
      if (!submission) throw new Error("Submission not found.");
      const task = await findTask(environment, submission.task_id);
      let score = 0;
      if (status === "approved") {
        score = Number(body.score);
        if (!Number.isFinite(score) || score < 0 || score > Number(task.max_score)) {
          throw new Error(`Points must be between 0 and ${task.max_score}.`);
        }
        score = Math.round(score * 100) / 100;
      }
      const note = String(body.note || "").trim().slice(0, 500);
      if (status === "rejected" && !note) throw new Error("Add a note explaining what evidence the team should resubmit.");
      const now = new Date().toISOString();
      const reviewedAt = status === "approved" && submission.status === "approved" && submission.reviewed_at
        ? submission.reviewed_at
        : now;
      const updated = await updateReturning(environment, "task_submissions", {
        status,
        score,
        leader_note: note || null,
        reviewed_at: reviewedAt,
        updated_at: now,
      }, { id: `eq.${id}` });
      return { ok: true, submission: updated };
    }
    default:
      throw new Error("Unknown task-leader action.");
  }
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
    return response.status(500).json({ ok: false, error: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel." });
  }

  let body;
  try { body = parseBody(request); }
  catch (error) { return response.status(400).json({ ok: false, error: error.message }); }

  if (body.action === "leaderLogin") {
    if (!environment.leaderCode || !environment.sessionSecret) {
      return response.status(500).json({ ok: false, error: "Set TASK_LEADER_CODE and ADMIN_SESSION_SECRET in Vercel." });
    }
    if (!constantTimeEqual(normalizeCode(body.code), normalizeCode(environment.leaderCode))) {
      return response.status(401).json({ ok: false, error: "Wrong task-leader code." });
    }
    return response.status(200).json({ ok: true, token: createLeaderToken(environment.sessionSecret) });
  }

  if (["leaderStatus", "leaderData", "createTask", "updateTask", "setTaskActive", "deleteTask", "reviewSubmission"].includes(body.action)) {
    if (!verifyLeaderToken(request.headers["x-task-leader-token"] || "", environment.sessionSecret)) {
      return response.status(401).json({ ok: false, error: "Task-leader session is missing or expired." });
    }
    if (body.action === "leaderStatus") return response.status(200).json({ ok: true });
    try {
      return response.status(200).json(await handleLeaderAction(environment, body));
    } catch (error) {
      console.error(error);
      return response.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Task-leader request failed." });
    }
  }

  try {
    if (body.action === "teamData") return response.status(200).json(await teamData(environment, body));
    if (body.action === "prepareSubmission") return response.status(200).json(await prepareSubmission(environment, body));
    if (body.action === "finalizeSubmission") return response.status(200).json(await finalizeSubmission(environment, body));
    return response.status(400).json({ ok: false, error: "Unknown task action." });
  } catch (error) {
    console.error(error);
    return response.status(400).json({ ok: false, error: error instanceof Error ? error.message : "Task request failed." });
  }
}
