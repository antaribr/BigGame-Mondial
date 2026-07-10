"use client";

import { useState, useEffect } from "react";
import type { QuizAttempt, Question } from "@/lib/quiz-api";
import type { Team } from "@/lib/types";

type AttemptWithTeam = QuizAttempt & { team?: Team };

export default function QuizAttemptsManager() {
  const [attempts, setAttempts] = useState<AttemptWithTeam[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "pending">("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const { supabase } = await import("@/lib/supabase");

      const [attemptsRes, teamsRes] = await Promise.all([
        supabase.from("quiz_attempts").select("*").order("started_at", { ascending: false }),
        supabase.from("teams").select("*"),
      ]);

      const teamsMap = new Map((teamsRes.data ?? []).map((t) => [t.id, t]));
      const combined = (attemptsRes.data ?? []).map((a) => ({
        ...a,
        team: teamsMap.get(a.team_id),
      }));

      setAttempts(combined as AttemptWithTeam[]);
      setTeams((teamsRes.data ?? []) as Team[]);
    } catch (e) {
      console.error("Error loading quiz attempts:", e);
    }
    setLoading(false);
  }

  const filteredAttempts = attempts.filter((a) => {
    if (filter === "completed") return a.completed_at !== null;
    if (filter === "pending") return a.completed_at === null;
    return true;
  });

  const completedAttempts = attempts.filter((a) => a.completed_at !== null);
  const totalScore = completedAttempts.reduce((sum, a) => sum + a.score, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">📊 Quiz Attempts</h2>
        <p className="text-sm text-slate-500">
          Monitor which teams have completed the QR quiz
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold">{attempts.length}</div>
          <div className="text-xs text-slate-500">Total Attempts</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">
            {completedAttempts.length}
          </div>
          <div className="text-xs text-slate-500">Completed</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">
            {attempts.length - completedAttempts.length}
          </div>
          <div className="text-xs text-slate-500">In Progress</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">
            {totalScore.toFixed(1)}
          </div>
          <div className="text-xs text-slate-500">Total Points Given</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "completed", "pending"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === f
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Attempts List */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : filteredAttempts.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          No quiz attempts yet.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Correct</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Completed</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttempts.map((attempt) => (
                <tr key={attempt.id} className="border-b border-slate-50">
                  <td className="px-4 py-3">
                    <span className="font-medium">
                      {attempt.team?.name ?? "Unknown Team"}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">
                      #{attempt.team?.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {attempt.completed_at ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        ✓ Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        ⏳ In Progress
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {attempt.completed_at ? (
                      <span className="font-medium">
                        {attempt.correct_answers}/{attempt.questions_answered}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {attempt.completed_at ? (
                      <span className="font-bold text-indigo-600">
                        {attempt.score} pts
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(attempt.started_at).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {attempt.completed_at
                      ? new Date(attempt.completed_at).toLocaleTimeString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reset Quiz Attempts */}
      <div className="card border-red-200 bg-red-50 p-4">
        <h3 className="font-semibold text-red-700">Reset Quiz Attempts</h3>
        <p className="mt-1 text-sm text-red-600">
          This will delete all quiz attempts, allowing teams to retake the quiz.
          Note: Points already awarded to stations will NOT be removed.
        </p>
        <button
          onClick={async () => {
            if (!confirm("Delete ALL quiz attempts? This cannot be undone."))
              return;
            try {
              const { supabase } = await import("@/lib/supabase");
              await supabase.from("quiz_answers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
              await supabase.from("quiz_attempts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
              loadData();
              alert("Quiz attempts reset!");
            } catch (e) {
              alert("Error resetting attempts");
            }
          }}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Reset All Quiz Attempts
        </button>
      </div>
    </div>
  );
}
