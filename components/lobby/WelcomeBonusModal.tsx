"use client";

import { useState } from "react";
import { Coins, Gift, Sparkles, X } from "lucide-react";

import { formatChips } from "@/lib/stakes";
import { getSupabase } from "@/lib/supabase";

type Props = {
  /** Called after the bonus is successfully credited. */
  onClaimed: (amount: number) => void;
  /** Allow the user to dismiss the modal without claiming. */
  onDismiss?: () => void;
};

const BONUS_AMOUNT = 10_000_000;

/**
 * One-shot welcome popup shown in the lobby the first time a user
 * signs in. Calls the `claim_welcome_bonus` RPC, which credits the
 * profile and stamps `welcome_claimed_at` server-side so the popup
 * never re-appears.
 */
export function WelcomeBonusModal({ onClaimed, onDismiss }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const handleClaim = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcErr } = await supabase
        .rpc("tp_claim_welcome_bonus")
        .single();
      if (rpcErr) throw rpcErr;
      const amount = (data as { amount: number } | null)?.amount ?? BONUS_AMOUNT;
      setRevealed(true);
      // Tiny celebration window before letting the modal close so the
      // big number gets a beat to shine.
      window.setTimeout(() => onClaimed(amount), 1400);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to claim bonus.",
      );
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-bonus-title"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-gold/70 bg-gradient-to-br from-amber-700/40 via-wood-dark to-black shadow-[0_0_60px_rgba(212,175,55,0.35),0_25px_60px_-15px_rgba(0,0,0,0.7)]">
        {onDismiss && !revealed && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-3 z-10 rounded-full p-1 text-ivory/50 transition hover:bg-white/10 hover:text-ivory-soft"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 5px)",
            }}
          />
        </div>

        <div className="relative px-6 pt-7 pb-6 text-center sm:px-8 sm:pt-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-gold/80 bg-gradient-to-br from-amber-400 via-amber-600 to-amber-900 shadow-[inset_0_2px_0_rgba(255,255,255,0.35),0_8px_25px_rgba(0,0,0,0.4)] sm:h-20 sm:w-20">
            <Gift className="h-8 w-8 text-wood-dark sm:h-10 sm:w-10" />
          </div>

          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.25em] text-gold-soft">
            Welcome bonus
          </p>
          <h2
            id="welcome-bonus-title"
            className="mt-1 font-serif text-2xl font-bold tracking-tight text-ivory-soft sm:text-3xl"
          >
            Your seat at the table
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ivory/75">
            Glad you&apos;re here. Claim your starter stack and you&apos;re
            ready to take a seat at any cash game on the floor.
          </p>

          <div
            className={`mx-auto mt-6 flex items-center justify-center gap-3 rounded-2xl border-2 border-gold/60 bg-black/60 px-6 py-4 shadow-inner transition-all duration-500 ${
              revealed ? "scale-105 border-emerald-400/80 ring-2 ring-emerald-400/40" : ""
            }`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-700 text-wood-dark shadow">
              <Coins className="h-5 w-5" />
            </span>
            <div className="text-left leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ivory/60">
                Starter chips
              </p>
              <p className="font-mono text-2xl font-bold text-gold-soft sm:text-3xl">
                {formatChips(BONUS_AMOUNT)}
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-400/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleClaim}
            disabled={busy || revealed}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gold/60 bg-gradient-to-b from-emerald-400 to-emerald-700 px-5 py-3 font-serif text-sm font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_rgba(0,0,0,0.4)] transition hover:from-emerald-300 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Sparkles className="h-4 w-4" />
            {revealed
              ? `+${formatChips(BONUS_AMOUNT)} credited`
              : busy
                ? "Crediting…"
                : "Claim bonus"}
          </button>
        </div>
      </div>
    </div>
  );
}
