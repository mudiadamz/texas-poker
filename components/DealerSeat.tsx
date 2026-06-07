"use client";

import Image from "next/image";

import { cn } from "@/lib/cn";
import type { GamePhase } from "@/lib/poker";

type Props = {
  phase: GamePhase;
};

/**
 * Static "house" position at the head of the table. The pot itself
 * lives on the felt next to the community cards now; this seat just
 * anchors the dealer figure (a friendly portrait so the player has
 * someone to look at across the table).
 */
export function DealerSeat({ phase }: Props) {
  const active = phase !== "waiting";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "relative h-20 w-20 overflow-hidden rounded-2xl border-2 shadow-lg ring-1 sm:h-24 sm:w-24",
          active
            ? "border-gold/80 ring-gold/40"
            : "border-gold/40 ring-gold/20 grayscale",
        )}
        title="Dealer"
        aria-label="Dealer"
      >
        <Image
          src="/dealer/dealer.png"
          alt="Dealer"
          fill
          sizes="96px"
          // Anchor the crop to the face/upper body so the tiny
          // square avatar always shows a clear head-and-shoulders shot.
          className="object-cover object-top"
          priority
          unoptimized
        />
        {!active && (
          <div className="absolute inset-0 bg-wood-dark/40" aria-hidden />
        )}
      </div>
      <span className="font-serif text-[10px] font-bold uppercase tracking-widest text-ivory-soft sm:text-xs">
        Dealer
      </span>
    </div>
  );
}
