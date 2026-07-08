"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Shell, Stat, TabButton, Skeleton, LeaderboardList } from "@/components/ui";
import {
  fetchTeamByCode,
  fetchMembers,
  fetchStations,
  fetchCompletionsForTeam,
  fetchLeaderboard,
  addMember,
  removeMember,
} from "@/lib/api";
import { useDataChanged } from "@/lib/useRealtime";
import type { Team, Member, Station, Completion, LeaderboardRow } from "@/lib/types";

export default function TeamDashboardPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "") as string;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<"tasks" | "board">("tasks");

  const load = useCallback(async () => {
    const t = await fetchTeamByCode(code);
    if (!t) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setTeam(t);
    const [m, s, c, lb] = await Promise.all([
      fetchMembers(t.id),
      fetchStations(),
      fetchCompletionsForTeam(t.id),
      fetchLeaderboard(),
    ]);
    setMembers(m);
    setStations(s);
    setCompletions(c);
    setLeaderboard(lb);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(["completions", "teams", "members", "stations"], load);

  const byStation = useMemo(() => {
    const map = new Map<string, Completion>();
    for (const c of completions) map.set(c.station_id, c);
    return map;
  }, [completions]);

  const totalPoints = completions.reduce((a, c) => a + c.score, 0);
  const myRow = leaderboard.find((r) => r.team_id === team?.id);

  if (loading)
    return (
      <Shell>
        <Skeleton />
      </Shell>
    );

  if (notFound || !team)
    return (
      <Shell>
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold">Team not found</p>
          <p className="mt-1 text-sm text-slate-500">
            This team code doesn't exist.
          </p>
          <Link className="btn-primary mt-5" href="/team">
            Register a team
          </Link>
        </div>
      </Shell>
    );

  return (
    <Shell>
      {/* Header */}
      <div className="card relative overflow-hidden p-6">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-400/25 to-fuchsia-400/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-widest text-fuchsia-600">
              Your team
            </div>
            <h1 className="font-display text-3xl font-bold">{team.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <span>Code:</span>
              <button
                onClick={() => navigator.clipboard?.writeText(team.code)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono font-semibold tracking-widest text-amber-600"
                title="Copy code"
              >
                {team.code}
              </button>
              <span className="text-xs text-slate-400">(tap to copy)</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Points" value={totalPoints} />
            <Stat
              label="Done"
              value={`${completions.length}/${stations.length}`}
            />
            <Stat label="Rank" value={myRow ? `#${myRow.rank}` : "—"} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex rounded-xl border border-slate-200 bg-slate-100 p-1">
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")}>
          My Tasks
        </TabButton>
        <TabButton active={tab === "board"} onClick={() => setTab("board")}>
          Leaderboard
        </TabButton>
      </div>

      {tab === "tasks" ? (
        <div className="mt-5 space-y-5">
          <MembersPanel teamId={team.id} members={members} onChange={load} />

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
              All stations ({stations.length})
            </h2>
            {stations.length === 0 ? (
              <div className="card p-6 text-center text-sm text-slate-500">
                No stations yet. Ask the organizer to add tasks.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {stations.map((s) => {
                  const done = byStation.get(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`card p-4 ${
                        done ? "border-emerald-400 bg-emerald-50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">
                            {s.name}
                          </div>
                          {s.description && (
                            <div className="mt-0.5 text-sm text-slate-500">
                              {s.description}
                            </div>
                          )}
                        </div>
                        {done ? (
                          <span className="shrink-0 rounded-lg bg-emerald-100 px-2.5 py-1 text-sm font-bold text-emerald-700">
                            +{done.score}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <LeaderboardList
          rows={leaderboard}
          currentTeamId={team.id}
          className="mt-5"
        />
      )}
    </Shell>
  );
}

function MembersPanel({
  teamId,
  members,
  onChange,
}: {
  teamId: string;
  members: Member[];
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addMember(teamId, name);
      setName("");
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Members ({members.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm text-slate-800"
          >
            {m.name}
            <button
              onClick={async () => {
                await removeMember(m.id);
                onChange();
              }}
              className="grid h-5 w-5 place-items-center rounded-full bg-slate-200 text-xs text-slate-600 hover:bg-red-100 hover:text-red-600"
              aria-label={`Remove ${m.name}`}
            >
              ✕
            </button>
          </span>
        ))}
        {members.length === 0 && (
          <span className="text-sm text-slate-400">No members yet.</span>
        )}
      </div>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          className="input"
          placeholder="Add a member…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
        <button className="btn-primary" disabled={busy || !name.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
