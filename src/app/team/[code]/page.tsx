"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Shell, Stat, Skeleton } from "@/components/ui";
import {
  fetchStationByCode,
  fetchTeams,
  fetchCompletionsForStation,
  fetchMembers,
  awardCompletion,
  undoCompletion,
} from "@/lib/api";
import { useDataChanged } from "@/lib/useRealtime";
import type { Station, Team, Completion } from "@/lib/types";

export default function AdvisorPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "") as string;

  const [station, setStation] = useState<Station | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const st = await fetchStationByCode(code);
    if (!st) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setStation(st);
    const [t, c] = await Promise.all([
      fetchTeams(),
      fetchCompletionsForStation(st.id),
    ]);
    setTeams(t);
    setCompletions(c);

    const counts: Record<string, number> = {};
    await Promise.all(
      t.map(async (team) => {
        const m = await fetchMembers(team.id);
        counts[team.id] = m.length;
      }),
    );
    setMemberCounts(counts);
    setLoading(false);
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(["completions", "teams"], load);

  const byTeam = useMemo(() => {
    const map = new Map<string, Completion>();
    for (const c of completions) map.set(c.team_id, c);
    return map;
  }, [completions]);

  const filtered = teams.filter((t) =>
    `${t.name} ${t.code}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const doneCount = completions.length;

  async function score(team: Team, n: number) {
    if (!station) return;
    setBusyId(team.id);
    try {
      await awardCompletion(station.code, team.id, n);
      setOpenId(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not award score.");
    } finally {
      setBusyId(null);
    }
  }

  async function undo(c: Completion) {
    if (!station) return;
    if (!confirm("Undo this score?")) return;
    setBusyId(c.team_id);
    try {
      await undoCompletion(station.code, c.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not undo.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Shell back="/advisor"><div className="animate-pulse">Loading...</div></Shell>;

  if (notFound || !station)
    return (
      <Shell back="/advisor">
        <div className="card p-8 text-center">
          <h1 className="text-xl font-bold">Station not found</h1>
          <Link href="/advisor" className="btn-primary mt-4 inline-block">
            Enter station code
          </Link>
        </div>
      </Shell>
    );

  return (
    <Shell back="/advisor">
      {/* Header */}
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Advisor station
        </p>
        <h1 className="mt-1 text-3xl font-bold">{station.name}</h1>
        {station.description && (
          <p className="mt-1 text-slate-500">{station.description}</p>
        )}
        <div className="mt-2 inline-block rounded-lg bg-slate-100 px-3 py-1 font-mono text-sm font-semibold text-slate-600">
          {station.code}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Teams scored" value={doneCount} />
        <Stat label="Total teams" value={teams.length} />
      </div>

      {/* Search — sticky so it's always reachable while scrolling teams */}
      <input
        className="input"
        placeholder="Search teams…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Teams */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="card p-6 text-center text-slate-400">
            No teams found.
          </div>
        )}
        {filtered.map((t) => {
          const c = byTeam.get(t.id);
          const open = openId === t.id;
          return (
            <div key={t.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-slate-400">
                    {memberCounts[t.id] ?? 0} members · {t.code}
                  </div>
                </div>
                <div
                  className={`text-2xl font-bold ${
                    c ? "text-emerald-600" : "text-slate-300"
                  }`}
                >
                  {c ? `${c.score}/${station.max_score}` : "—"}
                </div>
              </div>

              {/* Action row — full-width, thumb-friendly */}
              <div className="mt-3 flex gap-2">
                {c ? (
                  <>
                    <button
                      onClick={() => setOpenId(open ? null : t.id)}
                      className="btn-ghost flex-1 py-2 text-sm"
                    >
                      {open ? "Close" : "Edit score"}
                    </button>
                    <button
                      onClick={() => undo(c)}
                      disabled={busyId === t.id}
                      className="btn-ghost flex-1 py-2 text-sm text-red-600"
                    >
                      Undo
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setOpenId(open ? null : t.id)}
                    className="btn-primary w-full py-2.5"
                  >
                    Award score
                  </button>
                )}
              </div>

              {open && (
                <div className="mt-3 space-y-2">
                  <p className="text-center text-xs text-slate-500">
                    Tap a score (0 – {station.max_score})
                  </p>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                    {Array.from(
                      { length: station.max_score + 1 },
                      (_, i) => i,
                    ).map((n) => {
                      const hue =
                        station.max_score > 0
                          ? (n / station.max_score) * 130
                          : 65;
                      return (
                        <button
                          key={n}
                          onClick={() => score(t, n)}
                          disabled={busyId === t.id}
                          className="grid h-12 place-items-center rounded-lg text-base font-bold text-white shadow-sm transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                          style={{ background: `hsl(${hue}, 70%, 42%)` }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
