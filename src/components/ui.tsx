"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./Brand";
import type { LeaderboardRow } from "@/lib/types";

/** Standard page shell: top nav + centered container.
 * Pass `back` to show a back link (and make the logo clickable).
 * Omit it to "lock in" the user — no back link, static logo. */
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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Brand home={back} />
          {back && (
            <Link
              href={back}
              className="ml-auto text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              {backLabel}
            </Link>
          )}
        </div>
      </header>
      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">{children}</div>
      </main>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card flex flex-col gap-1 p-4 text-center">
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
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
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

export function Skeleton() {
  return (
    <div className="card animate-pulse p-6">
      <div className="h-4 w-1/3 rounded bg-slate-200" />
      <div className="mt-2 h-8 w-1/2 rounded bg-slate-200" />
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
      <div className="card p-6 text-center text-slate-500">
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
            className={`card flex items-center gap-4 p-4 ${
              me ? "border-indigo-400 bg-indigo-50" : ""
            }`}
          >
            <span className="min-w-[2.5rem] text-center text-lg font-bold text-slate-400">
              {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
            </span>
            <div className="flex-1">
              <div className="font-semibold text-slate-900">{r.team_name}</div>
              {me && (
                <span className="text-xs font-medium text-indigo-600">you</span>
              )}
              <div className="text-xs text-slate-400">
                {r.tasks_completed} tasks done
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-900">
                {r.total_points}
              </div>
              <div className="text-xs text-slate-400">pts</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
