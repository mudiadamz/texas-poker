"use client";

import { useEffect, useState } from "react";

import { DEFAULT_BUY_IN_BB } from "@/lib/stakes";
import { getSupabase } from "@/lib/supabase";

/**
 * Live read of the admin-configurable buy-in multiplier (chips per
 * seat = big_blind × buyInBb). Subscribes to app_settings so the
 * lobby's affordability filters and stake card buy-in numbers update
 * the moment an admin retunes the setting.
 */
export function useBuyInBb(): number {
  const [value, setValue] = useState<number>(DEFAULT_BUY_IN_BB);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    void supabase
      .from("app_settings")
      .select("buy_in_bb")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const v = (data as { buy_in_bb?: number } | null)?.buy_in_bb;
        if (typeof v === "number" && v > 0) setValue(v);
      });

    const channel = supabase
      .channel("app_settings:buy_in_bb")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "app_settings",
          filter: "id=eq.1",
        },
        (payload) => {
          const v = (payload.new as { buy_in_bb?: number } | null)?.buy_in_bb;
          if (typeof v === "number" && v > 0) setValue(v);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return value;
}
