"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/Brand";
import { TabButton } from "@/components/ui";
import { registerTeam, fetchTeamByCode } from "@/lib/api";

const TEAM_KEY = "bg_team_code";

export default function TeamEntryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"register" | "join">("register");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Brand home="/team" />
      </header>

      <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1">
        <TabButton active={tab === "register"} onClick={() => setTab("register")}>
          Register a team
        </TabButton>
        <TabButton active={tab === "join"} onClick={() => setTab("join")}>
          I have a code
        </TabButton>
      </div>

      <div className="mt-6 animate-fade-in">
        {tab === "register" ? (
          <RegisterForm
            onDone={(code) => router.push(`/team/${code}`)}
            key="register"
          />
        ) : (
          <JoinForm onDone={(code) => router.push(`/team/${code}`)} key="join" />
        )}
      </div>
    </main>
  );
}

function RegisterForm({ onDone }: { onDone: (code: string) => void }) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter a team name.");
      return;
    }
    setLoading(true);
    try {
      const team = await registerTeam(name, members);
      localStorage.setItem(TEAM_KEY, team.code);
      onDone(team.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-5 p-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Team name
        </label>
        <input
          className="input"
          placeholder="e.g. The Phoenix Squad"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-slate-700">
            Team members
          </label>
          <span className="text-xs text-slate-400">
            {members.filter((m) => m.trim()).length} added
          </span>
        </div>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input"
                placeholder={`Member ${i + 1} name`}
                value={m}
                onChange={(e) =>
                  setMembers((s) => s.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                maxLength={40}
              />
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => setMembers((s) => s.filter((_, idx) => idx !== i))}
                  className="btn-ghost px-3"
                  aria-label="Remove member"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMembers((s) => [...s, ""])}
          className="mt-2 text-sm font-semibold text-fuchsia-600 hover:text-fuchsia-700"
        >
          + Add member
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Creating…" : "Create team & play →"}
      </button>
      <p className="text-center text-xs text-slate-400">
        You'll get a team code to rejoin later.
      </p>
    </form>
  );
}

function JoinForm({ onDone }: { onDone: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) return;
    setLoading(true);
    try {
      const team = await fetchTeamByCode(code);
      if (!team) {
        setError("No team found with that code.");
        setLoading(false);
        return;
      }
      localStorage.setItem(TEAM_KEY, team.code);
      onDone(team.code);
    } catch {
      setError("Could not look up the team.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Team code
        </label>
        <input
          className="input text-center text-lg uppercase tracking-widest"
          placeholder="ABCDE"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
          maxLength={8}
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Checking…" : "Join team →"}
      </button>
    </form>
  );
}
