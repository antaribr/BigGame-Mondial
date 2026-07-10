"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
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
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-3">
          <Brand />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="text-5xl">🎯</div>
          <div>
            <h1 className="text-2xl font-bold">Advisor station</h1>
            <p className="mt-2 text-slate-500">
              Enter your station code to start scoring teams.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4 text-left">
            <input
              className="input text-center font-mono text-xl tracking-widest"
              placeholder="STATION CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
              maxLength={8}
            />
            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Checking…" : "Open station →"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
