"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { fetchStationByCode } from "@/lib/api";

const STATION_KEY = "bg_station_code";

export default function AdvisorEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) return;
    setLoading(true);
    try {
      const station = await fetchStationByCode(code);
      if (!station) {
        setError("No station with that code.");
        setLoading(false);
        return;
      }
      localStorage.setItem(STATION_KEY, station.code);
      router.push(`/advisor/${station.code}`);
    } catch {
      setError("Could not look up station.");
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Brand />
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Home
        </Link>
      </header>

      <div className="card space-y-4 p-6">
        <div className="text-center">
          <div className="text-4xl">🎯</div>
          <h1 className="mt-2 font-display text-2xl font-bold">Advisor station</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter your station code to start scoring teams.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="input text-center text-lg uppercase tracking-widest"
            placeholder="STATION CODE"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
            maxLength={8}
          />
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Checking…" : "Open station →"}
          </button>
        </form>
      </div>
    </main>
  );
}
