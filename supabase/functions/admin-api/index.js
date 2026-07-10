import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-admin-token, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" };
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const encoder = new TextEncoder();
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const adminCode = Deno.env.get("ADMIN_CODE") || "";
const sessionSecret = Deno.env.get("ADMIN_SESSION_SECRET") || "";
const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
}

function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left));
  const b = encoder.encode(String(right));
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index % (a.length || 1)] || 0) ^ (b[index % (b.length || 1)] || 0);
  return mismatch === 0;
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function hmac(value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(sessionSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function createToken() {
  const payload = base64url(encoder.encode(JSON.stringify({ role: "biggame-admin", exp: Date.now() + 12 * 60 * 60 * 1000 })));
  return `${payload}.${await hmac(payload)}`;
}

async function verifyToken(token) {
  if (!sessionSecret || !token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = await hmac(payload);
  if (!constantTimeEqual(signature, expected)) return false;
  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const json = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    const data = JSON.parse(json);
    return data.role === "biggame-admin" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

function randomCode(length = 5) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

function requireString(value, field, max = 500) {
  const clean = String(value || "").trim();
  if (!clean) throw new Error(`${field} is required.`);
  if (clean.length > max) throw new Error(`${field} is too long.`);
  return clean;
}

function check(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function handleAction(body) {
  switch (body.action) {
    case "status":
      return { ok: true };

    case "createStation": {
      const station = body.station || {};
      const name = requireString(station.name, "Station name", 60);
      const code = normalizeCode(station.code) || randomCode();
      if (!/^[A-Z0-9]{2,8}$/.test(code)) throw new Error("Station code must be 2–8 letters or numbers.");
      const maxScore = Math.max(0, Math.min(100, Math.trunc(Number(station.max_score))));
      check(await db.from("stations").insert({
        name,
        description: String(station.description || "").trim().slice(0, 120) || null,
        code,
        sort_order: Math.trunc(Number(station.sort_order)) || 0,
        max_score: Number.isFinite(maxScore) ? maxScore : 10,
      }));
      return { ok: true, code };
    }

    case "deleteStation":
      check(await db.from("stations").delete().eq("id", requireString(body.id, "Station id", 50)));
      return { ok: true };

    case "setLeaderboardPublic":
      check(await db.from("settings").upsert({ id: 1, leaderboard_public: Boolean(body.value) }));
      return { ok: true };

    case "addMember":
      check(await db.from("members").insert({ team_id: requireString(body.teamId, "Team id", 50), name: requireString(body.name, "Member name", 40) }));
      return { ok: true };

    case "removeMember":
      check(await db.from("members").delete().eq("id", requireString(body.id, "Member id", 50)));
      return { ok: true };

    case "createQRStation": {
      const existing = check(await db.from("stations").select("code").eq("code", "QRQUIZ").maybeSingle());
      if (!existing) check(await db.from("stations").insert({ name: "Find and Scan the QR code", description: "Scan the QR code to answer the timed quiz", code: "QRQUIZ", sort_order: 999, max_score: 10 }));
      return { ok: true, code: "QRQUIZ" };
    }

    case "resetGame":
      check(await db.from("quiz_answers").delete().neq("id", ZERO_UUID));
      check(await db.from("quiz_attempt_questions").delete().neq("attempt_id", ZERO_UUID));
      check(await db.from("quiz_attempts").delete().neq("id", ZERO_UUID));
      check(await db.from("completions").delete().neq("id", ZERO_UUID));
      check(await db.from("members").delete().neq("id", ZERO_UUID));
      check(await db.from("teams").delete().neq("id", ZERO_UUID));
      return { ok: true };

    case "adminData": {
      const [stationResult, teamResult, boardResult, memberResult, settingsResult] = await Promise.all([
        db.from("stations").select("*").order("sort_order").order("name"),
        db.from("teams").select("*").order("created_at", { ascending: false }),
        db.from("leaderboard").select("*").order("rank"),
        db.from("members").select("*").order("created_at"),
        db.from("settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      return {
        ok: true,
        stations: check(stationResult) || [],
        teams: check(teamResult) || [],
        leaderboard: check(boardResult) || [],
        members: check(memberResult) || [],
        settings: check(settingsResult) || { id: 1, leaderboard_public: true },
      };
    }

    case "quizData": {
      const [questionResult, attemptResult, teamResult] = await Promise.all([
        db.from("questions").select("*").order("created_at", { ascending: false }),
        db.from("quiz_attempts").select("*").order("started_at", { ascending: false }),
        db.from("teams").select("*").order("name", { ascending: true }),
      ]);
      return { ok: true, questions: check(questionResult) || [], attempts: check(attemptResult) || [], teams: check(teamResult) || [] };
    }

    case "saveQuestion": {
      const input = body.question || {};
      const question = {
        question: requireString(input.question, "Question", 1000),
        option_a: requireString(input.option_a, "Option A", 500),
        option_b: requireString(input.option_b, "Option B", 500),
        option_c: requireString(input.option_c, "Option C", 500),
        option_d: requireString(input.option_d, "Option D", 500),
        correct_option: normalizeCode(input.correct_option),
      };
      if (!["A", "B", "C", "D"].includes(question.correct_option)) throw new Error("Correct option must be A, B, C, or D.");
      if (input.id) check(await db.from("questions").update(question).eq("id", String(input.id)));
      else check(await db.from("questions").insert(question));
      return { ok: true };
    }

    case "deleteQuestion":
      check(await db.from("questions").delete().eq("id", requireString(body.id, "Question id", 50)));
      return { ok: true };

    case "importQuestions": {
      if (!Array.isArray(body.questions) || !body.questions.length || body.questions.length > 100) throw new Error("Provide 1–100 questions.");
      const rows = body.questions.map((input) => {
        const row = {
          question: requireString(input.question, "Question", 1000),
          option_a: requireString(input.option_a, "Option A", 500),
          option_b: requireString(input.option_b, "Option B", 500),
          option_c: requireString(input.option_c, "Option C", 500),
          option_d: requireString(input.option_d, "Option D", 500),
          correct_option: normalizeCode(input.correct_option),
        };
        if (!["A", "B", "C", "D"].includes(row.correct_option)) throw new Error("Every correct option must be A, B, C, or D.");
        return row;
      });
      check(await db.from("questions").insert(rows));
      return { ok: true, imported: rows.length };
    }

    case "resetQuizAttempts":
      check(await db.from("quiz_answers").delete().neq("id", ZERO_UUID));
      check(await db.from("quiz_attempts").delete().neq("id", ZERO_UUID));
      return { ok: true };

    default:
      throw new Error("Unknown admin action.");
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ ok: false, error: "Method not allowed" }, 405);
  if (!supabaseUrl || !serviceKey) return response({ ok: false, error: "Supabase function secrets are unavailable." }, 500);

  let body;
  try { body = await request.json(); }
  catch { return response({ ok: false, error: "Request body must be JSON." }, 400); }

  if (body.action === "login") {
    if (!adminCode || !sessionSecret) return response({ ok: false, error: "Set ADMIN_CODE and ADMIN_SESSION_SECRET in Supabase secrets." }, 500);
    if (!constantTimeEqual(normalizeCode(body.code), normalizeCode(adminCode))) return response({ ok: false, error: "Wrong admin code." }, 401);
    return response({ ok: true, token: await createToken() });
  }

  if (!(await verifyToken(request.headers.get("x-admin-token") || ""))) return response({ ok: false, error: "Admin session is missing or expired." }, 401);

  try {
    return response(await handleAction(body));
  } catch (error) {
    console.error(error);
    return response({ ok: false, error: error instanceof Error ? error.message : "Admin request failed." }, 400);
  }
});
