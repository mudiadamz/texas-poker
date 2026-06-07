"use client";

import { Sparkles } from "lucide-react";

type Props = {
  /** How many free spins the user has left (0..3). */
  spinsRemaining: number;
  /** Pre-formatted "MM:SS" until next refill (null when spins available). */
  cooldownLabel: string | null;
  onClick: () => void;
};

/**
 * Compact spin-wheel widget tucked into the lobby sidebar. Glows
 * when the player has spins left and switches to a quiet countdown
 * card once the bar is empty.
 */
export function SpinSidebarWidget({
  spinsRemaining,
  cooldownLabel,
  onClick,
}: Props) {
  const ready = spinsRemaining > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left shadow-lg transition ${
        ready
          ? "bg-gradient-to-br from-amber-700/45 via-amber-900/40 to-amber-800/40 shadow-amber-500/15 hover:-translate-y-0.5 hover:shadow-amber-500/30"
          : "bg-wood-dark/60 hover:bg-wood-dark/80"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          ready
            ? "bg-gradient-to-br from-amber-300 via-amber-500 to-amber-800 text-wood-dark shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_0_12px_rgba(245,158,11,0.55)] animate-pulse"
            : "bg-black/30 text-gold-soft/70"
        }`}
      >
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-serif text-[11px] font-bold uppercase tracking-widest text-gold-soft">
          Hourly bonus
        </p>
        {ready ? (
          <p className="truncate text-[11px] text-ivory/70">
            Spin to win chips
          </p>
        ) : (
          <p className="truncate font-mono text-[11px] tabular-nums text-ivory/70">
            <span className="opacity-60">refill in </span>
            <span className="text-gold-soft">{cooldownLabel}</span>
          </p>
        )}
      </div>
    </button>
  );
}
