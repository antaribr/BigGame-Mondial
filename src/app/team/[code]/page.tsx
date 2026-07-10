"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Shell, Stat, TabButton, Skeleton, LeaderboardList } from "@/components/ui";
import {
  fetchTeamByCode,
  fetchMembers,
  fetchStations,
  fetchCompletionsForTeam,
  fetchLeaderboard,
  fetchSettings,
} from "@/lib/api";
import { useDataChanged } from "@/lib/useRealtime";
import type { Team, Member, Station, Completion, LeaderboardRow, Settings } from "@/lib/types";

export default function TeamDashboardPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "") as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [settings, setSettings] = useState<Settings>({ id: 1, leaderboard_public: true });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<"tasks" | "board">("tasks");

  const boardOpen = settings.leaderboard_public;

  const load = useCallback(async () => {
    const t = await fetchTeamByCode(code);
    if (!t) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setTeam(t);
    const [s, set, c, lb, stg] = await Promise.all([
      fetchMembers(t.id),
      fetchStations(),
      fetchCompletionsForTeam(t.id),
      // Only fetch the full leaderboard when it's public — when private the
      // team must not be able to see other teams' points "in any way".
      fetchSettings().then((cfg) =>
        cfg.leaderboard_public ? fetchLeaderboard() : Promise.resolve([]),
      ),
      fetchSettings(),
    ]);
    setMembers(s);
    setStations(set);
    setCompletions(c);
    setLeaderboard(lb);
    setSettings(stg);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(["completions", "teams", "members", "stations", "settings"], load);

  const byStation = useMemo(() => {
    const map = new Map<string, Completion>();
    for (const c of completions) map.set(c.station_id, c);
    return map;
  }, [completions]);

  // The team can ALWAYS see its own points (sum of its completions).
  const totalPoints = completions.reduce((a, c) => a + c.score, 0);
  const myRow = leaderboard.find((r) => r.team_id === team?.id);

  if (loading) return <Shell back="/team">{/* <Skeleton /> */}</Shell>;

  if (notFound || !team)
    return (
      <Shell back="/team">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-bold">Team not found</h1>
          <p className="mt-2 text-slate-500">This team code doesn't exist.</p>
          <Link href="/team" className="btn-primary mt-4 inline-block">
            Register a team
          </Link>
        </div>
      </Shell>
    );

  return (
    <Shell back="/team">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Your team
        </p>
        <h1 className="mt-1 text-3xl font-bold">{team.name}</h1>
        <button
          onClick={() => navigator.clipboard?.writeText(team.code)}
          className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono font-semibold tracking-widest text-amber-600"
          title="Copy code"
        >
          {team.code}
        </button>
      </div>

      {/* Stats: always show own points + tasks. Show rank only if board open. */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total pts" value={totalPoints} />
        <Stat label="Tasks done" value={completions.length} />
        {boardOpen && <Stat label="Rank" value={myRow?.rank ?? "—"} />}
      </div>

      {/* Tabs — only when the leaderboard is public */}
      {boardOpen && (
        <div className="flex justify-center gap-2">
          <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")}>
            My Tasks
          </TabButton>
          <TabButton active={tab === "board"} onClick={() => setTab("board")}>
            Leaderboard
          </TabButton>
        </div>
      )}

      {!boardOpen && (
        <div className="rounded-xl bg-slate-100 p-4 text-center text-sm text-slate-500">
          🔒 The live leaderboard is currently hidden by the organizer.
        </div>
      )}

      {(boardOpen ? tab === "tasks" : true) && (
        <>
          {/* Members — READ ONLY (only the admin can change them) */}
          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-700">
              Members ({members.length})
            </h2>
            {members.length === 0 ? (
              <p className="text-sm text-slate-400">No members yet.</p>
            ) : (
              <ul className="space-y-1">
                {members.map((m) => (
                  <li key={m.id} className="text-sm text-slate-700">
                    • {m.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-700">
              All stations ({stations.length})
            </h2>
            {stations.length === 0 ? (
              <p className="text-sm text-slate-400">
                No stations yet. Ask the organizer to add tasks.
              </p>
            ) : (
              <ul className="space-y-3">
                {stations.map((s) => {
                  const done = byStation.get(s.id);
                  const max =
                    typeof s.max_score === "number" && s.max_score > 0
                      ? s.max_score
                      : 10;
                  return (
                    <li
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
                    >
                      <div>
                        <div className="font-medium">{s.name}</div>
                        {s.description && (
                          <div className="mt-0.5 text-xs text-slate-400">
                            {s.description}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-slate-400">
                          🎯 max of {max} pts
                        </div>
                      </div>
                      <div
                        className={`text-lg font-bold ${
                          done ? "text-emerald-600" : "text-slate-300"
                        }`}
                      >
                        {done ? (
                          `+${done.score}`
                        ) : (
                          <span className="text-sm font-normal">Pending</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {boardOpen && tab === "board" && (
        <LeaderboardList rows={leaderboard} currentTeamId={team.id} />
      )}
    </Shell>
  );
}
