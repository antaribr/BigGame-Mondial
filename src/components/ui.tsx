"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./Brand";
import type { LeaderboardRow } from "@/lib/types";

/** Standard page shell: top nav + centered container.
 *  Pass `back` to show a back link (and make the logo clickable).
 *  Omit it to "lock in" the user — no back link, static logo. */
export function Shell({
  children,
  back,
  backLabel = "← Back",
}: {
  children: ReactNode;
  back?: string;
  backLabel?: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-5 sm:px-5">
      <header className="mb-5 flex items-center justify-between">
        <Brand home={back} />
        {back && (
          <Link
            href={back}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            {backLabel}
          </Link>
        )}
      </header>
      {children}
    </main>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-[72px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
      <div className="font-display text-xl font-bold leading-none text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
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
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

export function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="card h-28 animate-pulse bg-slate-100" />
      <div className="card h-10 animate-pulse bg-slate-100" />
      <div className="card h-40 animate-pulse bg-slate-100" />
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
      <div className={`card p-6 text-center text-sm text-slate-500 ${className}`}>
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
                ? "border-fuchsia-400 bg-fuchsia-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="w-7 text-center font-display text-lg font-bold text-slate-500">
              {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-slate-900">
                {r.team_name}
                {me && (
                  <span className="ml-2 text-xs text-fuchsia-600">you</span>
                )}
              </div>
              <div className="text-xs text-slate-500">
                {r.tasks_completed} tasks done
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold text-amber-600">
                {r.total_points}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                pts
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
