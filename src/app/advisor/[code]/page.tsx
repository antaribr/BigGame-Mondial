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

  if (loading)
    return (
      <Shell back="/advisor" backLabel="← Switch station">
        <Skeleton />
      </Shell>
    );

  if (notFound || !station)
    return (
      <Shell back="/advisor" backLabel="← Switch station">
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold">Station not found</p>
          <Link className="btn-primary mt-5" href="/advisor">
            Enter station code
          </Link>
        </div>
      </Shell>
    );

  return (
    <Shell back="/advisor" backLabel="← Switch station">
      {/* Header */}
      <div className="card relative overflow-hidden p-5 sm:p-6">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-fuchsia-400/25 to-amber-400/20 blur-3xl" />
        <div className="relative">
          <div className="text-xs uppercase tracking-widest text-amber-600">
            Advisor station
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {station.name}
          </h1>
          {station.description && (
            <p className="mt-1 text-sm text-slate-600">{station.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-sm tracking-widest text-fuchsia-600">
              {station.code}
            </div>
            <Stat label="Scored" value={`${doneCount}/${teams.length}`} />
          </div>
        </div>
      </div>

      {/* Search — sticky so it's always reachable while scrolling teams */}
      <div className="sticky top-0 z-10 -mx-4 bg-slate-50/90 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <input
          className="input"
          placeholder="Search teams…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Teams */}
      <div className="mt-3 space-y-2">
        {filtered.length === 0 && (
          <div className="card p-6 text-center text-sm text-slate-500">
            No teams found.
          </div>
        )}
        {filtered.map((t) => {
          const c = byTeam.get(t.id);
          const open = openId === t.id;
          return (
            <div
              key={t.id}
              className={`card overflow-hidden ${
                c ? "border-emerald-400" : ""
              }`}
            >
              <div className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-slate-900">
                    {t.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {memberCounts[t.id] ?? 0} members · {t.code}
                  </div>
                </div>
                {c ? (
                  <span className="shrink-0 rounded-lg bg-emerald-100 px-3 py-1.5 font-bold text-emerald-700">
                    {c.score}/10
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                    —
                  </span>
                )}
              </div>
              {/* Action row — full-width, thumb-friendly */}
              <div className="flex gap-2 border-t border-slate-100 px-3 py-2">
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
                <div className="border-t border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 text-xs uppercase tracking-wider text-slate-500">
                    Tap a score (1–10)
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        onClick={() => score(t, n)}
                        disabled={busyId === t.id}
                        className="grid h-12 place-items-center rounded-lg text-base font-bold text-white shadow-sm transition hover:brightness-110 active:scale-95 disabled:opacity-50"
                        style={{
                          background: `hsl(${((n - 1) / 9) * 130}, 70%, 42%)`,
                        }}
                      >
                        {n}
                      </button>
                    ))}
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
