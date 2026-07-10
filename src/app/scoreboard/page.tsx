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
    <div className="min-h-screen bg-slate-900 px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold">🏆 Live Scoreboard</h1>
        </div>

        {loading ? (
          <div className="text-center text-slate-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-12 text-center text-slate-400">
            No scores yet. Let the games begin! 🎮
          </div>
        ) : (
          <>
            {/* Podium */}
            <div className="flex items-end justify-center gap-4">
              {top3.map((r, i) => (
                <div
                  key={r.team_id}
                  className={`flex flex-col items-center rounded-2xl p-6 ${
                    i === 0
                      ? "order-2 bg-gradient-to-b from-amber-500 to-amber-700"
                      : i === 1
                        ? "order-1 bg-gradient-to-b from-slate-400 to-slate-600"
                        : "order-3 bg-gradient-to-b from-amber-700 to-amber-900"
                  }`}
                >
                  <div className="text-4xl">{MEDALS[i]}</div>
                  <div className="mt-2 text-lg font-bold">{r.team_name}</div>
                  <div className="text-3xl font-black">{r.total_points}</div>
                  <div className="text-xs opacity-75">
                    {r.tasks_completed} tasks · rank #{r.rank}
                  </div>
                </div>
              ))}
            </div>

            {/* Rest of the leaderboard */}
            <div className="space-y-2">
              {rest.map((r) => (
                <div
                  key={r.team_id}
                  className="flex items-center gap-4 rounded-xl bg-slate-800 px-5 py-3"
                >
                  <span className="w-8 text-center font-bold text-slate-400">
                    {r.rank}
                  </span>
                  <span className="flex-1 font-semibold">{r.team_name}</span>
                  <span className="text-sm text-slate-400">
                    {r.tasks_completed} tasks
                  </span>
                  <span className="font-bold text-amber-400">
                    {r.total_points} pts
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="text-center">
          <Link
            href="/team"
            className="text-sm text-slate-500 hover:text-white"
          >
            ← Back to team portal
          </Link>
        </div>
      </div>
    </div>
  );
}
