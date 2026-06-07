"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Coins, Sparkles, X } from "lucide-react";

import { formatChips } from "@/lib/stakes";
import { getSupabase } from "@/lib/supabase";

type Props = {
  /** How many free spins the user has left (0..3). */
  spinsRemaining: number;
  /** ISO timestamp when the next refill of 3 spins kicks in
      (only set after the player burns through all 3). */
  nextRefillAt: string | null;
  /** Fired when a spin completes so the lobby can refresh its UI. */
  onSpun?: (prize: number) => void;
  onClose: () => void;
};

const PRIZES = [
  50_000,
  100_000,
  250_000,
  500_000,
  1_000_000,
  2_000_000,
  5_000_000,
  10_000_000,
];

// Distinct hue per wedge so each prize is instantly recognisable.
const WEDGE_COLORS = [
  "#059669", // emerald — 50K
  "#0891b2", // cyan — 100K
  "#2563eb", // blue — 250K
  "#7c3aed", // violet — 500K
  "#c026d3", // fuchsia — 1M
  "#e11d48", // rose — 2M
  "#ea580c", // orange — 5M
  "#facc15", // gold — 10M jackpot
];

const VIEW = 400;
const CENTER = VIEW / 2;
const RADIUS = 175;
const SEG = 360 / PRIZES.length;

function wedgePath(i: number): string {
  // Each wedge starts at 12 o'clock (top) and sweeps clockwise.
  const start = (i * SEG - 90) * (Math.PI / 180);
  const end = ((i + 1) * SEG - 90) * (Math.PI / 180);
  const x1 = CENTER + RADIUS * Math.cos(start);
  const y1 = CENTER + RADIUS * Math.sin(start);
  const x2 = CENTER + RADIUS * Math.cos(end);
  const y2 = CENTER + RADIUS * Math.sin(end);
  return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2} Z`;
}

function wedgeLabelXY(i: number): { x: number; y: number; angle: number } {
  // Center of wedge i, expressed as degrees clockwise from 12 o'clock.
  const angleDeg = i * SEG + SEG / 2;
  const angleRad = (angleDeg - 90) * (Math.PI / 180);
  const r = RADIUS * 0.62;
  return {
    x: CENTER + r * Math.cos(angleRad),
    y: CENTER + r * Math.sin(angleRad),
    angle: angleDeg,
  };
}

export function SpinWheelModal({
  spinsRemaining,
  nextRefillAt,
  onSpun,
  onClose,
}: Props) {
  const refillAt = useMemo(() => {
    if (!nextRefillAt) return 0;
    return new Date(nextRefillAt).getTime();
  }, [nextRefillAt]);

  const [now, setNow] = useState(() => Date.now());
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mirror server-provided remaining count; we optimistically
  // decrement the local copy so the bars update on each spin even if
  // the realtime profile update lags behind.
  const [localRemaining, setLocalRemaining] = useState(spinsRemaining);
  useEffect(() => {
    setLocalRemaining(spinsRemaining);
  }, [spinsRemaining]);

  // Imperative wheel rotation. We track the cumulative angle in a ref
  // and animate the DOM element directly with the Web Animations API
  // — this sidesteps the React render + CSS transition race where the
  // transition style and the new rotation could land in the same DOM
  // commit, which made the wheel snap to the final angle without any
  // visible spin (so it always *looked* like it landed on wedge 0).
  const wheelRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Ready when the user has spins left, OR when the refill window has
  // elapsed (server lazy-refills on the next call so we let them try).
  const refillElapsed = refillAt > 0 && now >= refillAt;
  const ready = localRemaining > 0 || refillElapsed;

  const handleSpin = async () => {
    if (!ready || spinning) return;
    setSpinning(true);
    setError(null);
    setResult(null);
    try {
      const supabase = getSupabase();
      const { data, error: rpcErr } = await supabase
        .rpc("spin_wheel")
        .single();
      if (rpcErr) throw rpcErr;
      const row = data as {
        prize: number;
        segment_index: number;
        spins_remaining: number;
        next_refill_at: string | null;
      } | null;
      if (!row) throw new Error("Spin failed.");

      // Compute target rotation: bring wedge `segment_index` under the
      // top pointer. Wedge i's center sits at (i*SEG + SEG/2) degrees
      // CW from 12 o'clock; we rotate the wheel by 4 full turns plus
      // the delta needed to align that center with the pointer.
      const current = rotationRef.current;
      const targetAngle = 5 * 360 - (row.segment_index * SEG + SEG / 2);
      const delta = ((targetAngle - (current % 360)) + 360) % 360;
      const next = current + delta + 4 * 360;
      rotationRef.current = next;
      setLocalRemaining(row.spins_remaining);

      const el = wheelRef.current;
      if (el) {
        el.animate(
          [
            { transform: `rotate(${current}deg)` },
            { transform: `rotate(${next}deg)` },
          ],
          {
            duration: 4200,
            easing: "cubic-bezier(0.18, 0.85, 0.18, 1)",
            fill: "forwards",
          },
        );
        // Keep the inline style in sync so re-renders don't snap the
        // wheel back to the previous angle once the animation ends.
        el.style.transform = `rotate(${next}deg)`;
      }

      window.setTimeout(() => {
        setResult(row.prize);
        setSpinning(false);
        onSpun?.(row.prize);
      }, 4200);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Spin failed.");
      setSpinning(false);
    }
  };

  const cooldownLabel = useMemo(() => {
    if (refillAt === 0) return null;
    const remainingMs = Math.max(0, refillAt - now);
    if (remainingMs === 0) return null;
    const totalSec = Math.ceil(remainingMs / 1000);
    const m = Math.floor(totalSec / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [refillAt, now]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spin-wheel-title"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={spinning ? undefined : onClose}
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-gold/70 bg-gradient-to-br from-amber-700/30 via-wood-dark to-black shadow-[0_0_60px_rgba(212,175,55,0.35),0_25px_60px_-15px_rgba(0,0,0,0.7)]">
        <button
          type="button"
          onClick={onClose}
          disabled={spinning}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full p-1 text-ivory/50 transition hover:bg-white/10 hover:text-ivory-soft disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>

        {result !== null && (
          <WinCelebration amount={result} onCollect={() => setResult(null)} />
        )}

        <div className="relative px-5 pt-6 pb-6 text-center sm:px-7 sm:pt-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-gold-soft">
            Hourly bonus
          </p>
          <h2
            id="spin-wheel-title"
            className="mt-1 font-serif text-2xl font-bold tracking-tight text-ivory-soft sm:text-3xl"
          >
            Spin the chip wheel
          </h2>
          <p className="mt-1 text-xs text-ivory/65 sm:text-sm">
            3 free spins per hour. Land on the gold wedge for the 10M
            jackpot.
          </p>

          {/* Wheel */}
          <div className="relative mx-auto mt-5 aspect-square w-full max-w-[320px]">
            {/* Pointer at the top */}
            <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1">
              <div
                className="h-0 w-0 border-x-[12px] border-t-[18px] border-x-transparent border-t-gold drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
                style={{ filter: "drop-shadow(0 0 4px rgba(212,175,55,0.7))" }}
              />
            </div>

            {/* Outer rim with gold dots */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at center, transparent 78%, #d4af37 78%, #6b4a1a 82%, #d4af37 86%, #2a1a0d 90%)",
                boxShadow:
                  "0 10px 30px -10px rgba(0,0,0,0.7), inset 0 0 18px rgba(0,0,0,0.55)",
              }}
              aria-hidden
            />

            <div
              ref={wheelRef}
              className="absolute inset-0"
              style={{
                transformOrigin: "50% 50%",
                willChange: "transform",
              }}
            >
              <svg
                viewBox={`0 0 ${VIEW} ${VIEW}`}
                className="h-full w-full"
              >
                <g>
                  {PRIZES.map((p, i) => {
                    const label = wedgeLabelXY(i);
                    return (
                      <g key={i}>
                        <path
                          d={wedgePath(i)}
                          fill={WEDGE_COLORS[i]}
                          stroke="rgba(0,0,0,0.4)"
                          strokeWidth="2"
                        />
                        <text
                          x={label.x}
                          y={label.y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="22"
                          fontWeight="800"
                          fill="#fff"
                          style={{
                            fontFamily: "ui-monospace, Menlo, monospace",
                            paintOrder: "stroke",
                            stroke: "rgba(0,0,0,0.45)",
                            strokeWidth: 3,
                          }}
                          transform={`rotate(${label.angle} ${label.x} ${label.y})`}
                        >
                          {formatChips(p)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>

            {/* Static hub: lives outside the rotating div so it doesn't
                inherit the spin (also avoids any sub-pixel jitter on the
                center while the wheel is in motion). */}
            <svg
              viewBox={`0 0 ${VIEW} ${VIEW}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <circle
                cx={CENTER}
                cy={CENTER}
                r={28}
                fill="url(#hub)"
                stroke="#d4af37"
                strokeWidth="3"
              />
              <defs>
                <radialGradient id="hub" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="60%" stopColor="#b8860b" />
                  <stop offset="100%" stopColor="#3b2410" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-red-400/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </p>
          )}

          <div className="mt-5">
            {ready ? (
              <button
                type="button"
                onClick={handleSpin}
                disabled={spinning}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gold/60 bg-gradient-to-b from-emerald-400 to-emerald-700 px-5 py-3 font-serif text-sm font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_6px_18px_rgba(0,0,0,0.4)] transition hover:from-emerald-300 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Coins className="h-4 w-4" />
                {spinning ? "Spinning…" : "Spin"}
              </button>
            ) : (
              <div className="rounded-xl border border-gold/30 bg-black/50 px-4 py-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ivory/60">
                  Next 3 spins in
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-gold-soft">
                  {cooldownLabel}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Count from 0 up to `target` over `durationMs` (ease-out cubic). */
function useCountUp(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

// Pre-computed coin particle fan: horizontal drift + rotation + timing
// jitter so the burst feels organic rather than mechanical.
const COIN_PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const spread = (i / 13) * 2 - 1; // -1 .. 1
  return {
    left: 50 + spread * 42, // % across the card
    dx: `${Math.round(spread * 40)}px`,
    rot: `${(i % 2 === 0 ? 1 : -1) * (180 + (i % 5) * 90)}deg`,
    dur: `${1.3 + (i % 4) * 0.25}s`,
    delay: `${(i % 7) * 0.06}s`,
    size: 14 + (i % 3) * 6,
  };
});

/**
 * Full-card celebration overlay shown when a spin lands. A pulsing
 * halo, a fan of rising coins, and the won amount counting up with a
 * springy pop — then a Collect button to dismiss.
 */
function WinCelebration({
  amount,
  onCollect,
}: {
  amount: number;
  onCollect: () => void;
}) {
  const display = useCountUp(amount, 1000);
  const jackpot = amount >= 5_000_000;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center overflow-hidden rounded-3xl bg-black/80 px-6 text-center backdrop-blur-sm">
      {/* Pulsing gold halo */}
      <div
        className="animate-win-halo pointer-events-none absolute h-72 w-72 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(245,200,90,0.55) 0%, rgba(245,200,90,0) 68%)",
        }}
        aria-hidden
      />

      {/* Rising coin particles */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {COIN_PARTICLES.map((c, i) => (
          <span
            key={i}
            className="animate-coin-burst absolute top-1/2 flex items-center justify-center text-amber-300"
            style={
              {
                left: `${c.left}%`,
                "--dx": c.dx,
                "--rot": c.rot,
                "--dur": c.dur,
                "--delay": c.delay,
              } as React.CSSProperties
            }
          >
            <Coins style={{ width: c.size, height: c.size }} />
          </span>
        ))}
      </div>

      <div className="animate-win-banner relative flex items-center gap-2 text-gold-soft">
        <Sparkles className="h-4 w-4" />
        <span className="font-serif text-sm font-bold uppercase tracking-[0.3em]">
          {jackpot ? "Jackpot!" : "You won"}
        </span>
        <Sparkles className="h-4 w-4" />
      </div>

      <div
        className="animate-win-amount relative mt-3 font-mono text-5xl font-extrabold tabular-nums text-transparent sm:text-6xl"
        style={{
          backgroundImage:
            "linear-gradient(180deg, #fff4cf 0%, #f5d76e 45%, #d4af37 70%, #9a7a1f 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          filter: "drop-shadow(0 3px 10px rgba(212,175,55,0.5))",
        }}
        title={amount.toLocaleString()}
      >
        {formatChips(display)}
      </div>
      <p className="relative mt-1 text-xs font-medium uppercase tracking-widest text-ivory/60">
        chips added to your balance
      </p>

      <button
        type="button"
        onClick={onCollect}
        className="animate-win-banner relative mt-7 inline-flex items-center gap-2 rounded-xl border-2 border-gold/60 bg-gradient-to-b from-amber-300 to-amber-600 px-8 py-3 font-serif text-sm font-bold uppercase tracking-widest text-wood-dark shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_22px_-6px_rgba(245,158,11,0.7)] transition hover:from-amber-200 hover:to-amber-500"
      >
        <Coins className="h-4 w-4" />
        Collect
      </button>
    </div>
  );
}
