import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-amber-500 text-lg font-black text-white shadow-lg shadow-fuchsia-500/30">
        B
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight text-slate-900">
          Big<span className="text-fuchsia-600">Game</span>
        </span>
      )}
    </Link>
  );
}
