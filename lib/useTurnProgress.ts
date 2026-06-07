"use client";

import { useEffect, useRef, useState } from "react";

export type TurnProgress = { progress: number; seconds: number };

/**
 * Drives a 0..1 progress value (with the matching whole seconds left)
 * for a turn timer. `onExpired` fires exactly once when the timer
 * hits zero. Returns `null` when there is no active timer so the
 * caller can render nothing instead of a 0% ring.
 */
export function useTurnProgress(
  endsAt: string | null,
  totalSec: number,
  onExpired?: () => void,
): TurnProgress | null {
  const [state, setState] = useState<TurnProgress | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    if (!endsAt) {
      setState(null);
      return;
    }
    const end = new Date(endsAt).getTime();

    function tick() {
      const remainingMs = end - Date.now();
      if (remainingMs <= 0) {
        setState({ progress: 0, seconds: 0 });
        if (!firedRef.current) {
          firedRef.current = true;
          onExpired?.();
        }
        return;
      }
      const progress = Math.min(1, remainingMs / (totalSec * 1000));
      const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
      setState({ progress, seconds });
    }

    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [endsAt, totalSec, onExpired]);

  return state;
}
