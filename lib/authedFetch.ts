"use client";

import { getSupabase } from "@/lib/supabase";

/**
 * Wrapper around `fetch` that attaches the signed-in user's Supabase
 * access token via `Authorization: Bearer <jwt>`. Used for admin API
 * endpoints which verify the token + `profiles.is_admin` server-side.
 */
export async function authedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init?.headers ?? {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
