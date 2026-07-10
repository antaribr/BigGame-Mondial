"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shell } from "@/components/ui";
import {
  fetchTeams,
  fetchQuestions,
  checkQuizAttempt,
  startQuizAttempt,
  submitQuizAnswers,
  awardQuizPoints,
} from "@/lib/quiz-api";
import type { Team, Station } from "@/lib/types";
import type { Question } from "@/lib/quiz-api";

const QUIZ_TIME = 20; // seconds
const POINTS_PER_CORRECT = 0.5;

type QuizState = "select-team" | "ready" | "quiz" | "completed" | "already-done";

export default function QRFormPage() {
  const params = useParams<{ code: string }>();
  const stationCode = (params?.code ?? "") as string;
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [station, setStation] = useState<Station | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizState, setQuizState] = useState<QuizState>("select-team");
  const [currentAttempt, setCurrentAttempt] = useState<{
    id: string;
    team_id: string;
    station_id: string;
  } | null>(null);

  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME);
  const [results, setResults] = useState<{
    score: number;
    correct_answers: number;
    questions_answered: number;
  } | null>(null);

  // Load station and teams on mount
  useEffect(() => {
    async function load() {
      // Fetch station info from the code
      const { supabase } = await import("@/lib/supabase");
      const { data: stationData } = await supabase
        .from("stations")
        .select("*")
        .eq("code", stationCode.toUpperCase())
        .maybeSingle();

      if (stationData) {
        setStation(stationData as Station);
      }

      // Fetch all teams
      const allTeams = await fetchTeams();
      setTeams(allTeams);
    }
    load();
  }, [stationCode]);

  // Timer effect
  useEffect(() => {
    if (quizState !== "quiz") return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quizState]);

  // Check if selected team already attempted
  useEffect(() => {
    if (!selectedTeam || !station) return;

    async function check() {
      const attempt = await checkQuizAttempt(selectedTeam.id, station.id);
      if (attempt && attempt.completed_at) {
        setQuizState("already-done");
        setResults({
          score: attempt.score,
          correct_answers: attempt.correct_answers,
          questions_answered: attempt.questions_answered,
        });
      }
    }
    check();
  }, [selectedTeam, station]);

  const handleTeamSelect = (team: Team) => {
    setSelectedTeam(team);
    setQuizState("ready");
  };

  const handleStart = useCallback(async () => {
    if (!selectedTeam || !station) return;

    // Start attempt
    const attempt = await startQuizAttempt(selectedTeam.id, station.id);
    if (!attempt) {
      alert("Could not start quiz. Please try again.");
      return;
    }

    // Fetch and shuffle questions
    const qs = await fetchQuestions(20);
    setQuestions(qs);
    setCurrentAttempt({
      id: attempt.id,
      team_id: attempt.id, // We'll use attempt.id directly
      station_id: station.id,
    });
    setAnswers(new Map());
    setCurrentQuestion(0);
    setTimeLeft(QUIZ_TIME);
    setQuizState("quiz");
  }, [selectedTeam, station]);

  const handleAnswer = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const newMap = new Map(prev);
      newMap.set(questionId, option);
      return newMap;
    });

    // Auto-advance to next question after short delay
    setTimeout(() => {
      setCurrentQuestion((prev) => {
        if (prev < questions.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 300);
  };

  const handleSubmit = useCallback(async () => {
    if (!currentAttempt || !selectedTeam || !station) return;

    setQuizState("completed");

    // Convert answers map to array
    const answersArray = questions.map((q) => ({
      question_id: q.id,
      selected_option: answers.get(q.id) || null,
    }));

    // Submit and get results
    const result = await submitQuizAnswers(currentAttempt.id, answersArray);
    setResults(result);

    // Award points to station
    if (result.score > 0) {
      try {
        await awardQuizPoints(selectedTeam.id, stationCode, result.score);
      } catch (e) {
        console.error("Could not award points:", e);
      }
    }
  }, [currentAttempt, selectedTeam, station, stationCode, questions, answers]);

  const currentQ = questions[currentQuestion];

  // ─── TEAM SELECTION ───
  if (quizState === "select-team") {
    return (
      <Shell back="/team">
        <div className="text-center mb-6">
          <span className="text-5xl mb-4 block">📱</span>
          <h1 className="text-2xl font-bold">QR Code Quiz</h1>
          <p className="text-slate-500 mt-2">
            Scan the QR code and answer the questions!
          </p>
          {station && (
            <div className="mt-4 inline-block rounded-lg bg-slate-100 px-4 py-2">
              <span className="text-sm text-slate-500">Station:</span>
              <span className="ml-2 font-semibold">{station.name}</span>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold mb-4">Select your team:</h2>
          {teams.length === 0 ? (
            <p className="text-slate-400">No teams found.</p>
          ) : (
            <div className="grid gap-3">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleTeamSelect(team)}
                  className="btn-ghost w-full justify-start text-left p-4"
                >
                  <span className="font-semibold">{team.name}</span>
                  <span className="ml-2 text-xs text-slate-400">#{team.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // ─── READY TO START ───
  if (quizState === "ready") {
    return (
      <Shell back="/team">
        <div className="text-center">
          <span className="text-6xl mb-4 block">🎯</span>
          <h1 className="text-2xl font-bold">Ready, {selectedTeam?.name}?</h1>
          <p className="text-slate-500 mt-2">
            You will answer <strong>20 questions</strong> in <strong>20 seconds</strong>!
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Each correct answer = {POINTS_PER_CORRECT} points
          </p>

          <button
            onClick={handleStart}
            className="btn-primary mt-8 text-lg px-8 py-4"
          >
            🚀 Start Quiz
          </button>

          <p className="mt-4 text-xs text-slate-400">
            Note: You can only take this quiz once!
          </p>
        </div>
      </Shell>
    );
  }

  // ─── QUIZ IN PROGRESS ───
  if (quizState === "quiz" && currentQ) {
    const progress = ((currentQuestion + 1) / questions.length) * 100;
    const isLowTime = timeLeft <= 5;

    return (
      <Shell back="/team">
        {/* Timer & Progress */}
        <div className="card p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-500">
              Question {currentQuestion + 1} of {questions.length}
            </span>
            <span
              className={`text-2xl font-bold ${
                isLowTime ? "text-red-500 animate-pulse" : "text-slate-700"
              }`}
            >
              ⏱️ {timeLeft}s
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="card p-6 mb-4">
          <h2 className="text-lg font-semibold mb-6">{currentQ.question}</h2>

          <div className="grid gap-3">
            {["A", "B", "C", "D"].map((option) => {
              const isSelected = answers.get(currentQ.id) === option;
              return (
                <button
                  key={option}
                  onClick={() => handleAnswer(currentQ.id, option)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-sm font-bold mr-3">
                    {option}
                  </span>
                  {currentQ[`option_${option.toLowerCase()}` as keyof typeof currentQ]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Answered indicator */}
        <div className="flex justify-center gap-1 flex-wrap">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className={`w-3 h-3 rounded-full ${
                i === currentQuestion
                  ? "bg-indigo-500"
                  : answers.has(q.id)
                  ? "bg-emerald-500"
                  : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Submit button (in case they finish early) */}
        {answers.size === questions.length && (
          <button
            onClick={handleSubmit}
            className="btn-primary w-full mt-6"
          >
            Submit Answers ({answers.size}/{questions.length})
          </button>
        )}
      </Shell>
    );
  }

  // ─── ALREADY COMPLETED ───
  if (quizState === "already-done" && results) {
    return (
      <Shell back="/team">
        <div className="text-center">
          <span className="text-6xl mb-4 block">✅</span>
          <h1 className="text-2xl font-bold">Quiz Already Completed!</h1>
          <p className="text-slate-500 mt-2">
            You have already taken this quiz.
          </p>

          <div className="card p-6 mt-8 text-center">
            <div className="text-4xl font-bold text-indigo-600">
              {results.score} pts
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {results.correct_answers} out of {results.questions_answered} correct
            </div>
          </div>

          <button
            onClick={() => router.push("/team")}
            className="btn-ghost mt-6"
          >
            ← Back to Team Portal
          </button>
        </div>
      </Shell>
    );
  }

  // ─── RESULTS ───
  if (quizState === "completed" && results) {
    const percentage = Math.round(
      (results.correct_answers / results.questions_answered) * 100
    );

    return (
      <Shell back="/team">
        <div className="text-center">
          <span className="text-6xl mb-4 block">
            {percentage >= 80 ? "🏆" : percentage >= 50 ? "👍" : "📚"}
          </span>
          <h1 className="text-2xl font-bold">Quiz Complete!</h1>
          <p className="text-slate-500 mt-2">
            {selectedTeam?.name}, your results are in!
          </p>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-indigo-600">
                {results.score}
              </div>
              <div className="text-xs text-slate-500 mt-1">Points Earned</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-emerald-600">
                {results.correct_answers}
              </div>
              <div className="text-xs text-slate-500 mt-1">Correct</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-3xl font-bold text-slate-600">
                {percentage}%
              </div>
              <div className="text-xs text-slate-500 mt-1">Accuracy</div>
            </div>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Points have been added to your team automatically! 🎉
          </p>

          <button
            onClick={() => router.push("/team")}
            className="btn-primary mt-6"
          >
            Back to Team Portal
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell back="/team">
      <div className="text-center">
        <p>Loading...</p>
      </div>
    </Shell>
  );
}
