"use client";

import type { GamePhase } from "@/lib/poker";
import type { Player } from "@/lib/types";
import { Card } from "./Card";

type Props = {
  player: Player;
  phase: GamePhase;
  isMe?: boolean;
};

/**
 * The two hole cards as they sit on the felt in front of each seat.
 * Cards stay compact while face-down (clutter-free during play) and
 * grow to medium size when they flip up — either for the local player
 * at all times, or for everyone at showdown.
 */
export function PlayerHand({ player, phase, isMe }: Props) {
  const holeCards = Array.isArray(player.hole_cards) ? player.hole_cards : [];
  if (phase === "waiting") return null;
  if (player.folded) return null;

  // Self always sees their own cards; opponents flip up only at showdown.
  const showHole = phase === "showdown" || !!isMe;
  // Keep the hole cards compact so they sit on the felt without
  // covering the seat card's name/chip bars. Face-up (self / showdown)
  // gets a small bump up from the face-down `xs`.
  const size = showHole ? "sm" : "xs";

  if (holeCards.length !== 2) {
    return (
      <div className="flex items-center gap-0.5">
        <Card code={null} faceUp={false} size={size} />
        <Card code={null} faceUp={false} size={size} />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-0.5">
      <Card code={holeCards[0] ?? null} faceUp={showHole} size={size} />
      <Card code={holeCards[1] ?? null} faceUp={showHole} size={size} />
    </div>
  );
}
