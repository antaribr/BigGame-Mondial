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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-6">
      <header className="mb-8 flex items-center justify-between">
        <Brand />
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
          ← Home
        </Link>
      </header>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Admin login</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter the organizer admin code.
          </p>
        </div>
        <input
          className="input text-center uppercase tracking-widest"
          placeholder="ADMIN CODE"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={40}
        />
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? "Checking…" : "Enter →"}
        </button>
      </form>
    </main>
  );
}
