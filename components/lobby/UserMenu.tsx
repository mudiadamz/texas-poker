"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, LogOut } from "lucide-react";

import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/useSession";

type Props = {
  user: SessionUser;
  onSignOut: () => Promise<void> | void;
};

/**
 * Compact user pill on the right side of the lobby topbar. Click to
 * open a dropdown with the signed-in identity and a sign-out action.
 */
export function UserMenu({ user, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const displayName = user.name ?? user.email ?? "Player";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full border bg-black/40 p-1 text-sm text-ivory transition hover:border-gold/60 sm:py-1 sm:pl-1 sm:pr-2.5",
          open ? "border-gold/60" : "border-gold/30",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <UserAvatar user={user} size={28} />
        <span className="hidden max-w-[120px] truncate text-xs font-medium sm:inline">
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 text-gold-soft/70 transition sm:block",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-pop absolute right-0 top-full z-[60] mt-2 w-64 overflow-hidden rounded-xl border border-gold/40 bg-wood-dark/95 shadow-2xl backdrop-blur"
        >
          <div className="flex items-center gap-3 border-b border-gold/20 bg-gold/10 px-3 py-3">
            <UserAvatar user={user} size={40} />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-ivory-soft">
                {displayName}
              </p>
              {user.email && (
                <p className="truncate text-[11px] text-ivory/60">
                  {user.email}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void onSignOut();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/15 hover:text-red-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function UserAvatar({ user, size }: { user: SessionUser; size: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [user.avatarUrl]);

  if (user.avatarUrl && !failed) {
    return (
      <Image
        src={user.avatarUrl}
        alt={user.name ?? "User avatar"}
        width={size}
        height={size}
        className="rounded-full border border-gold/40 object-cover"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        unoptimized
      />
    );
  }
  const initials =
    (user.name ?? user.email ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gradient-to-br from-amber-500 to-amber-700 text-[11px] font-bold text-wood-dark"
      style={{ width: size, height: size }}
      aria-label={user.name ?? "User"}
    >
      {initials}
    </span>
  );
}
