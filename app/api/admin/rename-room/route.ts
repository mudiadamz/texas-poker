import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAX_ROOM_NAME = 80;

/**
 * Admin: rename a room. `null` / empty name clears it (the room
 * card falls back to "Untitled room" everywhere).
 */
export async function POST(req: Request) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const roomId =
    body && typeof body === "object" && "roomId" in body
      ? (body as { roomId?: unknown }).roomId
      : undefined;
  const rawName =
    body && typeof body === "object" && "name" in body
      ? (body as { name?: unknown }).name
      : undefined;

  if (typeof roomId !== "string" || !roomId) {
    return NextResponse.json(
      { error: "roomId is required" },
      { status: 400 },
    );
  }
  if (rawName !== null && typeof rawName !== "string") {
    return NextResponse.json(
      { error: "name must be a string or null" },
      { status: 400 },
    );
  }

  const trimmed =
    typeof rawName === "string" ? rawName.trim().slice(0, MAX_ROOM_NAME) : "";
  const newName = trimmed.length > 0 ? trimmed : null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("tp_rooms")
    .update({ name: newName })
    .eq("id", roomId)
    .select("id, name")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, room: data });
}
