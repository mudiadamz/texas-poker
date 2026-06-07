"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Minus, Plus, X, Zap } from "lucide-react";

import { cn } from "@/lib/cn";
import {
  callAmount,
  canCall,
  canCheck,
  isMyTurn,
  minRaiseTotal,
  type PlayerAction,
} from "@/lib/betting";
import { formatChips } from "@/lib/stakes";
import type { Player, Room } from "@/lib/types";

type Props = {
  room: Room;
  me: Player;
  busy: boolean;
  onAction: (action: PlayerAction, raiseTo?: number) => void;
};

type ArmedAction = "fold" | "check_fold" | null;

function computePresets(
  room: Room,
  minRaise: number,
  maxRaise: number,
): Array<{ label: string; value: number }> {
  const big = room.big_blind;
  const candidates: Array<{ label: string; value: number }> = [
    { label: "Min", value: minRaise },
    { label: "2×", value: Math.max(2 * room.current_bet, minRaise, 2 * big) },
    { label: "3×", value: Math.max(3 * room.current_bet, minRaise, 3 * big) },
    { label: "Pot", value: Math.max(room.pot + room.current_bet, minRaise) },
  ];
  const seen = new Set<number>();
  const out: Array<{ label: string; value: number }> = [];
  for (const c of candidates) {
    const v = Math.min(c.value, maxRaise);
    if (v < minRaise) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push({ label: c.label, value: v });
  }
  return out;
}

/**
 * Bottom action bar. Always pinned at the viewport bottom whenever
 * the seat is in-hand. The same set of buttons is shown regardless
 * of whose turn it is — buttons only execute their action when it's
 * actually the local player's turn. While waiting, the Fold and
 * Check/Fold buttons act as pre-action toggles instead of being
 * disabled, so the player can pre-arm "auto-fold" or "auto-check
 * (or fold to a raise)" before the action loops back around.
 */
export function BettingControls({ room, me, busy, onAction }: Props) {
  const myTurn = isMyTurn(room, me.id);
  const minRaise = minRaiseTotal(room);
  const maxRaise = me.bet_street + me.chips;
  const toCall = callAmount(me, room);
  const checkable = canCheck(me, room);
  const callable = canCall(me, room);

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseTo, setRaiseTo] = useState(() =>
    Math.max(minRaise, Math.min(minRaise, maxRaise)),
  );

  // Pre-action arming. Fires once when the action lands on this seat.
  const [armed, setArmed] = useState<ArmedAction>(null);
  const firedRef = useRef(false);

  // Reset the latch whenever the turn moves away so a fresh pre-arm
  // can fire on the next loop around the table.
  useEffect(() => {
    if (!myTurn) firedRef.current = false;
  }, [myTurn]);

  // Fire the pre-armed action exactly once when the action arrives.
  useEffect(() => {
    if (!myTurn) return;
    if (!armed) return;
    if (firedRef.current) return;
    firedRef.current = true;
    if (armed === "fold") {
      onAction("fold");
    } else if (armed === "check_fold") {
      if (toCall <= 0) onAction("check");
      else onAction("fold");
    }
    setArmed(null);
  }, [myTurn, armed, toCall, onAction]);

  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Clamp the raise-to amount against the live valid range.
  useEffect(() => {
    setRaiseTo((prev) => {
      const next = Math.max(minRaise, Math.min(prev, maxRaise));
      return Number.isFinite(next) ? next : minRaise;
    });
  }, [minRaise, maxRaise]);

  // Click-outside / Escape closes the raise popover.
  useEffect(() => {
    if (!raiseOpen) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setRaiseOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setRaiseOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [raiseOpen]);

  // Auto-close popover on turn end so it doesn't linger.
  useEffect(() => {
    if (!myTurn) setRaiseOpen(false);
  }, [myTurn]);

  const presets = useMemo(
    () => computePresets(room, minRaise, maxRaise),
    [room, minRaise, maxRaise],
  );

  const twoX = useMemo(() => {
    const raw = Math.max(
      2 * room.current_bet,
      minRaise,
      2 * room.big_blind,
    );
    const v = Math.min(raw, maxRaise);
    return v >= minRaise ? v : null;
  }, [room.current_bet, room.big_blind, minRaise, maxRaise]);

  const canRaiseNow = me.chips > 0 && raiseTo >= minRaise && raiseTo <= maxRaise;

  function fireRaise(value: number) {
    const clamped = Math.max(minRaise, Math.min(value, maxRaise));
    onAction("raise", clamped);
    setRaiseOpen(false);
  }

  // Button click handlers. On-turn, fire the action immediately. While
  // waiting, Fold and the combined Check/Fold button act as pre-arm
  // toggles instead.
  const onFoldClick = () => {
    if (myTurn) onAction("fold");
    else setArmed((v) => (v === "fold" ? null : "fold"));
  };
  const onCheckCallClick = () => {
    if (myTurn) {
      if (checkable) onAction("check");
      else onAction("call");
    } else {
      setArmed((v) => (v === "check_fold" ? null : "check_fold"));
    }
  };

  const checkCallLabel = myTurn
    ? checkable
      ? "Check"
      : `Call ${formatChips(toCall)}`
    : "Check / Fold";

  const turnButtonsDisabled = !myTurn || busy;

  return (
    <div className="wood fixed inset-x-0 bottom-0 z-40 border-t-2 border-gold/60 px-2 py-2 shadow-[inset_0_2px_0_rgba(212,175,55,0.25),0_-10px_24px_-10px_rgba(0,0,0,0.55)] sm:px-6 sm:py-3">
      <div className="mx-auto flex max-w-2xl items-stretch justify-center gap-1 sm:gap-2">
        <ActionBtn
          label="Fold"
          variant="danger"
          disabled={busy && myTurn}
          armed={!myTurn && armed === "fold"}
          onClick={onFoldClick}
        />

        <ActionBtn
          label={myTurn ? checkCallLabel : "Check/Fold"}
          disabled={busy && myTurn || (myTurn && !checkable && !callable)}
          armed={!myTurn && armed === "check_fold"}
          onClick={onCheckCallClick}
        />

        {twoX !== null && (
          <ActionBtn
            label={`2× ${formatChips(twoX)}`}
            variant="gold-secondary"
            icon={<Zap className="h-3 w-3" strokeWidth={2.5} />}
            disabled={turnButtonsDisabled || me.chips <= 0}
            onClick={() => onAction("raise", twoX)}
          />
        )}

        <div ref={wrapRef} className="relative flex min-w-0 flex-1">
          <ActionBtn
            label="Raise"
            variant="gold"
            disabled={turnButtonsDisabled || me.chips <= 0 || maxRaise < minRaise}
            onClick={() => setRaiseOpen((v) => !v)}
            active={raiseOpen}
          />

          {raiseOpen && (
            <div
              role="dialog"
              aria-label="Raise amount"
              className="animate-pop absolute bottom-full right-1/2 z-50 mb-2 w-[min(20rem,calc(100vw-1.5rem))] translate-x-1/2 overflow-hidden rounded-xl border-2 border-gold/60 bg-wood-dark/95 shadow-2xl ring-1 ring-gold/30 backdrop-blur"
            >
              <div className="flex items-center justify-between border-b border-gold/30 bg-gold/10 px-3 py-1.5">
                <span className="font-serif text-[11px] font-bold uppercase tracking-wider text-gold-soft">
                  Raise to
                </span>
                <button
                  type="button"
                  onClick={() => setRaiseOpen(false)}
                  className="rounded p-0.5 text-ivory-dim transition hover:bg-wood/60 hover:text-ivory-soft"
                  aria-label="Close"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-2 px-3 py-2">
                <div className="flex items-center gap-1 rounded-lg border border-gold/40 bg-felt-dark/70 px-1.5 py-1">
                  <button
                    type="button"
                    onClick={() =>
                      setRaiseTo((v) =>
                        Math.max(minRaise, v - room.big_blind),
                      )
                    }
                    className="rounded p-1 text-gold-soft transition hover:bg-gold/15 disabled:opacity-40"
                    disabled={raiseTo <= minRaise}
                    aria-label="Decrease"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    value={raiseTo}
                    min={minRaise}
                    max={maxRaise}
                    onChange={(e) => setRaiseTo(Number(e.target.value))}
                    className="flex-1 bg-transparent px-1 text-center font-mono text-base font-bold tabular-nums text-ivory outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRaiseTo((v) =>
                        Math.min(maxRaise, v + room.big_blind),
                      )
                    }
                    className="rounded p-1 text-gold-soft transition hover:bg-gold/15 disabled:opacity-40"
                    disabled={raiseTo >= maxRaise}
                    aria-label="Increase"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  {presets.map((p) => {
                    const active = raiseTo === p.value;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => fireRaise(p.value)}
                        disabled={busy}
                        className={cn(
                          "inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 font-mono text-[11px] font-bold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-50",
                          active
                            ? "border-gold bg-gold/20 text-gold-soft"
                            : "border-gold/40 bg-wood-dark/70 text-ivory hover:border-gold hover:text-gold-soft",
                        )}
                        title={`Raise to ${p.value.toLocaleString()}`}
                      >
                        <span className="font-serif text-[9px] uppercase tracking-wider opacity-80">
                          {p.label}
                        </span>
                        {formatChips(p.value)}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => fireRaise(raiseTo)}
                  disabled={!canRaiseNow || busy}
                  className="brass-button w-full rounded-lg py-1.5 font-serif text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50"
                  title={raiseTo.toLocaleString()}
                >
                  Raise {formatChips(raiseTo)}
                </button>
              </div>
            </div>
          )}
        </div>

        <ActionBtn
          label="All-in"
          variant="gold"
          disabled={turnButtonsDisabled || me.chips <= 0}
          onClick={() => onAction("all_in")}
        />
      </div>
    </div>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  variant = "default",
  active = false,
  armed = false,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "gold" | "gold-secondary" | "danger";
  active?: boolean;
  armed?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 min-w-0 items-center justify-center gap-1 rounded-lg px-1 py-2 font-serif text-[10px] font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:text-sm sm:tracking-wider",
        variant === "gold" && "brass-button",
        variant === "gold-secondary" &&
          "border-2 border-amber-300/70 bg-gradient-to-b from-amber-400/30 via-wood-dark to-wood-dark text-gold-soft shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:border-amber-300 hover:from-amber-400/40",
        variant === "danger" &&
          "border border-red-400/60 bg-red-950/60 text-red-200 hover:bg-red-900/80",
        variant === "default" &&
          "border border-gold/40 bg-wood-dark/80 text-ivory hover:border-gold hover:text-gold-soft",
        active && "ring-2 ring-gold/60",
        armed && "ring-2 ring-emerald-400/70 brightness-110",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
