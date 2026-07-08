import Link from "next/link";
import { Brand } from "@/components/Brand";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6">
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

      <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-fuchsia-300">
          ● Live event
        </span>
        <h1 className="font-display text-5xl font-bold leading-[1.05] sm:text-7xl">
          The{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">
            Big Game
          </span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
          Register your team, take on every station, and watch the points roll
          in live. Advisors score you on the spot.
        </p>

        <div className="mt-10 grid w-full max-w-3xl gap-4 sm:grid-cols-2">
          <RoleCard
            href="/team"
            emoji="🏃"
            title="I'm a Team"
            subtitle="Register your crew & track your tasks"
            accent="from-indigo-500 to-fuchsia-500"
          />
          <RoleCard
            href="/advisor"
            emoji="🎯"
            title="I'm an Advisor"
            subtitle="Score teams at your station"
            accent="from-fuchsia-500 to-amber-400"
          />
        </div>

        <Link
          className="mt-8 text-sm text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
          href="/scoreboard"
        >
          📺 View the live scoreboard →
        </Link>
      </section>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
        Built with Next.js · Supabase · Deploy on Vercel
      </footer>
    </main>
  );
}

function RoleCard({
  href,
  emoji,
  title,
  subtitle,
  accent,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="card group relative overflow-hidden p-6 text-left transition hover:-translate-y-0.5 hover:border-white/20"
    >
      <div
        className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl transition group-hover:opacity-40`}
      />
      <div className="text-4xl">{emoji}</div>
      <div className="mt-3 font-display text-2xl font-semibold">{title}</div>
      <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
      <div className="mt-4 text-sm font-semibold text-fuchsia-300">Open →</div>
    </Link>
  );
}
