"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { loginAdmin } from "./actions";

export default function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) return;
    setLoading(true);
    const res = await loginAdmin(code);
    setLoading(false);
    if (res.ok) router.refresh();
    else setError(res.error ?? "Login failed.");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Brand />
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Admin login</h1>
            <p className="mt-2 text-slate-500">Enter the organizer admin code.</p>
          </div>

          <form onSubmit={submit} className="card space-y-4 p-6">
            <input
              className="input text-center font-mono"
              placeholder="ADMIN CODE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={40}
            />
            {error && (
              <p className="text-center text-sm text-red-500">{error}</p>
            )}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? "Checking…" : "Enter →"}
            </button>
          </form>

          <div className="text-center">
            <Link href="/team" className="text-sm text-slate-400 hover:text-slate-600">
              ← Back to team portal
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
