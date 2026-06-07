"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Hash,
  LogOut,
  Menu,
  Pencil,
  UserCircle2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { isMuted, setMuted } from "@/lib/sounds";
import { EmojiBlaster } from "./EmojiBlaster";

type Props = {
  roomId: string;
  roomName?: string | null;
  playerName?: string;
  canRename?: boolean;
  onRename?: (name: string) => Promise<void> | void;
  canReact?: boolean;
  /** Players that can be picked as the target of an emoji reaction. */
  reactTargets?: Array<{ id: string; name: string }>;
  /** Local player id, so the target picker can mark it as "(kamu)". */
  meId?: string | null;
  onEmoji?: (emoji: string, targetId: string | null) => void;
  onLeave: () => void;
};

/**
 * Single floating menu button replacing the old top bar. Anchored to
 * top-right; clicking opens a compact panel with room info, player
 * rename, react, sound toggle, invite link, and leave.
 */
export function RoomControls({
  roomId,
  roomName,
  playerName,
  canRename,
  onRename,
  canReact,
  reactTargets,
  meId,
  onEmoji,
  onLeave,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [editing, setEditing] = useState(false);

  const [draft, setDraft] = useState(playerName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMutedState(isMuted());
    function onMuteChange() {
      setMutedState(isMuted());
    }
    window.addEventListener("poker-mute-change", onMuteChange);
    return () =>
      window.removeEventListener("poker-mute-change", onMuteChange);
  }, []);

  useEffect(() => {
    if (!editing) setDraft(playerName ?? "");
  }, [playerName, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setEditing(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  async function copyLink() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
    }
  }

  async function commitRename() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setNameError("Nama tidak boleh kosong.");
      return;
    }
    if (trimmed.length > 32) {
      setNameError("Nama maksimal 32 karakter.");
      return;
    }
    setNameError(null);
    if (trimmed === playerName) {
      setEditing(false);
      return;
    }
    setSavingName(true);
    try {
      await onRename?.(trimmed);
      setEditing(false);
    } catch (err) {
      console.error(err);
      setNameError(err instanceof Error ? err.message : "Gagal mengubah nama.");
    } finally {
      setSavingName(false);
    }
  }

  function cancelRename() {
    setDraft(playerName ?? "");
    setNameError(null);
    setEditing(false);
  }

  return (
    <div ref={wrapRef} className="fixed right-3 top-3 z-40 sm:right-5 sm:top-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full border-2 border-gold/60 bg-wood-dark/95 text-gold-soft shadow-xl ring-1 ring-gold/30 transition hover:scale-105 hover:border-gold sm:h-11 sm:w-11",
          open && "border-gold scale-105",
        )}
        aria-label={open ? "Tutup menu" : "Buka menu"}
        aria-expanded={open}
        title="Menu"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {open && (
        <div
          role="menu"
          className="animate-pop absolute right-0 top-12 w-[min(18rem,calc(100vw-1.5rem))] rounded-2xl border-2 border-gold/60 bg-wood-dark/95 shadow-2xl ring-1 ring-gold/30 backdrop-blur"
        >
          {/* Room header */}
          <div className="rounded-t-2xl border-b border-gold/30 bg-gold/10 px-3 py-2">
            <div className="truncate font-serif text-sm font-bold text-ivory-soft">
              {roomName || "Table"}
            </div>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="mt-0.5 flex w-full items-center gap-1.5 truncate font-mono text-[11px] text-gold-soft/90 transition hover:text-gold-soft"
              title="Click to copy invite link"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-300" />
                  <span className="text-emerald-300">Invite link copied</span>
                </>
              ) : (
                <>
                  <Hash className="h-3 w-3" />
                  <span className="truncate">{roomId}</span>
                  <Copy className="ml-auto h-3 w-3 opacity-60" />
                </>
              )}
            </button>
          </div>

          {/* Player rename */}
          {canRename && (
            <div className="border-b border-gold/15 px-3 py-2">
              {editing ? (
                <div className="flex items-center gap-1 rounded-md border border-gold/60 bg-felt-dark/70 px-2 py-1">
                  <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-gold-soft" />
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void commitRename();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelRename();
                      }
                    }}
                    disabled={savingName}
                    maxLength={32}
                    placeholder="Nama kamu"
                    className="flex-1 bg-transparent px-1 text-xs font-medium text-ivory-soft outline-none placeholder:text-ivory-dim/70"
                  />
                  <button
                    type="button"
                    onClick={() => void commitRename()}
                    disabled={savingName}
                    className="rounded p-0.5 text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                    aria-label="Simpan nama"
                    title="Simpan"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelRename}
                    disabled={savingName}
                    className="rounded p-0.5 text-ivory-dim transition hover:bg-wood/60 hover:text-ivory-soft disabled:opacity-50"
                    aria-label="Batal"
                    title="Batal"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-xs text-ivory transition hover:text-gold-soft"
                  title="Ganti nama"
                >
                  <UserCircle2 className="h-4 w-4 shrink-0 text-gold-soft" />
                  <span className="truncate">{playerName || "Pilih nama"}</span>
                  <Pencil className="ml-auto h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
                </button>
              )}
              {nameError && (
                <p className="mt-1 px-1 text-[11px] text-red-300">{nameError}</p>
              )}
            </div>
          )}

          {/* React */}
          {canReact && onEmoji && (
            <div className="border-b border-gold/15 px-3 py-2">
              <EmojiBlaster
                onPick={onEmoji}
                players={reactTargets}
                meId={meId}
              />
            </div>
          )}

          {/* Sound toggle */}
          <button
            type="button"
            onClick={toggleMute}
            aria-pressed={muted}
            className="flex w-full items-center gap-2 border-b border-gold/15 px-3 py-2 text-left text-xs text-ivory transition hover:bg-gold/10 hover:text-gold-soft"
          >
            {muted ? (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                Suara: nonaktif
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5" />
                Suara: aktif
              </>
            )}
          </button>

          {/* Leave */}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLeave();
            }}
            className="flex w-full items-center gap-2 rounded-b-2xl px-3 py-2 text-left text-xs text-red-300 transition hover:bg-red-500/15 hover:text-red-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            Leave table
          </button>
        </div>
      )}
    </div>
  );
}
