import { NextResponse } from "next/server";

import { getAdminUser } from "@/lib/adminAuth";

export const runtime = "nodejs";

/** Hand history is not persisted in Texas Hold'em mode. */
export async function GET(req: Request) {
  if (!(await getAdminUser(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ rounds: [] });
}
