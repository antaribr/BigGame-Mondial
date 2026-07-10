import QuestionManager from "../QuestionManager";
import QuizAttemptsManager from "../QuizAttemptsManager";
import Link from "next/link";

export default function QuizAdminPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link
            href="/admin"
            className="text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Back to Admin
          </Link>
          <h1 className="text-lg font-bold">📱 QR Quiz Manager</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="space-y-8">
          {/* Question Manager */}
          <QuestionManager />

          <hr className="border-slate-200" />

          {/* Quiz Attempts */}
          <QuizAttemptsManager />
        </div>
      </main>
    </div>
  );
}
