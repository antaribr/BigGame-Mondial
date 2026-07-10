import { createClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function getEnvironment() {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    adminCode: process.env.ADMIN_CODE || "",
    sessionSecret: process.env.ADMIN_SESSION_SECRET || "",
  };
}

function makeDatabase(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

function createToken(secret) {
  const payload = Buffer.from(JSON.stringify({
    role: "biggame-admin",
    exp: Date.now() + 12 * 60 * 60 * 1000,
  })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function verifyToken(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (!constantTimeEqual(signature, sign(payload, secret))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "biggame-admin" && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

function randomCode(length = 5) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => alphabet[randomInt(0, alphabet.length)]).join("");
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

async function handleAction(body, db) {
  switch (body.action) {
    case "status":
      return { ok: true };

    case "createStation": {
      const station = body.station || {};
      const name = requireString(station.name, "Station name", 60);
      const code = normalizeCode(station.code) || randomCode();
      if (!/^[A-Z0-9]{2,8}$/.test(code)) throw new Error("Station code must be 2–8 letters or numbers.");
      const rawMaximum = Number(station.max_score);
      const maxScore = Number.isFinite(rawMaximum)
        ? Math.max(0, Math.min(100, Math.trunc(rawMaximum)))
        : 10;
      check(await db.from("stations").insert({
        name,
        description: String(station.description || "").trim().slice(0, 120) || null,
        code,
        sort_order: Math.trunc(Number(station.sort_order)) || 0,
        max_score: maxScore,
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
      check(await db.from("members").insert({
        team_id: requireString(body.teamId, "Team id", 50),
        name: requireString(body.name, "Member name", 40),
      }));
      return { ok: true };

    case "removeMember":
      check(await db.from("members").delete().eq("id", requireString(body.id, "Member id", 50)));
      return { ok: true };

    case "createQRStation": {
      const existing = check(await db.from("stations").select("code").eq("code", "QRQUIZ").maybeSingle());
      if (!existing) {
        check(await db.from("stations").insert({
          name: "Find and Scan the QR code",
          description: "Scan the QR code to answer the timed quiz",
          code: "QRQUIZ",
          sort_order: 999,
          max_score: 10,
        }));
      }
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
      return {
        ok: true,
        questions: check(questionResult) || [],
        attempts: check(attemptResult) || [],
        teams: check(teamResult) || [],
      };
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
      if (!["A", "B", "C", "D"].includes(question.correct_option)) {
        throw new Error("Correct option must be A, B, C, or D.");
      }
      if (input.id) check(await db.from("questions").update(question).eq("id", String(input.id)));
      else check(await db.from("questions").insert(question));
      return { ok: true };
    }

    case "deleteQuestion":
      check(await db.from("questions").delete().eq("id", requireString(body.id, "Question id", 50)));
      return { ok: true };

    case "importQuestions": {
      if (!Array.isArray(body.questions) || !body.questions.length || body.questions.length > 100) {
        throw new Error("Provide 1–100 questions.");
      }
      const rows = body.questions.map((input) => {
        const row = {
          question: requireString(input.question, "Question", 1000),
          option_a: requireString(input.option_a, "Option A", 500),
          option_b: requireString(input.option_b, "Option B", 500),
          option_c: requireString(input.option_c, "Option C", 500),
          option_d: requireString(input.option_d, "Option D", 500),
          correct_option: normalizeCode(input.correct_option),
        };
        if (!["A", "B", "C", "D"].includes(row.correct_option)) {
          throw new Error("Every correct option must be A, B, C, or D.");
        }
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

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ ok: false, error: "Method not allowed." });

  const environment = getEnvironment();
  if (!environment.supabaseUrl || !environment.serviceKey) {
    return response.status(500).json({
      ok: false,
      error: "Set SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables.",
    });
  }
  if (!environment.adminCode || !environment.sessionSecret) {
    return response.status(500).json({
      ok: false,
      error: "Set ADMIN_CODE and ADMIN_SESSION_SECRET in Vercel Environment Variables.",
    });
  }

  let body = request.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return response.status(400).json({ ok: false, error: "Request body must be JSON." }); }
  }
  body ||= {};

  if (body.action === "login") {
    if (!constantTimeEqual(normalizeCode(body.code), normalizeCode(environment.adminCode))) {
      return response.status(401).json({ ok: false, error: "Wrong admin code." });
    }
    return response.status(200).json({ ok: true, token: createToken(environment.sessionSecret) });
  }

  if (!verifyToken(request.headers["x-admin-token"] || "", environment.sessionSecret)) {
    return response.status(401).json({ ok: false, error: "Admin session is missing or expired." });
  }

  try {
    const db = makeDatabase(environment.supabaseUrl, environment.serviceKey);
    return response.status(200).json(await handleAction(body, db));
  } catch (error) {
    console.error(error);
    return response.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Admin request failed.",
    });
  }
}
