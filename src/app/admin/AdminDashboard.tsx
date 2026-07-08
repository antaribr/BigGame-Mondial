"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { fetchStations, fetchTeams, fetchLeaderboard } from "@/lib/api";
import { useDataChanged } from "@/lib/useRealtime";
import {
  createStation,
  deleteStation,
  resetGameData,
  logoutAdmin,
} from "./actions";
import type { Station, Team, LeaderboardRow } from "@/lib/types";

export default function AdminDashboard() {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [s, t, b] = await Promise.all([
      fetchStations(),
      fetchTeams(),
      fetchLeaderboard(),
    ]);
    setStations(s);
    setTeams(t);
    setBoard(b);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(["stations", "teams", "completions", "members"], load);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [order, setOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!name.trim()) {
      setMsg("Station name is required.");
      return;
    }
    setSaving(true);
    const res = await createStation({
      name,
      description: desc,
      code,
      sort_order: Number(order) || 0,
    });
    setSaving(false);
    if (res.ok) {
      setName("");
      setDesc("");
      setCode("");
      setOrder("0");
      await load();
    } else {
      setMsg(res.error ?? "Could not add station.");
    }
  }

  async function remove(id: string) {
    if (
      !confirm(
        "Delete this station? Existing scores for it will also be removed.",
      )
    )
      return;
    await deleteStation(id);
    await load();
  }

  async function reset() {
    if (
      !confirm(
        "This deletes ALL teams, members and scores. Stations stay. Continue?",
      )
    )
      return;
    await resetGameData();
    await load();
  }

  async function logout() {
    await logoutAdmin();
    router.refresh();
  }

  if (loading)
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-5">
        <div className="card h-40 animate-pulse bg-slate-100" />
      </main>
    );

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-5">
      <header className="mb-6 flex items-center justify-between">
        <Brand home="/admin" />
        <div className="flex items-center gap-2">
          <Link href="/scoreboard" className="btn-ghost text-sm">
            📊 Scoreboard
          </Link>
          <button onClick={logout} className="btn-ghost text-sm">
            Log out
          </button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPI label="Stations" value={stations.length} />
        <KPI label="Teams" value={teams.length} />
        <KPI
          label="Scores"
          value={board.reduce((a, r) => a + r.tasks_completed, 0)}
        />
        <KPI
          label="Total points"
          value={board.reduce((a, r) => a + r.total_points, 0)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-bold">Add a station</h2>
          <form onSubmit={add} className="space-y-3">
            <input
              className="input"
              placeholder="Station name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
            <textarea
              className="input min-h-[72px]"
              placeholder="Task / instructions (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={300}
            />
            <div className="flex gap-2">
              <input
                className="input uppercase"
                placeholder="Code (auto)"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().slice(0, 8))
                }
                maxLength={8}
              />
              <input
                className="input w-28"
                type="number"
                placeholder="Order"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            </div>
            {msg && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {msg}
              </p>
            )}
            <button className="btn-primary w-full" disabled={saving}>
              {saving ? "Saving…" : "+ Add station"}
            </button>
          </form>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-display text-lg font-bold">
            Stations ({stations.length})
          </h2>
          {stations.length === 0 ? (
            <p className="text-sm text-slate-500">
              No stations yet. Add your first task.
            </p>
          ) : (
            <div className="space-y-2">
              {stations.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    {s.description && (
                      <div className="text-sm text-slate-500">
                        {s.description}
                      </div>
                    )}
                    <div className="mt-1 inline-block rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs text-fuchsia-600">
                      {s.code}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(s.id)}
                    className="btn-ghost px-2.5 py-1 text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">
            Teams ({teams.length})
          </h2>
          <button
            onClick={reset}
            className="btn-ghost px-3 py-1.5 text-xs text-red-600"
          >
            Reset all game data
          </button>
        </div>
        {teams.length === 0 ? (
          <p className="text-sm text-slate-500">No teams registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Team</th>
                  <th className="py-2 pr-3">Code</th>
                  <th className="py-2 pr-3 text-right">Tasks</th>
                  <th className="py-2 pr-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {[...board]
                  .sort((a, b) => a.rank - b.rank)
                  .map((r) => (
                    <tr key={r.team_id} className="border-t border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {r.team_name}
                      </td>
                      <td className="py-2 pr-3 font-mono text-fuchsia-600">
                        {r.team_code}
                      </td>
                      <td className="py-2 pr-3 text-right text-slate-600">
                        {r.tasks_completed}
                      </td>
                      <td className="py-2 pr-3 text-right font-bold text-amber-600">
                        {r.total_points}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 text-center">
      <div className="font-display text-2xl font-black text-slate-900">
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}
