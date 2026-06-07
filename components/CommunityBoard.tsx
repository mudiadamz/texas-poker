"use client";

import type { GamePhase } from "@/lib/poker";
import { communityCount } from "@/lib/poker";
import { Card } from "./Card";

type Props = {
  phase: GamePhase;
  communityCards: string[];
  /** Card size — smaller on the compact mobile/portrait table. */
  size?: "xs" | "sm" | "md" | "lg";
};

export function CommunityBoard({ phase, communityCards, size = "md" }: Props) {
  const visible = communityCount(phase);
  const slots = 5;

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2">
      {Array.from({ length: slots }).map((_, i) => {
        const code = i < visible ? communityCards[i] ?? null : null;
        const faceUp = code !== null && code !== undefined;
        return <Card key={i} code={code} faceUp={faceUp} size={size} />;
      })}
    </div>
  );
}
