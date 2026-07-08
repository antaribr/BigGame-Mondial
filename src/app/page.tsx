import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <Brand />
        <nav className="flex items-center gap-2 text-sm">
          <Link className="btn-ghost" href="/scoreboard">
            📊 Scoreboard
          </Link>
          <Link className="btn-ghost" href="/admin">
            ⚙️ Admin
          </Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center py-20 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-fuchsia-600 shadow-sm">
          ● Live event
        </span>
        <h1 className="font-display text-5xl font-bold leading-[1.05] sm:text-7xl">
          The{" "}
          <span className="bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-amber-500 bg-clip-text text-transparent">
            Big Game
          </span>
        </h1>
        <p className="mt-5 max-w-md text-base text-slate-600 sm:text-lg">
          Live team game with real-time scoring. Each role has its own dedicated
          link — there is no shared entrance.
        </p>

        <div className="mt-10 grid w-full max-w-2xl gap-4 sm:grid-cols-2">
          <InfoCard
            emoji="🏃"
            title="Teams"
            text="Use the team link your organizer shared to register & track tasks."
          />
          <InfoCard
            emoji="🎯"
            title="Advisors"
            text="Use the station link your organizer shared to score teams."
          />
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Built with Next.js · Supabase · Vercel
      </footer>
    </main>
  );
}

function InfoCard({
  emoji,
  title,
  text,
}: {
  emoji: string;
  title: string;
  text: string;
}) {
  return (
    <div className="card relative overflow-hidden p-5 text-left">
      <div className="text-3xl">{emoji}</div>
      <div className="mt-2 font-display text-lg font-semibold text-slate-900">
        {title}
      </div>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}
