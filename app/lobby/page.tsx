"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Shuffle } from "lucide-react";
import { customAlphabet } from "nanoid";

import { HowToPlayModal } from "@/components/lobby/HowToPlayModal";
import { LobbyShell } from "@/components/lobby/LobbyShell";
import { SpinSidebarWidget } from "@/components/lobby/SpinSidebarWidget";
import { SpinWheelModal } from "@/components/lobby/SpinWheelModal";
import { StakeCategoryCard } from "@/components/lobby/StakeCategoryCard";
import { TopUpModal } from "@/components/lobby/TopUpModal";
import { UserMenu } from "@/components/lobby/UserMenu";
import { WelcomeBonusModal } from "@/components/lobby/WelcomeBonusModal";
import {
  fetchLobbyRooms,
  type LobbyRoom,
} from "@/lib/lobby";
import { STAKE_CATEGORIES, minBuyInOf, MIN_BUY_IN_BB } from "@/lib/stakes";
import { getSupabase } from "@/lib/supabase";
import { useBuyInBb } from "@/lib/useBuyInBb";
import { useProfile } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";

const nanoid = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 6);
const LOBBY_REFRESH_MS = 5_000;

export default function LobbyPage() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const { profile, refetch: refetchProfile } = useProfile(user?.id);
  const buyInBb = useBuyInBb();

  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [spinOpen, setSpinOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Anonymous visitors land on the marketing page; bounce them back
  // there if they manage to navigate here directly.
  useEffect(() => {
    if (user === null) router.replace("/");
  }, [user, router]);

  const profileUserId = profile?.user_id;
  const welcomeClaimedAt = profile?.welcome_claimed_at;
  useEffect(() => {
    if (!profileUserId) return;
    if (welcomeClaimedAt === null) setWelcomeOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUserId]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const showWelcome = welcomeOpen;

  const spinsRemaining = profile?.spins_remaining ?? 3;
  const refillAt = useMemo(() => {
    if (!profile?.next_spin_refill_at) return 0;
    return new Date(profile.next_spin_refill_at).getTime();
  }, [profile?.next_spin_refill_at]);
  const refillElapsed = refillAt > 0 && now >= refillAt;
  const spinReady = spinsRemaining > 0 || refillElapsed;
  const spinCooldownLabel = useMemo(() => {
    if (spinReady) return null;
    if (refillAt === 0) return null;
    const totalSec = Math.max(0, Math.ceil((refillAt - now) / 1000));
    const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
    const s = (totalSec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, [spinReady, refillAt, now]);

  const loadingRef = useRef(false);
  const refresh = useCallback(async (silent = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (silent) setRefreshing(true);
    try {
      const nextRooms = await fetchLobbyRooms();
      setRooms(nextRooms);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load rooms.");
    } finally {
      loadingRef.current = false;
      if (silent) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
    const id = window.setInterval(() => void refresh(true), LOBBY_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh, user]);

  useEffect(() => {
    if (!user) return;
    const supabase = getSupabase();
    let timer: number | null = null;
    const debounced = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        void refresh(true);
      }, 400);
    };
    const channel = supabase
      .channel("lobby-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tp_players" },
        debounced,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tp_rooms" },
        debounced,
      )
      .subscribe();
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [refresh, user]);

  const categoryStats = useMemo(() => {
    const map = new Map<number, { tables: number; players: number }>();
    for (const r of rooms) {
      const entry = map.get(r.small_blind) ?? { tables: 0, players: 0 };
      entry.tables += 1;
      entry.players += r.player_count;
      map.set(r.small_blind, entry);
    }
    return map;
  }, [rooms]);

  const totalPlayers = useMemo(
    () => rooms.reduce((acc, r) => acc + r.player_count, 0),
    [rooms],
  );

  const handleJoinCategory = useCallback(
    async (smallBlind: number) => {
      if (joiningId) return;
      const key = `cat-${smallBlind}`;
      setJoiningId(key);
      setError(null);
      try {
        const open = rooms
          .filter((r) => r.small_blind === smallBlind && r.player_count < 9)
          .sort((a, b) => b.player_count - a.player_count);
        const candidate = open[0];
        if (candidate) {
          router.push(`/room/${candidate.id}`);
          return;
        }

        const supabase = getSupabase();
        const id = nanoid();
        const { error: createErr } = await supabase.from("tp_rooms").insert({
          id,
          name: null,
          phase: "waiting",
          community_cards: [],
          small_blind: smallBlind,
          big_blind: smallBlind * 2,
        });
        if (createErr) throw createErr;
        router.push(`/room/${id}`);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to find a table.");
        setJoiningId(null);
      }
    },
    [joiningId, rooms, router],
  );

  const handleRandomQuickJoin = useCallback(async () => {
    if (joiningId) return;
    setJoiningId("quick-random");
    setError(null);
    try {
      const mainChips = profile?.chips ?? 0;
      const affordable = rooms.filter((r) => {
        const minBuyIn = r.big_blind * MIN_BUY_IN_BB;
        return r.player_count < 9 && mainChips >= minBuyIn;
      });

      if (affordable.length > 0) {
        const maxCount = affordable.reduce(
          (acc, r) => Math.max(acc, r.player_count),
          0,
        );
        const top = affordable.filter((r) => r.player_count === maxCount);
        const pick = top[Math.floor(Math.random() * top.length)];
        router.push(`/room/${pick.id}`);
        return;
      }

      const tier = STAKE_CATEGORIES.find(
        (c) => mainChips >= minBuyInOf(c),
      );
      if (!tier) {
        throw new Error("Main chips kamu kurang untuk buy-in stake terendah.");
      }
      setJoiningId(null);
      await handleJoinCategory(tier.smallBlind);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to find a table.");
      setJoiningId(null);
    }
  }, [joiningId, rooms, router, profile?.chips, handleJoinCategory]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/");
  }, [signOut, router]);

  // Loading auth or already redirecting unauth visitors out.
  if (user === undefined || user === null) {
    return (
      <main
        className="flex min-h-screen items-center justify-center"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at top, #2c5746 0%, #0a3d2e 55%, #050f0c 100%)",
        }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-gold-soft" />
      </main>
    );
  }

  return (
    <>
      <LobbyShell
        totalPlayers={totalPlayers}
        mainChips={profile?.chips ?? null}
        userSlot={<UserMenu user={user} onSignOut={handleSignOut} />}
        onTopUp={() => setTopUpOpen(true)}
        onHowToPlay={() => setHowToPlayOpen(true)}
        sidebarSlot={
          <SpinSidebarWidget
            spinsRemaining={spinsRemaining}
            cooldownLabel={spinCooldownLabel}
            onClick={() => setSpinOpen(true)}
          />
        }
      >
        <section id="stakes" className="flex flex-col gap-5">
          <header className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleRandomQuickJoin()}
                disabled={joiningId === "quick-random"}
                title="Sit me at the busiest open seat I can afford"
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-700 px-3.5 py-1.5 font-serif text-xs font-bold uppercase tracking-widest text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_3px_8px_rgba(0,0,0,0.3)] ring-1 ring-emerald-300/50 transition hover:from-emerald-300 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {joiningId === "quick-random" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Shuffle className="h-3.5 w-3.5" />
                )}
                Quick Join
              </button>
            </div>
            <button
              type="button"
              onClick={() => void refresh(true)}
              disabled={refreshing}
              aria-label="Refresh tables"
              className="rounded-full bg-black/40 p-1.5 text-ivory/70 ring-1 ring-white/10 transition hover:bg-black/60 hover:text-gold-soft disabled:opacity-40"
            >
              <RefreshCcw
                className={refreshing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
              />
            </button>
          </header>

          {error && (
            <p className="rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-200 ring-1 ring-red-400/40">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-black/30 p-12 text-sm text-ivory/70">
              <Loader2 className="h-4 w-4 animate-spin text-gold-soft" />
              Loading…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {STAKE_CATEGORIES.map((category) => {
                const stats = categoryStats.get(category.smallBlind) ?? {
                  tables: 0,
                  players: 0,
                };
                const key = `cat-${category.smallBlind}`;
                return (
                  <StakeCategoryCard
                    key={category.id}
                    category={category}
                    playerCount={stats.players}
                    mainChips={profile?.chips ?? null}
                    buyInBb={buyInBb}
                    busy={joiningId === key}
                    onJoin={() => void handleJoinCategory(category.smallBlind)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </LobbyShell>

      {showWelcome && (
        <WelcomeBonusModal
          onClaimed={() => {
            setWelcomeOpen(false);
            void refetchProfile();
          }}
          onDismiss={() => setWelcomeOpen(false)}
        />
      )}

      {spinOpen && (
        <SpinWheelModal
          spinsRemaining={spinsRemaining}
          nextRefillAt={profile?.next_spin_refill_at ?? null}
          onSpun={() => void refetchProfile()}
          onClose={() => setSpinOpen(false)}
        />
      )}

      {topUpOpen && (
        <TopUpModal
          mainChips={profile?.chips ?? null}
          lastDailyAt={profile?.last_daily_at ?? null}
          onOpenSpin={() => setSpinOpen(true)}
          onClaimed={() => void refetchProfile()}
          onClose={() => setTopUpOpen(false)}
        />
      )}

      {howToPlayOpen && (
        <HowToPlayModal onClose={() => setHowToPlayOpen(false)} />
      )}
    </>
  );
}
