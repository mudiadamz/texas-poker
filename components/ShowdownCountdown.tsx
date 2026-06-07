"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

type Props = {
  phaseEndsAt: string | null;
  onExpired?: () => void;
  /** Heading text rendered above the seconds counter. */
  label: string;
  /** Visual tone — defaults to "showdown" (large gold counter). */
  tone?: "showdown" | "reveal";
};

/**
 * Generic table-center countdown used for any phase where no single
 * player owns the action (showdown reveal, all-in auto-reveal). Fires
 * `onExpired` so the SQL `advance_phase` can move the room forward.
 */
export function ShowdownCountdown({
  phaseEndsAt,
  onExpired,
  label,
  tone = "showdown",
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!phaseEndsAt) {
      setSecondsLeft(null);
      return;
    }

    function tick() {
      const end = new Date(phaseEndsAt!).getTime();
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) onExpired?.();
    }

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [phaseEndsAt, onExpired]);

  return (
    <div className="flex flex-col items-center gap-1">
      <p
        className={cn(
          "font-serif text-xs font-bold uppercase tracking-widest sm:text-sm",
          tone === "showdown" ? "text-gold-soft" : "text-ivory/80",
        )}
      >
        {label}
      </p>
      {secondsLeft !== null && secondsLeft > 0 && (
        <span
          className={cn(
            "font-mono font-bold tabular-nums",
            tone === "showdown" ? "text-2xl text-ivory" : "text-lg text-gold-soft",
          )}
        >
          {secondsLeft}s
        </span>
      )}
    </div>
  );
}
