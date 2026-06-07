import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { STALE_AFTER_SECONDS } from "@/lib/presenceConstants";

export const runtime = "nodejs";

type RawPlayer = {
  id: string;
  room_id: string;
  name: string;
  hole_cards: string[] | null;
  chips: number;
  bet_street: number;
  folded: boolean;
  all_in: boolean;
  last_seen: string;
  joined_at: string;
};

type RawRoom = {
  id: string;
  name: string | null;
  phase: string;
  community_cards: unknown;
  pot: number;
  current_bet: number;
  small_blind: number;
  big_blind: number;
  created_at: string;
  players: RawPlayer[] | null;
};

export async function GET(req: Request) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("rooms")
    .select(
      "id, name, phase, community_cards, pot, current_bet, small_blind, big_blind, created_at, players(id, room_id, name, hole_cards, chips, bet_street, folded, all_in, last_seen, joined_at)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const cutoff = Date.now() - STALE_AFTER_SECONDS * 1000;

  const rooms = ((data as RawRoom[] | null) ?? []).map((r) => {
    const players = (r.players ?? [])
      .map((p) => ({
        id: p.id,
        name: p.name,
        hole_cards: Array.isArray(p.hole_cards) ? p.hole_cards : null,
        chips: p.chips ?? 1000,
        bet_street: p.bet_street ?? 0,
        folded: p.folded ?? false,
        all_in: p.all_in ?? false,
        last_seen: p.last_seen,
        joined_at: p.joined_at,
        active: new Date(p.last_seen).getTime() > cutoff,
      }))
      .sort((a, b) => a.joined_at.localeCompare(b.joined_at));

    const community = Array.isArray(r.community_cards)
      ? (r.community_cards as string[])
      : [];

    return {
      id: r.id,
      name: r.name,
      phase: r.phase,
      community_cards: community,
      pot: r.pot ?? 0,
      current_bet: r.current_bet ?? 0,
      small_blind: r.small_blind ?? 10,
      big_blind: r.big_blind ?? 20,
      created_at: r.created_at,
      players,
      total_count: players.length,
      active_count: players.filter((p) => p.active).length,
    };
  });

  return NextResponse.json({
    rooms,
    stale_after_seconds: STALE_AFTER_SECONDS,
  });
}
