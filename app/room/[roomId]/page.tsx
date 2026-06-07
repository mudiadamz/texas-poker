"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

import { getSupabase } from "@/lib/supabase";
import { showAlert, showConfirm } from "@/lib/dialog";
import { useIdentity } from "@/lib/store";
import { useSession } from "@/lib/useSession";
import {
  cleanupStalePlayers,
  cleanupStalePlayersOnJoin,
  STALE_AFTER_SECONDS,
  useHeartbeat,
  useStalePlayerCleanup,
} from "@/lib/useHeartbeat";
import { isMyTurn, type PlayerAction } from "@/lib/betting";
import { bestHand } from "@/lib/handEval";
import { normalizePlayer, normalizeRoom } from "@/lib/normalize";
import { usePhaseAdvance } from "@/lib/usePhaseAdvance";
import { useShowdown } from "@/lib/useShowdown";
import type { Player, Room } from "@/lib/types";
import { BettingControls } from "@/components/BettingControls";
import { InactiveDialog } from "@/components/InactiveDialog";
import { JoinDialog } from "@/components/JoinDialog";
import { RoomControls } from "@/components/RoomControls";
import {
  BroadcastInbox,
  type BroadcastMessage,
} from "@/components/BroadcastInbox";
import { ChatBox, type ChatMessage } from "@/components/ChatBox";
import { ExitButton } from "@/components/ExitButton";
import { PokerTable } from "@/components/PokerTable";
import {
  EmojiBlastLayer,
  type EmojiFloater,
} from "@/components/EmojiBlastLayer";
import { playSound } from "@/lib/sounds";

type Params = Promise<{ roomId: string }>;

export default function RoomPage({ params }: { params: Params }) {
  const { roomId } = use(params);
  const router = useRouter();

  const { playerId, playerName, setIdentity, setName, clear } = useIdentity();
  const { user: session } = useSession();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<EmojiFloater[]>([]);
  const [leaving, setLeaving] = useState(false);
  const [inactiveKicked, setInactiveKicked] = useState(false);
  const [inactiveName, setInactiveName] = useState<string | null>(null);
  const [inbox, setInbox] = useState<BroadcastMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [actionTimeoutSec, setActionTimeoutSec] = useState<number>(45);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<string>("waiting");
  const lastActiveAtRef = useRef<number>(Date.now());

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "visible") {
      lastActiveAtRef.current = Date.now();
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        lastActiveAtRef.current = Date.now();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const advancePhase = usePhaseAdvance(roomId, room?.phase ?? "waiting");
  useShowdown(roomId, room?.phase ?? "waiting", room?.winners ?? null);

  const spawnFloater = useCallback(
    (emoji: string, from: string, to: string | null) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const x = Math.random();
      setFloaters((prev) => [
        ...prev,
        { id, emoji, from, x, to: to ?? undefined },
      ]);
      window.setTimeout(() => {
        setFloaters((prev) => prev.filter((f) => f.id !== id));
      }, 3100);
    },
    [],
  );

  // Track the global action-timer length so the on-avatar progress ring
  // matches whatever the admin currently has in `app_settings`. Falls
  // back to the safe default if the table is unreachable.
  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;
    void supabase
      .from("app_settings")
      .select("action_timeout_seconds")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.action_timeout_seconds) {
          setActionTimeoutSec(Number(data.action_timeout_seconds));
        }
      });

    const channel = supabase
      .channel("app_settings:1")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "app_settings",
          filter: "id=eq.1",
        },
        (payload) => {
          const next = (payload.new as { action_timeout_seconds?: number })
            ?.action_timeout_seconds;
          if (typeof next === "number") setActionTimeoutSec(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabase();

    async function load() {
      setLoading(true);
      try {
        await cleanupStalePlayersOnJoin(roomId);
        await cleanupStalePlayers(roomId).catch(() => {});

        const { data: roomData, error: roomErr } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .maybeSingle();
        if (roomErr) throw roomErr;
        if (!roomData) {
          if (!cancelled) setNotFound(true);
          return;
        }

        const { data: playerData, error: playerErr } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", roomId)
          .order("joined_at", { ascending: true });
        if (playerErr) throw playerErr;

        if (!cancelled) {
          setRoom(normalizeRoom(roomData as Record<string, unknown>));
          setPlayers(
            (playerData ?? []).map((p) =>
              normalizePlayer(p as Record<string, unknown>),
            ),
          );
          lastPhaseRef.current = (roomData.phase as string) ?? "waiting";
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load room.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (!room) return;
    const supabase = getSupabase();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setNotFound(true);
            return;
          }
          const next = normalizeRoom(payload.new as Record<string, unknown>);
          setRoom((prev) => {
            if (prev && prev.phase !== next.phase) {
              if (next.phase === "flop" || next.phase === "turn" || next.phase === "river") {
                playSound("reveal");
              } else if (next.phase === "showdown") {
                playSound("reveal");
              } else if (next.phase === "waiting" && prev.phase !== "waiting") {
                playSound("reset");
              } else if (next.phase === "preflop" && prev.phase === "waiting") {
                playSound("pick");
              }
              lastPhaseRef.current = next.phase;
            }
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const p = normalizePlayer(payload.new as Record<string, unknown>);
            setPlayers((prev) => {
              if (prev.some((x) => x.id === p.id)) return prev;
              if (p.id !== playerIdRef.current) playSound("join");
              return [...prev, p];
            });
          } else if (payload.eventType === "UPDATE") {
            const p = normalizePlayer(payload.new as Record<string, unknown>);
            setPlayers((prev) => prev.map((x) => (x.id === p.id ? p : x)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as Player;
            setPlayers((prev) => {
              if (!prev.some((x) => x.id === old.id)) return prev;
              if (old.id !== playerIdRef.current) playSound("leave");
              return prev.filter((x) => x.id !== old.id);
            });
          }
        },
      )
      .on("broadcast", { event: "emoji" }, (msg) => {
        const payload = msg.payload as { emoji?: string; from?: string; to?: string } | undefined;
        if (!payload?.emoji) return;
        spawnFloater(payload.emoji, payload.from || "Anon", payload.to ?? null);
      })
      .on("broadcast", { event: "leave" }, (msg) => {
        const payload = msg.payload as { player_id?: string } | undefined;
        const id = payload?.player_id;
        if (!id) return;
        setPlayers((prev) => {
          if (!prev.some((x) => x.id === id)) return prev;
          if (id !== playerIdRef.current) playSound("leave");
          return prev.filter((x) => x.id !== id);
        });
      })
      .on("broadcast", { event: "message" }, (msg) => {
        // Admin broadcasts (from /api/admin/broadcast) show as a top toast
        // and also drop into table chat so latecomers can see context.
        const payload = msg.payload as {
          message?: string;
          from?: string;
          source?: string;
          ts?: string;
        } | undefined;
        const text = payload?.message;
        if (!text) return;
        const ts = payload?.ts || new Date().toISOString();
        const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setInbox((prev) => [
          ...prev,
          {
            id: toastId,
            message: text,
            from: payload?.from || "Admin",
            source: "admin",
            ts,
          },
        ]);
        setChatMessages((prev) => [
          ...prev,
          {
            id: toastId,
            message: text,
            from: payload?.from || "Admin",
            source: "admin",
            ts,
          },
        ]);
        playSound("join");
        window.setTimeout(() => {
          setInbox((prev) => prev.filter((m) => m.id !== toastId));
        }, 12_000);
      })
      .on("broadcast", { event: "chat" }, (msg) => {
        const payload = msg.payload as {
          message?: string;
          from?: string;
          player_id?: string;
          ts?: string;
        } | undefined;
        const text = payload?.message;
        if (!text) return;
        const fromMe =
          !!payload?.player_id && payload.player_id === playerIdRef.current;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setChatMessages((prev) => [
          ...prev,
          {
            id,
            message: text,
            from: payload?.from || "Anon",
            player_id: payload?.player_id,
            source: "player",
            ts: payload?.ts || new Date().toISOString(),
          },
        ]);
        if (!fromMe) playSound("join");
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [room, roomId, spawnFloater]);

  useEffect(() => {
    if (loading || !room || !playerId || leaving || inactiveKicked) return;
    const stillThere = players.some((p) => p.id === playerId);
    if (!stillThere && players.length > 0) {
      const timer = window.setTimeout(() => {
        const exists = players.some((p) => p.id === playerId);
        if (exists) return;
        const sinceActive = Date.now() - lastActiveAtRef.current;
        const looksInactive =
          (typeof document !== "undefined" &&
            document.visibilityState === "hidden") ||
          sinceActive > STALE_AFTER_SECONDS * 1000;
        if (looksInactive) {
          setInactiveName(playerName ?? null);
          setInactiveKicked(true);
          return;
        }
        const name = playerName;
        clear();
        if (!name) return;
        void (async () => {
          try {
            const supabase = getSupabase();
            const { data, error: insertErr } = await supabase
              .from("players")
              .insert({ room_id: roomId, name })
              .select("*")
              .single();
            if (insertErr) throw insertErr;
            if (!data) return;
            setIdentity(data.id, data.name);
            setPlayers((prev) =>
              prev.some((p) => p.id === data.id)
                ? prev
                : [...prev, normalizePlayer(data as Record<string, unknown>)],
            );
            lastActiveAtRef.current = Date.now();
          } catch (err) {
            console.error("auto-rejoin failed", err);
          }
        })();
      }, 1500);
      return () => window.clearTimeout(timer);
    }
  }, [
    loading,
    room,
    roomId,
    players,
    playerId,
    leaving,
    inactiveKicked,
    playerName,
    clear,
    setIdentity,
  ]);

  useHeartbeat(inactiveKicked ? null : playerId, roomId);
  useStalePlayerCleanup(!inactiveKicked && playerId ? roomId : null);

  useEffect(() => {
    if (!playerId || !roomId) return;
    let firedOnce = false;
    function fireLeave() {
      if (firedOnce) return;
      firedOnce = true;
      try {
        const payload = JSON.stringify({ roomId, playerId });
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon?.("/api/leave", blob);
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("pagehide", fireLeave);
    window.addEventListener("beforeunload", fireLeave);
    return () => {
      window.removeEventListener("pagehide", fireLeave);
      window.removeEventListener("beforeunload", fireLeave);
    };
  }, [playerId, roomId]);

  const me = useMemo(
    () => players.find((p) => p.id === playerId) ?? null,
    [players, playerId],
  );

  // Anonymous fallback: only ask for a name if there's no Google session.
  // Authenticated players skip the dialog and auto-join with their
  // Google name + avatar (see effect below).
  const needsJoin =
    !loading &&
    !notFound &&
    room &&
    !me &&
    !leaving &&
    !inactiveKicked &&
    session === null;

  const handleJoin = useCallback(
    async (name: string, avatarUrl?: string | null) => {
      const supabase = getSupabase();
      const { data, error: insertErr } = await supabase
        .from("players")
        .insert({
          room_id: roomId,
          name,
          avatar_url: avatarUrl ?? null,
          user_id: session?.id ?? null,
        })
        .select("*")
        .single();
      if (insertErr) {
        const msg = insertErr.message?.toLowerCase() ?? "";
        if (msg.includes("room is full")) {
          throw new Error("Meja sudah penuh (maks 9 pemain).");
        }
        if (msg.includes("not enough main chips")) {
          throw new Error(
            "Main chips kamu kurang dari buy-in meja ini.",
          );
        }
        throw insertErr;
      }
      if (!data) throw new Error("Insert returned no row.");
      setIdentity(data.id, data.name);
      setPlayers((prev) =>
        prev.some((p) => p.id === data.id)
          ? prev
          : [...prev, normalizePlayer(data as Record<string, unknown>)],
      );
    },
    [roomId, setIdentity, session],
  );

  // Auto-join: when a signed-in user opens a room they're not seated
  // at, drop them straight in using their Google name + avatar. Anon
  // visitors still get the JoinDialog name prompt.
  const autoJoiningRef = useRef(false);
  useEffect(() => {
    if (!session) return;
    if (autoJoiningRef.current) return;
    if (loading || notFound || !room) return;
    if (me || leaving || inactiveKicked) return;
    if (players.some((p) => p.id === playerId)) return;
    autoJoiningRef.current = true;
    void (async () => {
      try {
        await handleJoin(session.name ?? "Player", session.avatarUrl ?? null);
      } catch (err) {
        console.error("auto-join failed", err);
        setError(
          err instanceof Error ? err.message : "Failed to join the table.",
        );
      } finally {
        window.setTimeout(() => {
          autoJoiningRef.current = false;
        }, 1500);
      }
    })();
  }, [
    session,
    room,
    loading,
    notFound,
    me,
    leaving,
    inactiveKicked,
    players,
    playerId,
    handleJoin,
  ]);

  const handleRejoinAfterInactive = useCallback(async () => {
    const name = inactiveName ?? session?.name ?? playerName;
    if (!name) return;
    clear();
    await handleJoin(name, session?.avatarUrl ?? null);
    setInactiveKicked(false);
    setInactiveName(null);
    lastActiveAtRef.current = Date.now();
  }, [inactiveName, playerName, clear, handleJoin, session]);

  const handleLeaveAfterInactive = useCallback(() => {
    setInactiveKicked(false);
    setInactiveName(null);
    clear();
    router.push("/lobby");
  }, [clear, router]);

  // Auto-dealer: any client whose view is in `waiting` with 2+ funded
  // seats keeps polling `start_hand` until the room actually advances.
  // The SQL function is idempotent (row lock + phase check) so
  // multiple clients firing — and a single client retrying because of
  // a silent server-side guard return (e.g. cooldown not yet expired,
  // small clock skew) — both resolve to a single successful deal.
  useEffect(() => {
    if (!room || room.phase !== "waiting") return;
    // Players with 0 chips are spectators and don't count toward the
    // 2-seat minimum required to deal a hand.
    const activeCount = players.filter((p) => p.chips > 0).length;
    if (activeCount < 2) return;

    const target = room.phase_ends_at
      ? new Date(room.phase_ends_at).getTime()
      : 0;
    // Always wait a beat past the cooldown to absorb client/server
    // clock skew — otherwise the SQL guard rejects with `now() <
    // phase_ends_at` and nothing changes.
    const initialDelay = Math.max(500, target - Date.now());

    function fire() {
      void getSupabase()
        .rpc("start_hand", { p_room_id: room!.id })
        .then(({ error: err }) => {
          if (err && !err.message.includes("Room not found")) {
            console.warn("auto start_hand:", err.message);
          }
        });
    }

    let intervalId: number | undefined;
    const initialId = window.setTimeout(() => {
      fire();
      // Keep retrying until the room actually transitions to preflop
      // (effect re-runs via realtime UPDATE and bails out at the top).
      intervalId = window.setInterval(fire, 3000);
    }, initialDelay);

    return () => {
      window.clearTimeout(initialId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [room, players.length]);

  // Records the timestamp of the latest *manual* player_action call so
  // the auto-fold detector below can distinguish a fold I just clicked
  // from a fold the server-side action_timeout forced on me.
  const lastManualActionAtRef = useRef<number>(0);
  // Latches once we kick the local player to the lobby for inactivity
  // so the effect can't re-fire after the navigation completes.
  const inactivityKickedRef = useRef(false);
  // Previous value of `me.folded`, used to detect a clean false → true
  // transition (instead of triggering on every re-render).
  const prevFoldedRef = useRef<boolean | null>(null);
  // Mirrors the latest values for the auto-kick effect so we can react
  // to a fold transition without re-running on every dependency change.
  const meRef = useRef<Player | null>(null);
  meRef.current = me ?? null;
  const playerNameRef = useRef<string | null>(playerName);
  playerNameRef.current = playerName;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const handleJoinRef = useRef(handleJoin);
  handleJoinRef.current = handleJoin;

  const handleAction = useCallback(
    async (action: PlayerAction, raiseTo?: number) => {
      if (!room || !playerId || busy) return;
      setBusy(true);
      lastManualActionAtRef.current = Date.now();
      try {
        const supabase = getSupabase();
        const { error: err } = await supabase.rpc("player_action", {
          p_room_id: room.id,
          p_player_id: playerId,
          p_action: action,
          p_raise_to: raiseTo ?? null,
        });
        if (err) throw err;
        playSound(action === "fold" ? "leave" : "pick");
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Action failed.");
      } finally {
        setBusy(false);
      }
    },
    [room, playerId, busy],
  );

  // Auto-kick: if the server folded me because the action timer ran
  // out (not because I clicked Fold), I'm effectively inactive — exit
  // to the lobby instead of sitting at the table with a folded hand.
  useEffect(() => {
    const prev = prevFoldedRef.current;
    const curr = me?.folded ?? null;
    prevFoldedRef.current = curr;

    if (inactivityKickedRef.current) return;
    if (prev !== false || curr !== true) return; // need a clean transition
    if (!room || room.phase === "waiting") return;
    if (!playerId) return;

    const sinceManual = Date.now() - lastManualActionAtRef.current;
    if (sinceManual < 3000) return; // I just clicked Fold myself.

    inactivityKickedRef.current = true;
    setLeaving(true);
    void (async () => {
      // Capture before any state mutation — `me` flips to null as
      // soon as the players row is deleted.
      const meName =
        meRef.current?.name ?? playerNameRef.current ?? "Player";
      const meAvatar =
        meRef.current?.avatar_url ?? sessionRef.current?.avatarUrl ?? null;

      // Release the seat IMMEDIATELY so other players see the
      // inactive seat empty out before this client decides whether
      // to rejoin or head back to the lobby. Doing this *before* the
      // modal means there's no period where everyone else still
      // looks at a folded ghost waiting for a popup half a world
      // away.
      try {
        await getSupabase().from("players").delete().eq("id", playerId);
      } catch (err) {
        console.error("inactivity delete failed", err);
      }

      const ok = await showConfirm({
        title: "Auto-folded",
        description:
          "Kamu di-fold otomatis karena tidak ada respons. Mau rejoin meja atau kembali ke lobby?",
        tone: "warning",
        confirmLabel: "Rejoin",
        cancelLabel: "Back to lobby",
      });

      if (!ok) {
        clear();
        router.push("/lobby");
        return;
      }

      try {
        await handleJoinRef.current(meName, meAvatar);
        // Reset auto-kick state so future inactivity events can fire
        // again at the new seat.
        inactivityKickedRef.current = false;
        prevFoldedRef.current = false;
        lastActiveAtRef.current = Date.now();
        lastManualActionAtRef.current = Date.now();
        setLeaving(false);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Gagal rejoin meja.";
        await showAlert({
          title: "Tidak bisa rejoin",
          description: msg,
          tone: "danger",
          confirmLabel: "Back to lobby",
        });
        clear();
        router.push("/lobby");
      }
    })();
  }, [me?.folded, room, playerId, clear, router]);

  // Auto-leave on bust. When the local player runs out of chips
  // (lost every chip, not all-in or folded), grey them out for a
  // beat so the "Bust" badge registers, then evict them back to the
  // lobby. Without this they linger as a spectator until they
  // manually click Leave.
  const bustKickedRef = useRef(false);
  const isBustNow =
    !!me &&
    me.chips === 0 &&
    !me.all_in &&
    !me.folded &&
    room?.phase !== "showdown";
  useEffect(() => {
    if (!isBustNow) return;
    if (bustKickedRef.current) return;
    if (!playerId) return;

    const id = window.setTimeout(() => {
      bustKickedRef.current = true;
      void (async () => {
        try {
          await getSupabase().from("players").delete().eq("id", playerId);
        } catch (err) {
          console.error("bust delete failed", err);
        }
        await showAlert({
          title: "Out of chips",
          description:
            "Stack kamu habis. Top up dulu di lobby sebelum kembali ke meja.",
          tone: "warning",
          confirmLabel: "Back to lobby",
        });
        clear();
        router.push("/lobby");
      })();
    }, 4000);

    return () => window.clearTimeout(id);
  }, [isBustNow, playerId, clear, router]);

  const handleEmoji = useCallback(
    (emoji: string, targetId: string | null) => {
      const channel = channelRef.current;
      const fromName = me?.name ?? playerName ?? "Anon";
      spawnFloater(emoji, fromName, targetId);
      if (!channel) return;
      void channel.send({
        type: "broadcast",
        event: "emoji",
        payload: { emoji, from: fromName, to: targetId ?? undefined },
      });
    },
    [me, playerName, spawnFloater],
  );

  const handleChatSend = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || !playerId) return;
      const channel = channelRef.current;
      if (!channel) {
        setChatError("Channel not ready — try again in a moment.");
        return;
      }
      setChatBusy(true);
      setChatError(null);
      try {
        const fromName = me?.name ?? playerName ?? "Anon";
        const ts = new Date().toISOString();
        await channel.send({
          type: "broadcast",
          event: "chat",
          payload: {
            message: trimmed,
            from: fromName,
            player_id: playerId,
            ts,
          },
        });
      } catch (err) {
        console.error(err);
        setChatError(
          err instanceof Error ? err.message : "Failed to send message.",
        );
      } finally {
        setChatBusy(false);
      }
    },
    [me, playerName, playerId],
  );

  const handleRename = useCallback(
    async (newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || !playerId) return;
      if (trimmed === playerName) return;
      const supabase = getSupabase();
      setName(trimmed);
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, name: trimmed } : p)),
      );
      const { error: err } = await supabase
        .from("players")
        .update({ name: trimmed })
        .eq("id", playerId);
      if (err) setError("Failed to rename.");
    },
    [playerId, playerName, setName],
  );

  const handleLeave = useCallback(async () => {
    const ok = await showConfirm({
      title: "Leave this table?",
      description:
        "Sisa stack kamu di meja akan otomatis cash-out ke main bankroll.",
      confirmLabel: "Leave",
      cancelLabel: "Stay",
      tone: "danger",
    });
    if (!ok) return;
    setLeaving(true);
    if (playerId && room) {
      const supabase = getSupabase();

      // If it's our turn, fold first so the table can advance without
      // having to wait for the action timer to fire on us.
      if (isMyTurn(room, playerId)) {
        try {
          await supabase.rpc("player_action", {
            p_room_id: room.id,
            p_player_id: playerId,
            p_action: "fold",
            p_raise_to: null,
          });
        } catch {
          /* ignore — leaving anyway */
        }
      }

      const channel = channelRef.current;
      if (channel) {
        try {
          await channel.send({
            type: "broadcast",
            event: "leave",
            payload: { player_id: playerId },
          });
        } catch {
          /* ignore */
        }
      }
      try {
        await supabase.from("players").delete().eq("id", playerId);
      } catch {
        /* ignore */
      }
    }
    clear();
    router.push("/lobby");
  }, [playerId, room, clear, router]);

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-serif text-2xl font-bold text-ivory-soft">
          Table not found
        </h1>
        <p className="text-ivory-dim">
          Table <span className="font-mono text-gold-soft">{roomId}</span> does
          not exist or was removed.
        </p>
        <button
          onClick={() => router.push("/lobby")}
          className="brass-button rounded-lg px-4 py-2 font-serif text-sm font-bold uppercase tracking-wider"
        >
          Back home
        </button>
      </main>
    );
  }

  if (loading || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gold-soft" />
      </main>
    );
  }

  const reactTargets = players.map((p) => ({ id: p.id, name: p.name }));
  const myCards = Array.isArray(me?.hole_cards) ? me.hole_cards : [];
  const community = Array.isArray(room.community_cards) ? room.community_cards : [];
  const myHandEval =
    me && myCards.length === 2 && community.length >= 3
      ? bestHand(myCards, community)
      : null;
  const myTurn = isMyTurn(room, playerId);
  // A player who joined mid-hand has chips but no hole cards yet —
  // they sit out until the next deal. Realtime can also deliver the
  // room (action_player_id) update slightly before the player
  // (hole_cards) update, so we explicitly require both before
  // showing the betting controls.
  const haveCards =
    !!me && Array.isArray(me.hole_cards) && me.hole_cards.length === 2;
  // Action bar visible whenever the seat is in-hand: my turn → live
  // buttons, otherwise → disabled buttons + pre-arm toggles for fold
  // and check/fold.
  const showActionBar =
    !!me &&
    haveCards &&
    !me.folded &&
    !me.all_in &&
    me.chips > 0 &&
    room.phase !== "showdown" &&
    room.phase !== "waiting";

  return (
    <main className="flex min-h-screen flex-col">
      <ExitButton onExit={() => void handleLeave()} />
      <RoomControls
        roomId={room.id}
        roomName={room.name}
        playerName={me?.name ?? playerName ?? ""}
        canRename={!!me}
        onRename={handleRename}
        canReact={!!me}
        reactTargets={reactTargets}
        meId={playerId}
        onEmoji={handleEmoji}
        onLeave={handleLeave}
      />

      <BroadcastInbox
        messages={inbox}
        onDismiss={(id) => setInbox((prev) => prev.filter((m) => m.id !== id))}
      />

      <ChatBox
        messages={chatMessages}
        meId={playerId}
        meName={me?.name ?? playerName ?? null}
        canSend={!!me}
        busy={chatBusy}
        error={chatError}
        onSend={handleChatSend}
        onDismissError={() => setChatError(null)}
      />

      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-1 py-4 pb-24 sm:gap-6 sm:px-6 sm:py-6 sm:pb-28">
        <PokerTable
          room={room}
          players={players}
          meId={playerId}
          onAdvance={advancePhase}
          myHandLabel={myHandEval?.label ?? null}
          actionTimeoutSec={actionTimeoutSec}
        />
      </section>

      {showActionBar && me && (
        <BettingControls room={room} me={me} busy={busy} onAction={handleAction} />
      )}

      {needsJoin && (
        <JoinDialog defaultName={playerName ?? ""} onJoin={handleJoin} />
      )}

      {inactiveKicked && (
        <InactiveDialog
          roomName={room.name}
          playerName={inactiveName ?? playerName}
          onRejoin={handleRejoinAfterInactive}
          onLeave={handleLeaveAfterInactive}
        />
      )}

      <EmojiBlastLayer floaters={floaters} />

      {error && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-400/60 bg-wood-dark/95 px-4 py-2 text-sm text-red-200 shadow-lg ring-1 ring-red-500/40">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 text-red-300 hover:text-ivory-soft"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}
