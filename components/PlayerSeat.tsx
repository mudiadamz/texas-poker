"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { ACTION_TIMEOUT_SEC } from "@/lib/betting";
import { cn } from "@/lib/cn";
import type { GamePhase } from "@/lib/poker";
import { formatChips } from "@/lib/stakes";
import type { Player } from "@/lib/types";
import { useTurnProgress } from "@/lib/useTurnProgress";

type Props = {
  player: Player;
  phase: GamePhase;
  isMe?: boolean;
  isDealer?: boolean;
  isActing?: boolean;
  smallBlindId?: string | null;
  bigBlindId?: string | null;
  phaseEndsAt?: string | null;
  /** Total duration of an action turn, used to scale the timer ring. */
  actionTimeoutSec?: number;
  onTurnExpired?: () => void;
};

type TopTone =
  | "name"
  | "me"
  | "fold"
  | "all_in"
  | "blind"
  | "bust"
  | "waiting"
  | "call"
  | "check"
  | "raise";

type TopLabel = { text: string; tone: TopTone };

function isBust(player: Player): boolean {
  return player.chips === 0 && !player.all_in && !player.folded;
}

/**
 * Player who joined mid-hand: they have chips but no hole cards in the
 * current deal, so they sit out this round and wait for the next.
 */
function isWaitingForNextHand(player: Player, phase: GamePhase): boolean {
  if (phase === "waiting") return false;
  if (player.chips <= 0) return false;
  if (player.folded || player.all_in) return false;
  return !Array.isArray(player.hole_cards) || player.hole_cards.length === 0;
}

/**
 * What the top bar of the seat card shows. Action/state labels take
 * over the bar (like a casino seat readout); otherwise it shows the
 * player's name.
 */
function deriveTopLabel(
  player: Player,
  phase: GamePhase,
  isMe: boolean,
  smallBlindId?: string | null,
  bigBlindId?: string | null,
): TopLabel {
  if (isBust(player)) return { text: "Bust", tone: "bust" };
  if (isWaitingForNextHand(player, phase))
    return { text: "Waiting", tone: "waiting" };
  if (player.folded) return { text: "Fold", tone: "fold" };
  if (player.all_in) {
    return {
      text:
        player.last_action_amount > 0
          ? `All-in ${formatChips(player.last_action_amount)}`
          : "All-in",
      tone: "all_in",
    };
  }
  if (player.last_action === "call") {
    return {
      text:
        player.last_action_amount > 0
          ? `Call ${formatChips(player.last_action_amount)}`
          : "Call",
      tone: "call",
    };
  }
  if (player.last_action === "raise") {
    return {
      text:
        player.last_action_amount > 0
          ? `Raise ${formatChips(player.last_action_amount)}`
          : "Raise",
      tone: "raise",
    };
  }
  if (player.last_action === "check") return { text: "Check", tone: "check" };
  if (phase === "preflop") {
    if (player.id === smallBlindId)
      return { text: `${player.name} · SB`, tone: "blind" };
    if (player.id === bigBlindId)
      return { text: `${player.name} · BB`, tone: "blind" };
  }
  return { text: player.name, tone: isMe ? "me" : "name" };
}

const TOP_TONE_CLASS: Record<TopTone, string> = {
  name: "bg-slate-900/95 text-ivory",
  me: "bg-gradient-to-b from-gold/40 to-wood-dark text-gold-soft",
  fold: "bg-red-950/95 text-red-200",
  all_in: "bg-amber-600 text-wood-dark",
  blind: "bg-slate-900/95 text-gold-soft",
  bust: "bg-slate-800/95 text-ivory/50",
  waiting: "bg-sky-800 text-sky-100",
  call: "bg-emerald-600 text-white",
  check: "bg-amber-400 text-wood-dark",
  raise: "bg-fuchsia-600 text-white",
};

/** Timer stage → ring colour. Stays green until time runs short. */
function stageColor(p: number): string {
  if (p > 0.5) return "#22c55e"; // green
  if (p > 0.25) return "#eab308"; // amber
  return "#ef4444"; // red
}

export function PlayerSeat({
  player,
  phase,
  isMe,
  isDealer,
  isActing,
  smallBlindId,
  bigBlindId,
  phaseEndsAt,
  actionTimeoutSec,
  onTurnExpired,
}: Props) {
  const bust = isBust(player);
  const waiting = isWaitingForNextHand(player, phase);
  const dimmed = player.folded || bust || waiting;
  const top = deriveTopLabel(player, phase, !!isMe, smallBlindId, bigBlindId);

  const showRing =
    !!isActing &&
    phase !== "waiting" &&
    phase !== "showdown" &&
    !player.folded &&
    !bust &&
    !waiting;

  const tick = useTurnProgress(
    showRing ? (phaseEndsAt ?? null) : null,
    actionTimeoutSec ?? ACTION_TIMEOUT_SEC,
    onTurnExpired,
  );

  const progress = showRing ? (tick?.progress ?? 1) : null;
  const ringColor = progress !== null ? stageColor(progress) : "#22c55e";

  return (
    <div
      data-player-id={player.id}
      className={cn(
        "relative w-[2.75rem] select-none sm:w-[6rem]",
        dimmed && "opacity-55",
      )}
      title={player.name}
    >
      <div
        className={cn(
          "overflow-hidden rounded-lg border-2 shadow-[0_4px_10px_-3px_rgba(0,0,0,0.6)] transition",
          showRing
            ? "border-transparent"
            : isMe
              ? "border-gold/70"
              : "border-slate-900/80",
        )}
        style={
          showRing
            ? {
                borderColor: ringColor,
                boxShadow: `0 0 0 1px ${ringColor}, 0 0 12px ${ringColor}aa, 0 4px 10px -3px rgba(0,0,0,0.6)`,
              }
            : undefined
        }
      >
        {/* Top bar — name or action readout */}
        <div
          className={cn(
            "truncate px-1 py-0.5 text-center font-serif text-[7px] font-bold uppercase leading-tight tracking-wide sm:px-1.5 sm:py-1 sm:text-[11px]",
            TOP_TONE_CLASS[top.tone],
          )}
        >
          {top.text}
        </div>

        {/* Photo / initials body */}
        <SeatPhoto
          name={player.name}
          avatarUrl={player.avatar_url}
          dim={dimmed}
        />

        {/* Bottom bar — chip stack */}
        <div className="bg-slate-900/95 px-1 py-0.5 text-center sm:py-1">
          <span
            className="font-mono text-[7px] font-bold tabular-nums text-gold-soft sm:text-[11px]"
            title={player.chips.toLocaleString()}
          >
            {formatChips(player.chips)}
          </span>
        </div>
      </div>

      {/* Dealer button chip */}
      {isDealer && (
        <span
          className="absolute -left-1.5 -top-1.5 z-10 flex h-4 w-4 items-center justify-center rounded-full border border-wood-dark bg-ivory text-[8px] font-bold text-wood-dark shadow sm:h-6 sm:w-6 sm:text-xs"
          title="Dealer button"
        >
          D
        </span>
      )}

      {/* Seconds-left pip while acting */}
      {showRing && typeof tick?.seconds === "number" && (
        <span
          className="absolute -bottom-1.5 left-1/2 z-10 -translate-x-1/2 rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold tabular-nums text-white shadow sm:text-[10px]"
          style={{ backgroundColor: ringColor }}
        >
          {tick.seconds}s
        </span>
      )}
    </div>
  );
}

function SeatPhoto({
  name,
  avatarUrl,
  dim,
}: {
  name: string;
  avatarUrl: string | null;
  dim?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);
  const useImage = !!avatarUrl && !failed;
  const { from, to } = pickPalette(name);

  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full",
        dim && "grayscale",
      )}
      style={
        useImage
          ? { backgroundColor: "#0f172a" }
          : {
              backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
            }
      }
    >
      {useImage ? (
        <Image
          src={avatarUrl!}
          alt={name}
          fill
          sizes="96px"
          className="object-cover object-top"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          unoptimized
        />
      ) : (
        <span           className="absolute inset-0 flex items-center justify-center font-serif text-base font-bold text-ivory drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] sm:text-3xl">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}

const PALETTE: Array<{ from: string; to: string }> = [
  { from: "#ef4444", to: "#b91c1c" },
  { from: "#f97316", to: "#c2410c" },
  { from: "#eab308", to: "#a16207" },
  { from: "#84cc16", to: "#3f6212" },
  { from: "#22c55e", to: "#15803d" },
  { from: "#10b981", to: "#047857" },
  { from: "#06b6d4", to: "#0e7490" },
  { from: "#3b82f6", to: "#1d4ed8" },
  { from: "#6366f1", to: "#4338ca" },
  { from: "#8b5cf6", to: "#6d28d9" },
  { from: "#ec4899", to: "#9f1239" },
  { from: "#f43f5e", to: "#9f1239" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickPalette(name: string): { from: string; to: string } {
  return PALETTE[hashString(name) % PALETTE.length];
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
