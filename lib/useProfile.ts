"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getSupabase } from "@/lib/supabase";

export type Profile = {
  user_id: string;
  chips: number;
  is_admin: boolean;
  spins_remaining: number;
  next_spin_refill_at: string | null;
  welcome_claimed_at: string | null;
  last_spin_at: string | null;
  last_daily_at: string | null;
  updated_at: string;
};

export type UseProfile = {
  profile: Profile | null;
  /** Force a fresh read — useful after RPCs in case realtime is laggy. */
  refetch: () => Promise<void>;
};

/**
 * Live read of the signed-in user's main bankroll. Subscribes to
 * realtime updates so chip deltas (table buy-ins, cash-outs) reflect
 * across tabs without a refresh, and exposes a manual `refetch` so
 * callers can force a re-read after RPCs that mutate the profile —
 * a useful fallback when realtime delivery is flaky.
 */
export function useProfile(userId: string | null | undefined): UseProfile {
  const [profile, setProfile] = useState<Profile | null>(null);
  const userIdRef = useRef<string | null | undefined>(userId);
  userIdRef.current = userId;

  const refetch = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from("profiles")
      .select(
        "user_id, chips, is_admin, spins_remaining, next_spin_refill_at, welcome_claimed_at, last_spin_at, last_daily_at, updated_at",
      )
      .eq("user_id", uid)
      .maybeSingle();
    if (data) setProfile(data as Profile);
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const supabase = getSupabase();
    let cancelled = false;

    void supabase
      .from("profiles")
      .select(
        "user_id, chips, is_admin, spins_remaining, next_spin_refill_at, welcome_claimed_at, last_spin_at, last_daily_at, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setProfile(data as Profile);
      });

    const channel = supabase
      .channel(`profile:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setProfile(null);
            return;
          }
          const next = payload.new as Profile | null;
          if (next) setProfile(next);
        },
      )
      .subscribe();

    // Belt-and-suspenders: re-read on tab focus so a tab that was
    // backgrounded during a balance change still picks it up even if
    // the realtime channel missed an event.
    const onFocus = () => {
      void refetch();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [userId, refetch]);

  return { profile, refetch };
}
