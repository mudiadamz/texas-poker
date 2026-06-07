"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/cn";
import type { GamePhase } from "@/lib/poker";
import { PHASE_LABELS } from "@/lib/poker";

type Props = {
  phase: GamePhase;
  phaseEndsAt: string | null;
  onExpired?: () => void;
};

export function PhaseTimer({ phase, phaseEndsAt, onExpired }: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!phaseEndsAt || phase === "waiting") {
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
  }, [phaseEndsAt, phase, onExpired]);

  if (phase === "waiting" || secondsLeft === null) {
    return (
      <p className="font-serif text-xs font-medium uppercase tracking-wider text-ivory/80 sm:text-sm">
        {PHASE_LABELS[phase]}
      </p>
    );
  }

  const urgent = secondsLeft <= 5;

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="font-serif text-[10px] font-bold uppercase tracking-widest text-ivory/70 sm:text-xs">
        {PHASE_LABELS[phase]}
      </p>
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-sm font-bold tabular-nums",
          urgent
            ? "border-red-400/70 bg-red-950/50 text-red-200 animate-pulse"
            : "border-gold/50 bg-felt-dark/80 text-gold-soft",
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        <span>{secondsLeft}s</span>
      </div>
    </div>
  );
}
