const LEADER_TOKEN_KEY = "bg_task_leader_token";

async function request(action, payload = {}, leader = false) {
  const headers = { "Content-Type": "application/json" };
  if (leader) headers["x-task-leader-token"] = getTaskLeaderToken();
  let response;
  try {
    response = await fetch("/api/tasks", {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error("Could not reach the task API.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    if (response.status === 401 && leader) clearTaskLeaderToken();
    if (response.status === 404) throw new Error("The api/tasks.js file has not been deployed.");
    throw new Error(body.error || `Task request failed (${response.status}).`);
  }
  return body;
}

export function getTaskLeaderToken() {
  return sessionStorage.getItem(LEADER_TOKEN_KEY) || "";
}

export function clearTaskLeaderToken() {
  sessionStorage.removeItem(LEADER_TOKEN_KEY);
}

export async function taskLeaderLogin(code) {
  const result = await request("leaderLogin", { code });
  if (result.token) sessionStorage.setItem(LEADER_TOKEN_KEY, result.token);
  return result;
}

export async function taskLeaderStatus() {
  if (!getTaskLeaderToken()) return false;
  try {
    await request("leaderStatus", {}, true);
    return true;
  } catch {
    clearTaskLeaderToken();
    return false;
  }
}

export function callTaskLeader(action, payload = {}) {
  return request(action, payload, true);
}

export function callTeamTasks(action, payload = {}) {
  return request(action, payload, false);
}
