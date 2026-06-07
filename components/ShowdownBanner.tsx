"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

import { formatChips } from "@/lib/stakes";
import type { WinnerInfo } from "@/lib/types";

type Props = {
  winners: WinnerInfo[];
  pot: number;
  /** Absolute timestamp when the showdown auto-closes. */
  phaseEndsAt?: string | null;
  /** Fires when the showdown countdown hits zero. */
  onExpired?: () => void;
};

/**
 * Showdown summary rendered at the table center. Lists the winners
 * with their hand label and ticks down the auto-close timer so the
 * room can move on to the next hand (advance_phase → end_showdown).
 */
export function ShowdownBanner({
  winners,
  pot,
  phaseEndsAt,
  onExpired,
}: Props) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!phaseEndsAt) {
      setSeconds(null);
      return;
    }
    const end = new Date(phaseEndsAt).getTime();
    let fired = false;
    function tick() {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSeconds(left);
      if (left === 0 && !fired) {
        fired = true;
        onExpired?.();
      }
    }
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [phaseEndsAt, onExpired]);

  return (
    <div className="pointer-events-auto mx-auto flex max-w-md flex-col items-center gap-1.5 rounded-xl border-2 border-gold/60 bg-wood-dark/95 px-4 py-2 text-center shadow-2xl ring-1 ring-gold/30 backdrop-blur">
      <div className="flex items-center gap-1.5 text-gold-soft">
        <Trophy className="h-4 w-4" />
        <span className="font-serif text-[11px] font-bold uppercase tracking-widest sm:text-xs">
          Winner{winners.length > 1 ? "s" : ""}
        </span>
      </div>

      {winners.length === 0 ? (
        <p className="font-serif text-xs text-ivory-dim">Resolving hands…</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {winners.map((w) => (
            <li
              key={w.player_id}
              className="text-sm leading-tight text-ivory"
            >
              <span className="font-bold text-gold-soft">{w.name}</span>
              <span className="text-ivory-dim"> · {w.hand_label}</span>
              <span
                className="ml-1 font-mono text-gold-soft"
                title={w.amount.toLocaleString()}
              >
                +{formatChips(w.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2 text-[10px] text-ivory-dim sm:text-[11px]">
        {pot > 0 && (
          <span title={pot.toLocaleString()}>Pot {formatChips(pot)}</span>
        )}
        {seconds !== null && seconds > 0 && (
          <span>· Next hand in {seconds}s</span>
        )}
      </div>
    </div>
  );
}
