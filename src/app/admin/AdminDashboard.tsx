"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { fetchStations, fetchTeams, fetchLeaderboard, fetchAllMembers, fetchSettings } from "@/lib/api";
import { useDataChanged } from "@/lib/useRealtime";
import {
  createStation,
  deleteStation,
  resetGameData,
  logoutAdmin,
  addTeamMember,
  removeTeamMember,
  setLeaderboardPublic,
} from "./actions";
import type { Station, Team, LeaderboardRow, Member, Settings } from "@/lib/types";

export default function AdminDashboard() {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings>({ id: 1, leaderboard_public: true });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [s, t, b, m, stg] = await Promise.all([
      fetchStations(),
      fetchTeams(),
      fetchLeaderboard(),
      fetchAllMembers(),
      fetchSettings(),
    ]);
    setStations(s);
    setTeams(t);
    setBoard(b);
    setMembers(m);
    setSettings(stg);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(["stations", "teams", "completions", "members", "settings"], load);

  const boardOpen = settings.leaderboard_public;

  async function toggleBoard() {
    const next = !boardOpen;
    setSettings((s) => ({ ...s, leaderboard_public: next })); // optimistic
    await setLeaderboardPublic(next);
    await load();
  }

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
          <a className="btn-ghost text-sm" href="/scoreboard">
            📊 Scoreboard
          </a>
          <button onClick={logout} className="btn-ghost text-sm">
            Log out
          </button>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Leaderboard visibility toggle */}
      <div
        className={`card mb-6 flex items-center justify-between gap-4 p-4 ${
          boardOpen ? "" : "border-amber-300"
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base">{boardOpen ? "🌐" : "🔒"}</span>
            <span className="font-semibold text-slate-900">
              Live leaderboard
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                boardOpen
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {boardOpen ? "Visible to teams" : "Hidden from teams"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {boardOpen
              ? "Teams can see the rankings & everyone's points."
              : "Teams can only see their own points."}
          </p>
        </div>
        <button
          onClick={toggleBoard}
          className={boardOpen ? "btn-ghost shrink-0" : "btn-primary shrink-0"}
        >
          {boardOpen ? "Hide from teams" : "Show to teams"}
        </button>
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
                    className="btn-ghost shrink-0 px-2.5 py-1 text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Teams + roster management */}
      <section className="card mt-6 p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
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
          <div className="space-y-2">
            {[...board]
              .sort((a, b) => a.rank - b.rank)
              .map((r) => {
                const teamMembers = members.filter((m) => m.team_id === r.team_id);
                return (
                  <TeamCard
                    key={r.team_id}
                    row={r}
                    members={teamMembers}
                    onReload={load}
                  />
                );
              })}
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

function TeamCard({
  row,
  members,
  onReload,
}: {
  row: LeaderboardRow;
  members: Member[];
  onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    setBusy(true);
    const res = await addTeamMember(row.team_id, name);
    setBusy(false);
    if (res.ok) {
      setName("");
      await onReload();
    } else {
      setError(res.error ?? "Could not add member.");
    }
  }

  async function removeMember(id: string) {
    setBusy(true);
    await removeTeamMember(id);
    setBusy(false);
    await onReload();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="w-7 shrink-0 text-center font-display text-lg font-bold text-slate-400">
          {row.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-slate-900">
            {row.team_name}
          </div>
          <div className="text-xs text-slate-500">
            {row.tasks_completed} tasks · {members.length} members ·{" "}
            <span className="font-mono text-fuchsia-600">{row.team_code}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-bold text-amber-600">
            {row.total_points}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            pts
          </div>
        </div>
        <span className="shrink-0 text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-3">
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm text-slate-800"
              >
                {m.name}
                <button
                  onClick={() => removeMember(m.id)}
                  disabled={busy}
                  className="grid h-5 w-5 place-items-center rounded-full bg-slate-200 text-xs text-slate-600 hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
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
          {error && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
