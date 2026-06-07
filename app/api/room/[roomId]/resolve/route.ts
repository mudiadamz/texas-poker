import { NextResponse } from "next/server";

import { findWinners } from "@/lib/handEval";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Params = { params: Promise<{ roomId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { roomId } = await params;
  const admin = getSupabaseAdmin();

  const { data: room, error: roomErr } = await admin
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.phase !== "showdown") {
    return NextResponse.json({ error: "Not in showdown" }, { status: 400 });
  }

  if (room.winners && Array.isArray(room.winners) && room.winners.length > 0) {
    return NextResponse.json({ winners: room.winners, already: true });
  }

  const { data: players, error: playerErr } = await admin
    .from("players")
    .select("id, name, hole_cards, folded")
    .eq("room_id", roomId);

  if (playerErr) {
    return NextResponse.json({ error: playerErr.message }, { status: 500 });
  }

  const community = Array.isArray(room.community_cards)
    ? (room.community_cards as string[])
    : [];

  const contenders = (players ?? [])
    .filter(
      (p) =>
        !p.folded &&
        Array.isArray(p.hole_cards) &&
        (p.hole_cards as string[]).length === 2,
    )
    .map((p) => ({
      playerId: p.id as string,
      holeCards: p.hole_cards as string[],
    }));

  if (contenders.length === 0) {
    await admin.rpc("apply_showdown_winners", {
      p_room_id: roomId,
      p_winners: [],
    });
    return NextResponse.json({ winners: [] });
  }

  const pot = room.pot ?? 0;
  const winHands = findWinners(contenders, community);
  const share = Math.floor(pot / Math.max(winHands.length, 1));

  const nameById = new Map(
    (players ?? []).map((p) => [p.id as string, p.name as string]),
  );

  const winnersPayload = winHands.map((w) => ({
    player_id: w.playerId,
    name: nameById.get(w.playerId) ?? "Player",
    amount: share,
    hand_label: w.hand.label,
  }));

  const { error: rpcErr } = await admin.rpc("apply_showdown_winners", {
    p_room_id: roomId,
    p_winners: winnersPayload,
  });

  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  return NextResponse.json({ winners: winnersPayload });
}
