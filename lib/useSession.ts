"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { getDeviceId } from "@/lib/deviceId";
import { showAlert } from "@/lib/dialog";
import { getSupabase } from "@/lib/supabase";

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

export type SessionState = {
  /** undefined = still loading initial session, null = unauthenticated, otherwise the user. */
  user: SessionUser | null | undefined;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

function userFromSession(session: Session | null): SessionUser | null {
  if (!session) return null;
  const u = session.user;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    id: u.id,
    email: u.email ?? null,
    name:
      (meta.full_name as string | undefined) ??
      (meta.name as string | undefined) ??
      u.email?.split("@")[0] ??
      null,
    avatarUrl:
      (meta.avatar_url as string | undefined) ??
      (meta.picture as string | undefined) ??
      null,
  };
}

/**
 * Subscribe to Supabase auth state. Returns `undefined` while loading,
 * `null` once we've confirmed there's no session, or a `SessionUser`
 * for an authenticated visitor.
 */
export function useSession(): SessionState {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const kickedRef = useRef(false);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(userFromSession(data.session));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(userFromSession(session));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Single-session guard: claim the account for this device on every
  // sign-in, then listen for another device claiming it and sign
  // ourselves out if the session_id no longer matches.
  const uid = user?.id;
  useEffect(() => {
    if (!uid) return;
    const deviceId = getDeviceId();
    if (!deviceId) return;
    const supabase = getSupabase();
    kickedRef.current = false;

    void supabase
      .rpc("claim_session", { p_session_id: deviceId })
      .then(({ error }) => {
        if (error) console.warn("claim_session failed", error.message);
      });

    const channel = supabase
      .channel(`session-guard:${uid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${uid}`,
        },
        (payload) => {
          const next = (payload.new as { current_session_id?: string | null })
            ?.current_session_id;
          if (!next) return;
          if (next !== deviceId && !kickedRef.current) {
            kickedRef.current = true;
            void (async () => {
              await showAlert({
                title: "Sesi ditutup",
                description:
                  "Akun ini baru saja login di perangkat lain. Sesi kamu di sini akan ditutup.",
                tone: "warning",
                confirmLabel: "Sign out",
              });
              await supabase.auth.signOut();
            })();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid]);

  const signInWithGoogle = useCallback(async (redirectPath?: string) => {
    const supabase = getSupabase();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    // Default to the actual lobby route after auth. Callers (admin
    // login, deep links) can override to bring the user back to the
    // page they were on.
    const path = redirectPath ?? "/lobby";
    const target = path.startsWith("http") ? path : `${origin}${path}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: target,
        // Force Google's account chooser every time so a browser
        // signed into a single Google account doesn't silently
        // re-pick that one — letting users switch accounts cleanly.
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  }, []);

  return { user, signInWithGoogle, signOut };
}
