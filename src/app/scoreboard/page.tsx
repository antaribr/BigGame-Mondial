"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchLeaderboard } from "@/lib/api";
import { useDataChanged } from "@/lib/useRealtime";
import type { LeaderboardRow } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ScoreboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setRows(await fetchLeaderboard());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(["completions", "teams"], load);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-amber-500 text-lg font-black text-white">
            B
          </span>
          <div>
            <div className="font-display text-xl font-bold leading-none text-slate-900">
              Live Scoreboard
            </div>
            <div className="text-xs text-slate-500">The Big Game</div>
          </div>
        </div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← Home
        </Link>
      </header>

      {loading ? (
        <div className="card h-64 animate-pulse bg-slate-100" />
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          No scores yet. Let the games begin! 🎮
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {top3.map((r, i) => (
              <div
                key={r.team_id}
                className={`card relative overflow-hidden p-5 text-center ${
                  i === 0 ? "border-amber-400 sm:-translate-y-2" : ""
                }`}
              >
                <div className="text-4xl">{MEDALS[i]}</div>
                <div className="mt-2 truncate font-display text-xl font-bold text-slate-900">
                  {r.team_name}
                </div>
                <div className="mt-1 font-display text-3xl font-black text-amber-600">
                  {r.total_points}
                </div>
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  {r.tasks_completed} tasks · rank #{r.rank}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            {rest.map((r) => (
              <div
                key={r.team_id}
                className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="w-8 text-center font-display text-lg font-bold text-slate-400">
                  {r.rank}
                </div>
                <div className="min-w-0 flex-1 truncate font-semibold text-slate-900">
                  {r.team_name}
                </div>
                <div className="text-sm text-slate-500">
                  {r.tasks_completed} tasks
                </div>
                <div className="font-display text-xl font-bold text-amber-600">
                  {r.total_points}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
