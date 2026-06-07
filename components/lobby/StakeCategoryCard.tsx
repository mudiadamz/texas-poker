"use client";

import { ArrowRight, Coins, Lock, Users } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  blindsLabel,
  minBuyInOf,
  maxBuyInOf,
  bigBlindOf,
  formatChips,
  type StakeCategory,
} from "@/lib/stakes";

type Props = {
  category: StakeCategory;
  /** Players seated across all tables of this stake. */
  playerCount: number;
  /** Caller's main bankroll (for affordability gating). */
  mainChips: number | null | undefined;
  /** Buy-in multiplier in big blinds (admin setting, default 100). */
  buyInBb?: number;
  /** Click → quick-join inside this stake. */
  onJoin: () => void;
  busy?: boolean;
};

export function StakeCategoryCard({
  category,
  playerCount,
  mainChips,
  buyInBb,
  onJoin,
  busy,
}: Props) {
  const minBuyIn = minBuyInOf(category);
  const maxBuyIn = maxBuyInOf(category, buyInBb);
  const blinds = blindsLabel(category);
  const bb = bigBlindOf(category);

  const canAfford =
    typeof mainChips === "number" ? mainChips >= minBuyIn : true;
  const hot = playerCount >= 5;
  const disabled = busy || !canAfford;

  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={disabled}
      className={cn(
        "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-wood/40 via-wood-dark/70 to-black/60 px-3 py-2.5 text-left shadow-[0_4px_12px_-6px_rgba(0,0,0,0.55)] backdrop-blur transition sm:gap-3.5 sm:px-4 sm:py-3",
        disabled
          ? "cursor-not-allowed opacity-55"
          : "hover:-translate-y-0.5 hover:shadow-[0_8px_28px_-8px_rgba(212,175,55,0.45)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[3px]",
          canAfford
            ? "bg-gradient-to-b from-amber-300/0 via-amber-300/80 to-amber-300/0"
            : "bg-white/10",
        )}
      />

      {/* Left: tier emblem */}
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg font-serif font-bold shadow-inner ring-1 sm:h-12 sm:w-12",
          canAfford
            ? cn(category.theme.badge, "ring-white/10")
            : "bg-wood-dark/60 text-ivory/40 ring-white/5",
        )}
      >
        <span className="text-[8px] uppercase tracking-widest opacity-70">
          BB
        </span>
        <span className="font-mono text-xs leading-none">
          {formatChips(bb)}
        </span>
      </div>

      {/* Middle: name + blinds + stats */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "font-serif text-base font-bold tracking-tight",
              canAfford ? "text-ivory-soft" : "text-ivory/60",
            )}
          >
            {category.label}
          </h3>
          <span
            className={cn(
              "rounded-full bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ring-1 ring-white/10",
              canAfford ? category.theme.accent : "text-ivory/40",
            )}
          >
            {blinds}
          </span>
          {hot && (
            <span className="rounded-full bg-gradient-to-r from-amber-400 to-amber-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-wood-dark shadow">
              Hot
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-ivory/70">
          <span className="inline-flex items-center gap-1">
            <Coins className="h-3 w-3 text-gold-soft" />
            <span
              className="font-mono"
              title={`Buy-in ${minBuyIn.toLocaleString()} – ${maxBuyIn.toLocaleString()}`}
            >
              {formatChips(minBuyIn)}–{formatChips(maxBuyIn)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3 text-emerald-300" />
            <span className="font-mono">{playerCount}</span>
          </span>
        </div>
      </div>

      {/* Right: CTA */}
      <div className="shrink-0">
        {!canAfford ? (
          <span className="inline-flex items-center justify-center rounded-full bg-black/40 p-1.5 text-ivory/55 ring-1 ring-white/10">
            <Lock className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-700 px-3 py-1.5 font-serif text-[11px] font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_8px_rgba(0,0,0,0.3)] ring-1 ring-emerald-300/50 transition group-hover:from-emerald-300 group-hover:to-emerald-600">
            Join
            <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </button>
  );
}
