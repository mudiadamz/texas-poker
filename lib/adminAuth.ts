import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Admin auth helper for Next.js route handlers.
 *
 * The browser sends the user's Supabase access token in the
 * `Authorization: Bearer <jwt>` header (the `authedFetch` client
 * helper attaches it). This module verifies the JWT against the
 * Supabase auth backend and confirms `profiles.is_admin = true`
 * before allowing privileged actions.
 *
 * `ADMIN_EMAILS` (env, comma-separated) acts as a bootstrap escape
 * hatch — listed emails are accepted even if their `is_admin` flag
 * hasn't been flipped yet. The flag itself is auto-set on first
 * successful access so subsequent calls don't need the env list.
 */

export type AdminUser = {
  userId: string;
  email: string | null;
};

function bearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  const tok = auth.slice(7).trim();
  return tok.length > 0 ? tok : null;
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

/**
 * Resolve the calling user from the Bearer token and verify they're
 * an admin. Returns `null` on any failure (missing token, invalid
 * token, no profile, or `is_admin` false).
 */
export async function getAdminUser(req: Request): Promise<AdminUser | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const admin = getSupabaseAdmin();

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return null;
  const user = userData.user;

  const { data: profile } = await admin
    .from("tp_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.is_admin) {
    return { userId: user.id, email: user.email ?? null };
  }

  // Bootstrap: env-listed email auto-promoted on first hit.
  const allow = adminEmails();
  const email = user.email?.toLowerCase() ?? null;
  if (email && allow.includes(email)) {
    await admin
      .from("tp_profiles")
      .update({ is_admin: true })
      .eq("user_id", user.id);
    return { userId: user.id, email: user.email ?? null };
  }

  return null;
}
