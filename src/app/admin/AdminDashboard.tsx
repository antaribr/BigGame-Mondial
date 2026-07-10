"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import CreateQRStationButton from "./CreateQRStationButton";

export default function AdminDashboard() {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [settings, setSettings] = useState<Settings>({ id: 1, leaderboard_public: true });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    // Fetch each call independently so we can report the exact one that fails.
    const tasks: [string, Promise<unknown>][] = [
      ["stations", fetchStations()],
      ["teams", fetchTeams()],
      ["leaderboard", fetchLeaderboard()],
      ["members", fetchAllMembers()],
      ["settings", fetchSettings()],
    ];
    try {
      const results = await Promise.all(
        tasks.map(async ([label, p]) => {
          try {
            return [label, await p] as const;
          } catch (e) {
            throw new Error(
              `${label}: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }),
      );
      for (const [label, val] of results) {
        if (label === "stations") setStations(val as Station[]);
        if (label === "teams") setTeams(val as Team[]);
        if (label === "leaderboard") setBoard(val as LeaderboardRow[]);
        if (label === "members") setMembers(val as Member[]);
        if (label === "settings") setSettings(val as Settings);
      }
      setLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(["stations", "teams", "completions", "members", "settings"], load);

  const boardOpen = settings.leaderboard_public;

  const [toggleError, setToggleError] = useState<string | null>(null);

  async function toggleBoard() {
    setToggleError(null);
    const next = !boardOpen;
    setSettings((s) => ({ ...s, leaderboard_public: next })); // optimistic
    const res = await setLeaderboardPublic(next);
    if (!res.ok) {
      // Revert on failure and show why — never silently flip back.
      setSettings((s) => ({ ...s, leaderboard_public: !next }));
      setToggleError(
        res.error?.includes("Could not find the table")
          ? "The settings table is missing. Run migration_settings.sql in Supabase."
          : res.error ?? "Could not change leaderboard visibility.",
      );
      return;
    }
    await load();
  }

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [code, setCode] = useState("");
  const [order, setOrder] = useState("0");
  const [maxScore, setMaxScore] = useState("10");
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
      max_score: Number(maxScore) || 10,
    });
    setSaving(false);
    if (res.ok) {
      setName("");
      setDesc("");
      setCode("");
      setOrder("0");
      setMaxScore("10");
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );

  if (loadError)
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="text-xl font-bold">Couldn't load admin data</h1>
          <p className="mt-2 text-red-500">{loadError}</p>
          <p className="mt-4 text-sm text-slate-500">
            If this mentions `scores`{" "}
            or `max_score` —
            make sure the **latest code is deployed** (push to GitHub so
            Vercel rebuilds) and run{" "}
            <code className="rounded bg-slate-100 px-1">migration_station_max_score.sql</code>{" "}
            in Supabase.
          </p>
          <button onClick={load} className="btn-primary mt-4">
            Try again
          </button>
        </div>
      </div>
    );

  if (loadError)
    return (
      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-5">
        <header className="mb-6 flex items-center justify-between">
          <Brand home="/admin" />
          <button onClick={logout} className="btn-ghost text-sm">
            Log out
          </button>
        </header>
        <div className="card border-red-300 p-6">
          <p className="font-display text-lg font-bold text-red-600">
            ⚠️ Couldn't load admin data
          </p>
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 font-mono text-sm break-all text-red-700">
            {loadError}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            If this mentions <code className="rounded bg-slate-100 px-1">scores</code>{" "}
            or <code className="rounded bg-slate-100 px-1">max_score</code> —
            make sure the <b>latest code is deployed</b> (push to GitHub so
            Vercel rebuilds) and run{" "}
            <code className="rounded bg-slate-100 px-1">
              migration_station_max_score.sql
            </code>{" "}
            in Supabase.
          </p>
          <button onClick={() => load()} className="btn-primary mt-4">
            Try again
          </button>
        </div>
      </main>
    );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          <Brand home="/admin" />
          <button
            onClick={logout}
            className="ml-auto text-sm font-medium text-slate-500 hover:text-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold">{teams.length}</div>
              <div className="text-xs text-slate-400">Teams</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold">{stations.length}</div>
              <div className="text-xs text-slate-400">Stations</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold">
                {board.reduce((a, r) => a + r.tasks_completed, 0)}
              </div>
              <div className="text-xs text-slate-400">Total scores</div>
            </div>
          </div>

          {/* Leaderboard visibility toggle */}
          <div className="card flex items-center gap-4 p-5">
            <div className="text-2xl">{boardOpen ? "🌐" : "🔒"}</div>
            <div className="flex-1">
              <div className="font-semibold">Live leaderboard</div>
              <div className="text-sm text-slate-500">
                {boardOpen ? "Visible to teams" : "Hidden from teams"}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {boardOpen
                  ? "Teams can see the rankings & everyone's points."
                  : "Teams can only see their own points."}
              </p>
            </div>
            {toggleError && (
              <div className="rounded bg-red-50 p-2 text-xs text-red-500">
                ⚠️ {toggleError}
              </div>
            )}
            <button onClick={toggleBoard} className="btn-ghost whitespace-nowrap">
              {boardOpen ? "Hide from teams" : "Show to teams"}
            </button>
          </div>

          {/* Add station form */}
          <div className="card p-6">
            <h2 className="mb-4 font-semibold">Add a station</h2>
            <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Station name *"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
              <input
                className="input"
                placeholder="Description (optional)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                maxLength={120}
              />
              <input
                className="input"
                placeholder="Code (auto-generated if blank)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
              />
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Order"
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Max score"
                  type="number"
                  value={maxScore}
                  onChange={(e) => setMaxScore(e.target.value)}
                />
              </div>
              {msg && (
                <div className="rounded bg-red-50 p-2 text-sm text-red-500">
                  {msg}
                </div>
              )}
              <button
                type="submit"
                className="btn-primary sm:col-span-2"
                disabled={saving}
              >
                {saving ? "Adding…" : "Add station"}
              </button>
            </form>
          </div>

          {/* Stations list */}
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <h2 className="font-semibold">
                Stations ({stations.length})
              </h2>
            </div>
            {stations.length === 0 ? (
              <p className="p-6 text-center text-slate-400">No stations yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="px-5 py-2 font-medium">Order</th>
                    <th className="px-5 py-2 font-medium">Name</th>
                    <th className="px-5 py-2 font-medium">Code</th>
                    <th className="px-5 py-2 font-medium">Max</th>
                    <th className="px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {stations.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 text-sm">
                      <td className="px-5 py-3 text-slate-400">{s.sort_order}</td>
                      <td className="px-5 py-3 font-medium">{s.name}</td>
                      <td className="px-5 py-3 font-mono text-slate-500">
                        {s.code}
                      </td>
                      <td className="px-5 py-3 text-slate-500">{s.max_score}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => remove(s.id)}
                          className="text-sm text-red-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Teams + Members */}
          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <h2 className="font-semibold">Teams & Members</h2>
            </div>
            {teams.length === 0 ? (
              <p className="p-6 text-center text-slate-400">No teams yet.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {teams.map((t) => {
                  const teamMembers = members.filter((m) => m.team_id === t.id);
                  return (
                    <div key={t.id} className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{t.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
                          {t.code}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {teamMembers.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            {m.name}
                            <button
                              onClick={() => removeTeamMember(m.id).then(load)}
                              className="ml-1 text-slate-400 hover:text-red-500"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* QR Quiz Manager */}
          <div className="card p-6">
            <h2 className="mb-2 font-semibold">📱 QR Code Quiz</h2>
            <p className="text-sm text-slate-500 mb-4">
              Manage quiz questions and view attempts for the "Find and Scan the QR code" station.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/admin/quiz" className="btn-primary inline-block">
                Open Quiz Manager
              </Link>
            </div>
          </div>

          {/* Create QR Station */}
          <CreateQRStationButton />

          {/* Reset */}
          <div className="card border-red-200 bg-red-50 p-6">
            <h2 className="mb-2 font-semibold text-red-700">Danger zone</h2>
            <p className="mb-4 text-sm text-red-600">
              This deletes all teams, members, and scores. Stations are kept.
            </p>
            <button
              onClick={reset}
              className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
            >
              Reset game data
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
