"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./Brand";
import type { LeaderboardRow } from "@/lib/types";

/** Standard page shell: top nav + centered container. */
export function Shell({
  children,
  back = "/",
}: {
  children: ReactNode;
  back?: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-5 sm:px-5">
      <header className="mb-5 flex items-center justify-between">
        <Brand />
        <Link
          href={back}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Home
        </Link>
      </header>
      {children}
    </main>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-[72px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
      <div className="font-display text-xl font-bold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
        {label}
      </div>
    </div>
  );
}

export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white/10 text-white"
          : "text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="card h-28 animate-pulse" />
      <div className="card h-10 animate-pulse" />
      <div className="card h-40 animate-pulse" />
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function LeaderboardList({
  rows,
  currentTeamId,
  className = "",
}: {
  rows: LeaderboardRow[];
  currentTeamId?: string;
  className?: string;
}) {
  if (rows.length === 0)
    return (
      <div className={`card p-6 text-center text-sm text-slate-400 ${className}`}>
        No teams yet.
      </div>
    );

  return (
    <div className={`space-y-2 ${className}`}>
      {rows.map((r) => {
        const me = r.team_id === currentTeamId;
        return (
          <div
            key={r.team_id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
              me
                ? "border-fuchsia-400/40 bg-fuchsia-500/10"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            <div className="w-7 text-center font-display text-lg font-bold text-slate-300">
              {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">
                {r.team_name}
                {me && (
                  <span className="ml-2 text-xs text-fuchsia-300">you</span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                {r.tasks_completed} tasks done
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold text-amber-300">
                {r.total_points}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                pts
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
