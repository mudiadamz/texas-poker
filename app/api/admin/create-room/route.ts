import { NextResponse } from "next/server";
import { customAlphabet } from "nanoid";

import { getAdminUser } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const nanoid = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 6);

/**
 * Admin endpoint to create a fresh table with custom stake levels.
 * `big_blind` is forced to `2 * small_blind` server-side so the DB
 * `rooms_blinds_ratio_chk` constraint always holds.
 */
export async function POST(req: Request) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawName =
    body && typeof body === "object" && "name" in body
      ? (body as { name?: unknown }).name
      : null;
  const rawSb =
    body && typeof body === "object" && "small_blind" in body
      ? (body as { small_blind?: unknown }).small_blind
      : null;

  if (typeof rawSb !== "number" || !Number.isFinite(rawSb)) {
    return NextResponse.json(
      { error: "small_blind (number) is required" },
      { status: 400 },
    );
  }
  const sb = Math.round(rawSb);
  if (sb < 1 || sb > 1_000_000) {
    return NextResponse.json(
      { error: "small_blind must be between 1 and 1,000,000" },
      { status: 400 },
    );
  }
  const bb = sb * 2;

  const name =
    typeof rawName === "string" && rawName.trim().length > 0
      ? rawName.trim().slice(0, 64)
      : null;

  const admin = getSupabaseAdmin();
  const id = nanoid();
  const { data, error } = await admin
    .from("tp_rooms")
    .insert({
      id,
      name,
      phase: "waiting",
      community_cards: [],
      small_blind: sb,
      big_blind: bb,
    })
    .select("id, name, small_blind, big_blind")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, room: data });
}
