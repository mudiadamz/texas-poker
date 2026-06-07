"use client";

import { useEffect, useState } from "react";
import { BookOpen, Coins, Menu, Plus, Spade, Users, X } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatChips } from "@/lib/stakes";

type Props = {
  /** Total active players across all tables (live stat). */
  totalPlayers: number;
  /** Signed-in user's persistent bankroll. */
  mainChips?: number | null;
  /** Optional right-side topbar slot (e.g. UserMenu). */
  userSlot?: React.ReactNode;
  /** Optional widget rendered below the sidebar nav (e.g. spin wheel). */
  sidebarSlot?: React.ReactNode;
  /** Click-handler for the "+" top-up button next to the balance. */
  onTopUp?: () => void;
  /** Click-handler for the "How to Play" sidebar entry. */
  onHowToPlay?: () => void;
  children: React.ReactNode;
};

/**
 * Casino-themed lobby chrome. Borderless and compact. On desktop a
 * static sidebar holds nav, the players-online count and the spin
 * widget; on mobile the same content slides in from a hamburger
 * drawer so the top bar stays clean and aligned with the avatar.
 */
export function LobbyShell({
  totalPlayers,
  mainChips,
  userSlot,
  sidebarSlot,
  onTopUp,
  onHowToPlay,
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const scrollToTables = () => {
    document.getElementById("stakes")?.scrollIntoView({ behavior: "smooth" });
  };

  const sidebar = (
    <SidebarContent
      totalPlayers={totalPlayers}
      sidebarSlot={sidebarSlot}
      onHowToPlay={
        onHowToPlay
          ? () => {
              onHowToPlay();
              setDrawerOpen(false);
            }
          : undefined
      }
      onTables={() => {
        scrollToTables();
        setDrawerOpen(false);
      }}
    />
  );

  return (
    <div
      className="relative min-h-screen text-ivory"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, #2c5746 0%, #0a3d2e 55%, #050f0c 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 30% 30%, rgba(0,0,0,0.06) 0, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 5px)",
        }}
        aria-hidden
      />

      <header
        className="relative z-30 bg-black/40 backdrop-blur-md"
        style={{
          boxShadow: "0 1px 0 rgba(212,175,55,0.25)",
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="flex items-center justify-center rounded-lg bg-black/40 p-1.5 text-ivory/80 ring-1 ring-white/10 transition hover:bg-black/60 hover:text-gold-soft sm:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300/30 via-wood-dark to-black text-gold-soft shadow-[inset_0_0_0_1px_rgba(212,175,55,0.45)]">
              <Spade className="h-4 w-4" />
            </span>
            <h1 className="font-serif text-base font-bold tracking-tight text-ivory-soft">
              Hold&apos;em
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {typeof mainChips === "number" && (
              <div className="flex items-stretch overflow-hidden rounded-full bg-gradient-to-b from-amber-400/30 via-wood-dark to-black/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_rgba(0,0,0,0.45)] ring-1 ring-amber-300/40">
                <div className="flex items-center gap-1 px-2 py-0.5 sm:gap-1.5 sm:px-3 sm:py-1">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-wood-dark sm:h-5 sm:w-5">
                    <Coins className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  </span>
                  <span
                    className="font-mono text-xs font-bold tabular-nums text-gold-soft sm:text-sm"
                    title={mainChips.toLocaleString()}
                  >
                    {formatChips(mainChips)}
                  </span>
                </div>
                {onTopUp && (
                  <button
                    type="button"
                    onClick={onTopUp}
                    aria-label="Top up chips"
                    className="flex items-center justify-center bg-gradient-to-b from-emerald-400 to-emerald-700 px-1.5 text-white shadow-[inset_1px_0_0_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:from-emerald-300 hover:to-emerald-600 sm:px-2.5"
                  >
                    <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} />
                  </button>
                )}
              </div>
            )}
            {userSlot}
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="hidden w-52 shrink-0 px-3 py-5 sm:block">
          {sidebar}
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-20 pt-4 sm:px-6 sm:pb-12">
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="animate-pop absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col bg-gradient-to-b from-wood-dark via-wood-dark to-black px-3 py-4 shadow-2xl ring-1 ring-gold/30"
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-300/30 via-wood-dark to-black text-gold-soft shadow-[inset_0_0_0_1px_rgba(212,175,55,0.45)]">
                  <Spade className="h-4 w-4" />
                </span>
                <span className="font-serif text-sm font-bold tracking-tight text-ivory-soft">
                  Hold&apos;em
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-1 text-ivory/60 transition hover:bg-white/10 hover:text-ivory-soft"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shared sidebar/drawer body: nav links, players-online stat and the
 * spin widget slot. Rendered statically on desktop and inside the
 * mobile drawer.
 */
function SidebarContent({
  totalPlayers,
  sidebarSlot,
  onHowToPlay,
  onTables,
}: {
  totalPlayers: number;
  sidebarSlot?: React.ReactNode;
  onHowToPlay?: () => void;
  onTables: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <nav className="flex flex-col gap-1">
        <NavButton
          active
          label="Tables"
          icon={<Spade className="h-4 w-4" />}
          onClick={onTables}
        />
        {onHowToPlay && (
          <NavButton
            label="How to Play"
            icon={<BookOpen className="h-4 w-4" />}
            onClick={onHowToPlay}
          />
        )}
      </nav>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 ring-1 ring-white/10">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-ivory/60">
          <Users className="h-3.5 w-3.5 text-emerald-300" />
          Online
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-ivory">
          {totalPlayers}
        </span>
      </div>

      {sidebarSlot && <div className="mt-4">{sidebarSlot}</div>}
    </div>
  );
}

function NavButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
        active
          ? "bg-gold/15 text-gold-soft"
          : "text-ivory/70 hover:bg-white/5 hover:text-ivory-soft",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md transition",
          active
            ? "bg-gold/20 text-gold-soft"
            : "bg-white/5 text-ivory/70 group-hover:bg-white/10",
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
