"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, Spade } from "lucide-react";

import { AdminShell, type AdminTab } from "@/components/admin/AdminShell";
import {
  AppSettingsForm,
} from "@/components/admin/AppSettingsForm";
import { CreateTableModal } from "@/components/admin/CreateTableModal";
import {
  RoomsList,
  type AdminRoom,
} from "@/components/admin/RoomsList";
import { BroadcastComposer } from "@/components/BroadcastComposer";
import { authedFetch } from "@/lib/authedFetch";
import { showConfirm } from "@/lib/dialog";
import type { AppSettings } from "@/lib/types";
import { useProfile } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";

const ROOMS_REFRESH_INTERVAL_MS = 10_000;

export default function AdminPage() {
  const router = useRouter();
  const { user, signInWithGoogle, signOut } = useSession();
  const { profile } = useProfile(user?.id);

  const [tab, setTab] = useState<AdminTab>("rooms");

  // Rooms tab state -------------------------------------------------------
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [broadcastTarget, setBroadcastTarget] = useState<AdminRoom | null>(
    null,
  );
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  // Settings tab state ----------------------------------------------------
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsOk, setSettingsOk] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const setBusy = useCallback((key: string, v: boolean) => {
    setPending((prev) => {
      if (!v) {
        const { [key]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: true };
    });
  }, []);

  // Auth states:
  //  - user === undefined → still resolving session
  //  - user === null      → not signed in (show LoginScreen)
  //  - profile?.is_admin  → the only authenticated state that grants
  //    access to the panel; everything else falls back to AccessDenied.
  const isAdmin = !!profile?.is_admin;

  const fetchRooms = useCallback(async (silent = false) => {
    if (!silent) setRoomsLoading(true);
    setRoomsError(null);
    try {
      const res = await authedFetch("/api/admin/rooms", { method: "GET" });
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Error" }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { rooms: AdminRoom[] };
      setRooms(body.rooms);
      setUnauthorized(false);
    } catch (err) {
      console.error(err);
      setRoomsError(err instanceof Error ? err.message : "Failed to load rooms.");
    } finally {
      if (!silent) setRoomsLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const res = await authedFetch("/api/admin/app-settings", {
        method: "GET",
      });
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Error" }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { settings: AppSettings };
      setSettings(body.settings);
    } catch (err) {
      console.error(err);
      setSettingsError(
        err instanceof Error ? err.message : "Failed to load settings.",
      );
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchRooms();
  }, [isAdmin, fetchRooms]);

  useEffect(() => {
    if (!isAdmin) return;
    const id = window.setInterval(() => {
      if (tab === "rooms") void fetchRooms(true);
    }, ROOMS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isAdmin, tab, fetchRooms]);

  useEffect(() => {
    if (isAdmin && tab === "settings" && !settings) {
      void fetchSettings();
    }
  }, [isAdmin, tab, settings, fetchSettings]);

  const handleLogout = useCallback(async () => {
    await signOut();
    setRooms([]);
    setSettings(null);
    router.replace("/");
  }, [signOut, router]);

  // Room actions ----------------------------------------------------------

  const handleRename = useCallback(
    async (room: AdminRoom) => {
      if (typeof window === "undefined") return;
      const next = window.prompt(
        `Rename room "${room.id}":`,
        room.name ?? "",
      );
      if (next === null) return;
      const trimmed = next.trim();
      if (trimmed === (room.name ?? "")) return;
      const key = `rename:${room.id}`;
      setBusy(key, true);
      setActionError(null);
      try {
        const res = await authedFetch("/api/admin/rename-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: room.id,
            name: trimmed.length > 0 ? trimmed : null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Error" }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        await fetchRooms(true);
      } catch (err) {
        console.error(err);
        setActionError(
          err instanceof Error ? err.message : "Failed to rename room.",
        );
      } finally {
        setBusy(key, false);
      }
    },
    [fetchRooms, setBusy],
  );

  const handleDelete = useCallback(
    async (room: AdminRoom) => {
      const ok = await showConfirm({
        title: "Delete room?",
        description: `Hapus room "${room.name ?? room.id}". Semua pemain yang sedang duduk akan di-disconnect.`,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        tone: "danger",
      });
      if (!ok) return;
      const key = `delete:${room.id}`;
      setBusy(key, true);
      setActionError(null);
      try {
        const res = await authedFetch("/api/admin/delete-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId: room.id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Error" }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        await fetchRooms(true);
      } catch (err) {
        console.error(err);
        setActionError(
          err instanceof Error ? err.message : "Failed to delete room.",
        );
      } finally {
        setBusy(key, false);
      }
    },
    [fetchRooms, setBusy],
  );

  const handleBroadcastSubmit = useCallback(
    async (message: string) => {
      const room = broadcastTarget;
      if (!room) return;
      setBroadcastBusy(true);
      setBroadcastError(null);
      try {
        const res = await authedFetch("/api/admin/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomId: room.id,
            message,
            from: "Admin",
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Error" }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        setBroadcastTarget(null);
      } catch (err) {
        console.error(err);
        setBroadcastError(
          err instanceof Error ? err.message : "Failed to send broadcast.",
        );
      } finally {
        setBroadcastBusy(false);
      }
    },
    [broadcastTarget],
  );

  // Settings actions ------------------------------------------------------

  const handleCreateTable = useCallback(
    async (payload: { name: string | null; small_blind: number }) => {
      setCreateBusy(true);
      setCreateError(null);
      try {
        const res = await authedFetch("/api/admin/create-room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Error" }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        await fetchRooms(true);
        setCreateOpen(false);
      } catch (err) {
        console.error(err);
        setCreateError(
          err instanceof Error ? err.message : "Failed to create table.",
        );
      } finally {
        setCreateBusy(false);
      }
    },
    [fetchRooms],
  );

  const handleSettingsSubmit = useCallback(
    async (next: AppSettings) => {
      setSettingsBusy(true);
      setSettingsError(null);
      setSettingsOk(null);
      try {
        const res = await authedFetch("/api/admin/app-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Error" }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const body = (await res.json()) as { settings: AppSettings };
        setSettings(body.settings);
        setSettingsOk("Settings updated. New values apply on the next hand.");
        window.setTimeout(() => setSettingsOk(null), 4_000);
      } catch (err) {
        console.error(err);
        setSettingsError(
          err instanceof Error ? err.message : "Failed to save settings.",
        );
      } finally {
        setSettingsBusy(false);
      }
    },
    [],
  );

  // -----------------------------------------------------------------------

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aActive = a.active_count > 0 ? 1 : 0;
      const bActive = b.active_count > 0 ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      if (a.active_count !== b.active_count)
        return b.active_count - a.active_count;
      if (a.total_count !== b.total_count) return b.total_count - a.total_count;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [rooms]);

  // Loading session
  if (user === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100/70">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </main>
    );
  }

  if (user === null) {
    return <LoginScreen onSignIn={() => signInWithGoogle("/admin")} />;
  }

  // Signed in but profile still loading
  if (profile === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100/70">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </main>
    );
  }

  if (!isAdmin || unauthorized) {
    return (
      <AccessDeniedScreen
        email={user.email ?? null}
        onSignOut={() => void handleLogout()}
      />
    );
  }

  return (
    <AdminShell tab={tab} onTabChange={setTab} onLogout={() => void handleLogout()}>
      {actionError && (
        <p className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="rounded p-0.5 text-red-500 transition hover:bg-red-100 hover:text-red-700"
            aria-label="Dismiss"
          >
            ×
          </button>
        </p>
      )}

      {tab === "rooms" && (
        <>
          {roomsError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
              {roomsError}
            </p>
          )}
          <RoomsList
            rooms={sortedRooms}
            loading={roomsLoading}
            pending={pending}
            onRefresh={() => void fetchRooms()}
            onCreate={() => {
              setCreateError(null);
              setCreateOpen(true);
            }}
            onRename={(r) => void handleRename(r)}
            onDelete={(r) => void handleDelete(r)}
            onBroadcast={(r) => {
              setBroadcastError(null);
              setBroadcastTarget(r);
            }}
          />
        </>
      )}

      {tab === "settings" && (
        <>
          {settingsLoading && !settings && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading settings…
            </div>
          )}
          {!settingsLoading && (
            <AppSettingsForm
              initial={settings}
              busy={settingsBusy}
              error={settingsError}
              okMessage={settingsOk}
              onSubmit={handleSettingsSubmit}
            />
          )}
        </>
      )}

      <CreateTableModal
        open={createOpen}
        busy={createBusy}
        error={createError}
        onClose={() => {
          if (!createBusy) {
            setCreateOpen(false);
            setCreateError(null);
          }
        }}
        onSubmit={handleCreateTable}
      />

      <BroadcastComposer
        open={!!broadcastTarget}
        context={
          broadcastTarget
            ? `Sends to everyone in room "${
                broadcastTarget.name ?? broadcastTarget.id
              }".`
            : undefined
        }
        placeholder="Announcement for the room…"
        busy={broadcastBusy}
        error={broadcastError}
        onSubmit={handleBroadcastSubmit}
        onClose={() => {
          if (!broadcastBusy) {
            setBroadcastTarget(null);
            setBroadcastError(null);
          }
        }}
      />
    </AdminShell>
  );
}

function LoginScreen({ onSignIn }: { onSignIn: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-lg">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-sm">
            <Spade className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Admin console
            </h1>
            <p className="text-xs text-slate-500">
              Sign in with Google to manage rooms and settings.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSignIn();
            } finally {
              setBusy(false);
            }
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          Continue with Google
        </button>
        <p className="mt-4 text-[11px] text-slate-500">
          Akses dibatasi ke akun yang ditandai sebagai admin di profil
          Supabase. Contact existing admin to grant access.
        </p>
      </div>
    </main>
  );
}

function AccessDeniedScreen({
  email,
  onSignOut,
}: {
  email: string | null;
  onSignOut: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-7 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-white shadow-sm">
            <Spade className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Access denied
            </h1>
            <p className="text-xs text-slate-500">
              Akun ini bukan admin yang terdaftar.
            </p>
          </div>
        </div>
        {email && (
          <p className="mb-3 truncate rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Signed in as <span className="font-mono">{email}</span>
          </p>
        )}
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
