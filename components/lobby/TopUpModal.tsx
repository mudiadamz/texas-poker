"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, Gift, Sparkles, X } from "lucide-react";

import { formatChips } from "@/lib/stakes";
import { getSupabase } from "@/lib/supabase";

type Props = {
  /** Current bankroll, displayed at the top of the modal. */
  mainChips: number | null | undefined;
  /** ISO timestamp of the user's last daily claim. */
  lastDailyAt: string | null;
  /** Open the spin-wheel modal. The top-up dialog closes itself first. */
  onOpenSpin: () => void;
  /** Notify the parent so it can refetch the profile after a claim. */
  onClaimed?: () => void;
  onClose: () => void;
};

const DAILY_AMOUNT = 1_000_000;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function TopUpModal({
  mainChips,
  lastDailyAt,
  onOpenSpin,
  onClaimed,
  onClose,
}: Props) {
  const target = useMemo(
    () => (lastDailyAt ? new Date(lastDailyAt).getTime() + DAILY_COOLDOWN_MS : 0),
    [lastDailyAt],
  );
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const dailyReady = now >= target;
  const dailyLabel = useMemo(() => {
    if (dailyReady) return null;
    const totalSec = Math.max(0, Math.ceil((target - now) / 1000));
    const h = Math.floor(totalSec / 3600).toString().padStart(2, "0");
    const m = Math.floor((totalSec % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSec % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [dailyReady, target, now]);

  const claimDaily = async () => {
    if (!dailyReady || busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = await supabase
        .rpc("tp_claim_daily_bonus")
        .single();
      if (rpcErr) throw rpcErr;
      setClaimed(true);
      onClaimed?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to claim.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-title"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-gold/70 bg-gradient-to-br from-amber-700/30 via-wood-dark to-black shadow-[0_0_60px_rgba(212,175,55,0.35),0_25px_60px_-15px_rgba(0,0,0,0.7)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full p-1 text-ivory/50 transition hover:bg-white/10 hover:text-ivory-soft"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-6 pt-6 pb-5 sm:px-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gold-soft">
            Top up
          </p>
          <h2
            id="topup-title"
            className="mt-1 font-serif text-2xl font-bold tracking-tight text-ivory-soft sm:text-3xl"
          >
            Get more chips
          </h2>
          {typeof mainChips === "number" && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-black/40 px-3 py-1 text-xs text-ivory/75">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-wood-dark">
                <Coins className="h-2.5 w-2.5" />
              </span>
              <span className="font-mono">
                Balance: <span className="text-gold-soft">{formatChips(mainChips)}</span>
              </span>
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3">
            {/* Daily bonus */}
            <div
              className={`relative overflow-hidden rounded-2xl border-2 px-4 py-3 shadow-md transition ${
                dailyReady
                  ? "border-emerald-400/70 bg-gradient-to-br from-emerald-600/30 via-wood-dark to-wood-dark"
                  : "border-gold/30 bg-wood-dark/70"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 ${
                    dailyReady
                      ? "border-emerald-300 bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-800 text-wood-dark shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                      : "border-gold/40 bg-black/30 text-gold-soft/70"
                  }`}
                >
                  <Gift className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-sm font-bold tracking-tight text-ivory-soft">
                    Daily bonus
                  </p>
                  <p className="text-[11px] text-ivory/65">
                    Free {formatChips(DAILY_AMOUNT)} chips every 24 hours
                  </p>
                </div>
                {dailyReady ? (
                  <button
                    type="button"
                    onClick={claimDaily}
                    disabled={busy || claimed}
                    className="rounded-lg border-2 border-emerald-300/80 bg-gradient-to-b from-emerald-400 to-emerald-700 px-3 py-1.5 font-serif text-[11px] font-bold uppercase tracking-widest text-white shadow disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {claimed
                      ? `+${formatChips(DAILY_AMOUNT)}`
                      : busy
                        ? "Claiming…"
                        : "Claim"}
                  </button>
                ) : (
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-ivory/50">
                      Next in
                    </p>
                    <p className="font-mono text-sm font-bold tabular-nums text-gold-soft">
                      {dailyLabel}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Hourly spin shortcut */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSpin();
              }}
              className="group flex items-center gap-3 rounded-2xl border-2 border-amber-300/70 bg-gradient-to-br from-amber-700/30 via-wood-dark to-black px-4 py-3 text-left shadow-md transition hover:-translate-y-0.5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-800 text-wood-dark shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-serif text-sm font-bold tracking-tight text-ivory-soft">
                  Hourly chip wheel
                </p>
                <p className="text-[11px] text-ivory/65">
                  Spin to win up to {formatChips(10_000_000)}
                </p>
              </div>
              <span className="rounded-md border-2 border-amber-300/60 bg-gradient-to-b from-amber-300 to-amber-600 px-3 py-1.5 font-serif text-[11px] font-bold uppercase tracking-widest text-wood-dark">
                Spin
              </span>
            </button>

            {/* Future packages teaser */}
            <div className="rounded-2xl border border-gold/20 bg-black/40 px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ivory/55">
                Chip packages
              </p>
              <p className="mt-0.5 text-xs text-ivory/55">
                More top-up options coming soon
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-400/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
