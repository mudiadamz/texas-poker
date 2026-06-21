"use client";

import { getSupabase } from "@/lib/supabase";

export type LobbyRoom = {
  id: string;
  name: string | null;
  phase: string;
  created_at: string;
  player_count: number;
  small_blind: number;
  big_blind: number;
};

/** Fetch all rooms with their seated-player counts via Supabase embed. */
export async function fetchLobbyRooms(): Promise<LobbyRoom[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("tp_rooms")
    .select(
      "id, name, phase, created_at, small_blind, big_blind, players:tp_players(id)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  type Raw = {
    id: string;
    name: string | null;
    phase: string;
    created_at: string;
    small_blind: number;
    big_blind: number;
    players: { id: string }[] | null;
  };
  return ((data as Raw[] | null) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phase: r.phase,
    created_at: r.created_at,
    player_count: r.players?.length ?? 0,
    small_blind: Number(r.small_blind ?? 10),
    big_blind: Number(r.big_blind ?? 20),
  }));
}
