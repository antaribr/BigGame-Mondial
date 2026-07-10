import { supabase } from "./supabase";
import { generateCode } from "./codes";
import type {
  Team,
  Member,
  Station,
  Completion,
  LeaderboardRow,
  Settings,
} from "./types";

/* ────────────────────────────────────────────────────────────── Reads ────── */

export async function fetchTeamByCode(code: string): Promise<Team | null> {
  const { data } = await supabase
    .from("teams")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  return (data as Team | null) ?? null;
}

export async function fetchStationByCode(code: string): Promise<Station | null> {
  const { data } = await supabase
    .from("stations")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  return (data as Station | null) ?? null;
}

export async function fetchStations(): Promise<Station[]> {
  const { data } = await supabase
    .from("stations")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  return (data ?? []) as Station[];
}

export async function fetchMembers(teamId: string): Promise<Member[]> {
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Member[];
}

export async function fetchCompletionsForTeam(
  teamId: string,
): Promise<Completion[]> {
  const { data } = await supabase
    .from("completions")
    .select("*")
    .eq("team_id", teamId);
  return (data ?? []) as Completion[];
}

export async function fetchCompletionsForStation(
  stationId: string,
): Promise<Completion[]> {
  const { data } = await supabase
    .from("completions")
    .select("*")
    .eq("station_id", stationId);
  return (data ?? []) as Completion[];
}

export async function fetchTeams(): Promise<Team[]> {
  const { data } = await supabase
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Team[];
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data } = await supabase
    .from("leaderboard")
    .select("*")
    .order("rank", { ascending: true });
  return (data ?? []) as LeaderboardRow[];
}

/** Returns the single settings row (defaults to public if unset). */
export async function fetchSettings(): Promise<Settings> {
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (data as Settings | null) ?? { id: 1, leaderboard_public: true };
}

/** All members across all teams (used by the admin roster manager). */
export async function fetchAllMembers(): Promise<Member[]> {
  const { data } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: true });
  return (data ?? []) as Member[];
}

/* ────────────────────────────────────────────────────────────── Writes ───── */

export async function registerTeam(
  name: string,
  memberNames: string[],
): Promise<Team> {
  const clean = memberNames.map((n) => n.trim()).filter(Boolean);

  let team: Team | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(5);
    const { data, error } = await supabase
      .from("teams")
      .insert({ name: name.trim(), code })
      .select()
      .single();
    if (!error && data) {
      team = data as Team;
      break;
    }
  }
  if (!team) throw new Error("Could not create team. Please try again.");

  if (clean.length) {
    const rows = clean.map((n) => ({ team_id: team!.id, name: n }));
    await supabase.from("members").insert(rows);
  }
  return team;
}

/** Advisor awards a score (1–10) to a team at this station. */
export async function awardCompletion(
  stationCode: string,
  teamId: string,
  score: number,
): Promise<Completion> {
  const { data, error } = await supabase.rpc("complete_task", {
    p_station_code: stationCode.toUpperCase(),
    p_team_id: teamId,
    p_score: score,
  });
  if (error) throw error;
  return data as Completion;
}

/** Advisor removes a score they previously gave. */
export async function undoCompletion(
  stationCode: string,
  completionId: string,
): Promise<void> {
  const { error } = await supabase.rpc("undo_completion", {
    p_station_code: stationCode.toUpperCase(),
    p_completion_id: completionId,
  });
  if (error) throw error;
}
