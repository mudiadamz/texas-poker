"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/cn";

export type ChatMessage = {
  id: string;
  message: string;
  from: string;
  source: "player" | "admin";
  player_id?: string;
  ts: string;
};

type Props = {
  messages: ChatMessage[];
  meId: string | null;
  meName?: string | null;
  canSend: boolean;
  busy?: boolean;
  error?: string | null;
  onSend: (message: string) => Promise<void> | void;
  onDismissError?: () => void;
};

const MAX_LENGTH = 240;

const QUICK_PHRASES: ReadonlyArray<string> = [
  "Nice hand! 👏",
  "GG",
  "All in! 💪",
  "Bluff? 🤔",
  "Fold… 😩",
  "Lucky! 🍀",
  "Wow! 😲",
  "Let's go!",
];

/**
 * Floating chat panel pinned to the bottom-right. Collapsed by default
 * — shows an unread badge when new messages arrive while closed.
 * Anyone joined to the room can send; everyone (even spectators) can
 * read.
 */
export function ChatBox({
  messages,
  meId,
  meName,
  canSend,
  busy,
  error,
  onSend,
  onDismissError,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Mark messages as read when the panel is open or when a new message
  // arrives while we're already looking at the panel.
  useEffect(() => {
    if (!open) return;
    const newest = messages[messages.length - 1];
    setLastSeenId(newest?.id ?? null);
  }, [open, messages]);

  // Auto-scroll to bottom on new messages while open.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const unread = useMemo(() => {
    if (open) return 0;
    if (lastSeenId === null) return messages.length;
    const lastIdx = messages.findIndex((m) => m.id === lastSeenId);
    if (lastIdx < 0) return messages.length;
    return messages.length - 1 - lastIdx;
  }, [open, messages, lastSeenId]);

  async function submit(text: string) {
    const trimmed = text.trim().slice(0, MAX_LENGTH);
    if (!trimmed || !canSend || busy) return;
    setDraft("");
    try {
      await onSend(trimmed);
    } catch {
      // Parent surfaces the error via `error` prop; keep draft so user can retry.
      setDraft(trimmed);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold/60 bg-wood-dark/95 text-gold-soft shadow-xl ring-1 ring-gold/30 transition hover:scale-105 hover:border-gold sm:bottom-28 sm:right-6 sm:h-14 sm:w-14"
        aria-label={`Open chat${unread > 0 ? ` (${unread} unread)` : ""}`}
        title="Open chat"
      >
        <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border-2 border-wood-dark bg-red-500 px-1 font-mono text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-24 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border-2 border-gold/60 bg-wood-dark/95 shadow-2xl ring-1 ring-gold/30 backdrop-blur sm:bottom-28 sm:right-6"
      role="dialog"
      aria-label="Room chat"
    >
      <header className="flex items-center justify-between gap-2 border-b border-gold/30 bg-gold/10 px-3 py-2">
        <div className="flex items-center gap-2 text-gold-soft">
          <MessageCircle className="h-4 w-4" />
          <span className="font-serif text-sm font-bold uppercase tracking-wider">
            Table chat
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-ivory-dim transition hover:bg-wood/60 hover:text-ivory-soft"
          aria-label="Close chat"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div
        ref={listRef}
        className="flex max-h-[40vh] min-h-[10rem] flex-col gap-2 overflow-y-auto px-3 py-3 text-sm"
      >
        {messages.length === 0 ? (
          <p className="m-auto text-center text-xs text-ivory-dim">
            Belum ada chat. Sapa pemain lain pakai quick chat di bawah!
          </p>
        ) : (
          messages.map((m) => {
            const isMe = !!m.player_id && m.player_id === meId;
            const isAdmin = m.source === "admin";
            return (
              <div
                key={m.id}
                className={cn(
                  "flex flex-col gap-0.5",
                  isMe ? "items-end" : "items-start",
                )}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ivory-dim">
                  {isAdmin && (
                    <ShieldCheck className="h-3 w-3 text-red-300" />
                  )}
                  <span className={cn(isAdmin && "text-red-300 font-bold")}>
                    {isMe ? "You" : m.from}
                  </span>
                  <span className="opacity-70">
                    {new Date(m.ts).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-1.5 text-sm leading-snug shadow-sm",
                    isAdmin
                      ? "border border-red-400/50 bg-red-500/20 text-red-50"
                      : isMe
                        ? "bg-gold/85 text-wood-dark"
                        : "border border-gold/30 bg-felt-dark/80 text-ivory",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {canSend && (
        <div className="border-t border-gold/30 bg-felt-dark/60 px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {QUICK_PHRASES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void submit(q)}
                disabled={busy}
                className="rounded-full border border-gold/40 bg-wood-dark/80 px-2 py-0.5 text-[11px] text-ivory-soft transition hover:border-gold hover:text-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 border-t border-red-400/50 bg-red-500/15 px-3 py-1.5 text-[11px] text-red-200">
          <span>{error}</span>
          {onDismissError && (
            <button
              onClick={onDismissError}
              className="text-red-300 hover:text-ivory-soft"
              aria-label="Dismiss error"
            >
              ×
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(draft);
        }}
        className="flex items-center gap-2 border-t border-gold/30 bg-wood-dark/95 px-2 py-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
          disabled={!canSend || busy}
          placeholder={
            canSend
              ? `Chat as ${meName ?? "you"}…`
              : "Join the table to chat"
          }
          className="flex-1 rounded-lg border border-gold/30 bg-felt-dark/70 px-2.5 py-1.5 text-sm text-ivory placeholder:text-ivory-dim/70 outline-none focus:border-gold disabled:cursor-not-allowed disabled:opacity-60"
          maxLength={MAX_LENGTH}
        />
        <button
          type="submit"
          disabled={!canSend || busy || !draft.trim()}
          className="brass-button flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
          title="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
