"use client";

import { useCallback, useRef } from "react";

import { getSupabase } from "@/lib/supabase";
import type { GamePhase } from "@/lib/poker";

/**
 * Calls advance_phase when the street timer expires. Uses a ref guard so
 * multiple clients don't spam the RPC — only the first successful call wins.
 */
export function usePhaseAdvance(roomId: string, phase: GamePhase) {
  const advancingRef = useRef(false);

  const advance = useCallback(async () => {
    if (phase === "waiting") return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    try {
      const supabase = getSupabase();
      const { error } = await supabase.rpc("advance_phase", {
        p_room_id: roomId,
      });
      if (error) {
        // Timer race: another client may have advanced first.
        if (!error.message.includes("timer has not expired")) {
          console.warn("advance_phase:", error.message);
        }
      }
    } finally {
      window.setTimeout(() => {
        advancingRef.current = false;
      }, 2000);
    }
  }, [roomId, phase]);

  return advance;
}
