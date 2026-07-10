import { getSupabase } from "./supabase-client.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCode(length = 5) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => ALPHABET[value % ALPHABET.length]).join("");
}

function dataOrThrow(result, fallback = null) {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? fallback;
}

export async function fetchTeamByCode(code) {
  const result = await getSupabase().rpc("get_team_by_code", { p_code: code.trim().toUpperCase() }).maybeSingle();
  return dataOrThrow(result, null);
}

export async function fetchStationByCode(code) {
  const result = await getSupabase().rpc("get_station_by_code", { p_code: code.trim().toUpperCase() }).maybeSingle();
  return dataOrThrow(result, null);
}

export async function fetchStations() {
  const result = await getSupabase().from("stations").select("id,name,description,sort_order,max_score,created_at").order("sort_order", { ascending: true }).order("name", { ascending: true });
  return dataOrThrow(result, []);
}

export async function fetchTeams(order = "created_at") {
  const result = await getSupabase().from("teams").select("id,name,created_at").order(order, { ascending: order === "name" });
  return dataOrThrow(result, []);
}

export async function fetchMembers(teamId) {
  const result = await getSupabase().from("members").select("*").eq("team_id", teamId).order("created_at", { ascending: true });
  return dataOrThrow(result, []);
}

export async function fetchAllMembers() {
  const result = await getSupabase().from("members").select("*").order("created_at", { ascending: true });
  return dataOrThrow(result, []);
}

export async function fetchCompletionsForTeam(teamId) {
  const result = await getSupabase().from("completions").select("*").eq("team_id", teamId);
  return dataOrThrow(result, []);
}

export async function fetchCompletionsForStation(stationId) {
  const result = await getSupabase().from("completions").select("*").eq("station_id", stationId);
  return dataOrThrow(result, []);
}

export async function fetchLeaderboard() {
  const result = await getSupabase().from("leaderboard").select("*").order("rank", { ascending: true });
  return dataOrThrow(result, []);
}

export async function fetchSettings() {
  const result = await getSupabase().from("settings").select("*").eq("id", 1).maybeSingle();
  return dataOrThrow(result, { id: 1, leaderboard_public: true });
}

export async function registerTeam(name, memberNames) {
  const cleanName = name.trim();
  const cleanMembers = memberNames.map((value) => value.trim()).filter(Boolean);
  if (!cleanName) throw new Error("Please enter a team name.");

  let team = null;
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateCode(5);
    const result = await getSupabase().from("teams").insert({ name: cleanName, code }).select("id,name,created_at").single();
    if (!result.error && result.data) {
      team = { ...result.data, code };
      break;
    }
    lastError = result.error;
  }
  if (!team) throw new Error(lastError?.message || "Could not create the team. Please try again.");

  if (cleanMembers.length) {
    const result = await getSupabase().from("members").insert(cleanMembers.map((memberName) => ({ team_id: team.id, name: memberName })));
    if (result.error) throw new Error(`The team was created, but members could not be added: ${result.error.message}`);
  }
  return team;
}

export async function awardCompletion(stationCode, teamId, score) {
  const result = await getSupabase().rpc("complete_task", {
    p_station_code: stationCode.trim().toUpperCase(),
    p_team_id: teamId,
    p_score: Number(score),
  });
  return dataOrThrow(result);
}

export async function undoCompletion(stationCode, completionId) {
  const result = await getSupabase().rpc("undo_completion", {
    p_station_code: stationCode.trim().toUpperCase(),
    p_completion_id: completionId,
  });
  dataOrThrow(result);
}
