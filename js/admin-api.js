import { getConfig } from "./supabase-client.js";

const TOKEN_KEY = "bg_admin_token";

export function getAdminToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function clearAdminToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function adminLogin(code) {
  const result = await callAdmin("login", { code }, false);
  if (result.token) sessionStorage.setItem(TOKEN_KEY, result.token);
  return result;
}

export async function adminStatus() {
  if (!getAdminToken()) return false;
  try {
    await callAdmin("status");
    return true;
  } catch {
    clearAdminToken();
    return false;
  }
}

export async function callAdmin(action, payload = {}, needsToken = true) {
  const config = getConfig();
  const headers = {
    "Content-Type": "application/json",
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
  };
  if (needsToken) headers["x-admin-token"] = getAdminToken();

  let response;
  try {
    response = await fetch(`${config.supabaseUrl}/functions/v1/${config.adminFunction}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Could not reach the admin Edge Function.");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    if (response.status === 401) clearAdminToken();
    throw new Error(body.error || `Admin request failed (${response.status})`);
  }
  return body;
}

export async function callQuiz(action, payload = {}) {
  const config = getConfig();
  let response;
  try {
    response = await fetch(`${config.supabaseUrl}/functions/v1/${config.quizFunction}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Could not reach the quiz Edge Function.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.error || `Quiz request failed (${response.status})`);
  return body;
}
