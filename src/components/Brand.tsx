import Link from "next/link";

export function Brand({
  compact = false,
  home,
}: {
  compact?: boolean;
  home?: string;
}) {
  const inner = (
    <>
      <span className="inline-block h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-amber-500 text-center leading-7 text-white shadow-md">
        B
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight text-slate-900">
          BigGame
        </span>
      )}
    </>
  );

  // When no `home` is given, render as a static mark (no link) — used to keep
  // a portal "locked in" so users can't navigate away.
  if (!home) return <div className="flex items-center gap-2">{inner}</div>;

  return (
    <Link href={home} className="flex items-center gap-2">
      {inner}
    </Link>
  );
}
