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
  const headers = { "Content-Type": "application/json" };
  if (needsToken) headers["x-admin-token"] = getAdminToken();

  let response;
  try {
    response = await fetch("/api/admin", {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Could not reach the Vercel admin API.");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    if (response.status === 401) clearAdminToken();
    if (response.status === 404) throw new Error("The api/admin.js file has not been deployed to Vercel.");
    throw new Error(body.error || `Admin request failed (${response.status})`);
  }
  return body;
}

export async function callQuiz(action, payload = {}) {
  let response;
  try {
    response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Could not reach the quiz API.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    if (response.status === 404) throw new Error("The api/quiz.js file has not been deployed to Vercel.");
    throw new Error(body.error || `Quiz request failed (${response.status})`);
  }
  return body;
}
