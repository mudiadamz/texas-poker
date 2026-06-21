import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { APP_SETTING_LIMITS } from "@/lib/types";

export const runtime = "nodejs";

const FIELDS = [
  "action_timeout_seconds",
  "between_hand_seconds",
  "showdown_seconds",
  "reveal_seconds",
  "buy_in_bb",
] as const;

type FieldKey = (typeof FIELDS)[number];

function clamp(field: FieldKey, raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  const limits = APP_SETTING_LIMITS[field];
  const value = Math.round(raw);
  if (value < limits.min || value > limits.max) return null;
  return value;
}

async function readSingleton() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("tp_app_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** GET — fetch global game settings. */
export async function GET(req: Request) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const settings = await readSingleton();
    return NextResponse.json({ settings });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}

/**
 * POST — update global game settings. Applies to every room
 * immediately on the next hand they deal.
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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body required" }, { status: 400 });
  }

  const update: Record<string, number> = {};
  for (const field of FIELDS) {
    if (!(field in body)) continue;
    const value = clamp(field, (body as Record<string, unknown>)[field]);
    if (value === null) {
      return NextResponse.json(
        {
          error: `${field} out of allowed range`,
          limits: APP_SETTING_LIMITS[field],
        },
        { status: 400 },
      );
    }
    update[field] = value;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No valid settings provided" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { error, data } = await admin
    .from("tp_app_settings")
    .update(update)
    .eq("id", 1)
    .select("*")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Settings row missing" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, settings: data });
}
