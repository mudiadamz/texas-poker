"use client";

import { useCallback, useEffect, useRef } from "react";

import type { GamePhase } from "@/lib/poker";
import type { WinnerInfo } from "@/lib/types";

export function useShowdown(
  roomId: string,
  phase: GamePhase,
  winners: WinnerInfo[] | null,
) {
  const resolvingRef = useRef(false);

  const resolve = useCallback(async () => {
    if (resolvingRef.current) return;
    if (phase !== "showdown" || (winners && winners.length > 0)) return;
    resolvingRef.current = true;
    try {
      await fetch(`/api/room/${roomId}/resolve`, { method: "POST" });
    } catch (e) {
      console.warn("showdown resolve failed", e);
    } finally {
      window.setTimeout(() => {
        resolvingRef.current = false;
      }, 3000);
    }
  }, [roomId, phase, winners]);

  useEffect(() => {
    if (phase === "showdown" && (!winners || winners.length === 0)) {
      void resolve();
    }
  }, [phase, winners, resolve]);
}
