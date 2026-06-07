"use client";

import { ShieldCheck, X } from "lucide-react";

export type BroadcastMessage = {
  id: string;
  message: string;
  from: string;
  source: "admin";
  ts: string;
};

type Props = {
  messages: BroadcastMessage[];
  onDismiss: (id: string) => void;
};

/**
 * Stack of incoming admin broadcasts, rendered as floating toasts at
 * the top of the room. Player-to-player chat lives in the ChatBox
 * panel instead.
 *
 * The parent owns the auto-dismiss timing — this component just
 * renders whatever is in `messages` and calls `onDismiss` when the
 * close button is clicked.
 */
export function BroadcastInbox({ messages, onDismiss }: Props) {
  if (messages.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex flex-col items-center gap-2 px-3 sm:top-5">
      {messages.map((m) => (
        <div
          key={m.id}
          role="status"
          className="pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-xl border border-red-400/60 bg-red-500/15 px-3 py-2.5 text-red-100 shadow-lg ring-1 ring-red-400/30 backdrop-blur-sm"
        >
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500/30 text-red-200">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-[11px] uppercase tracking-wide">
              <span className="font-serif font-bold">Admin</span>
              <span className="opacity-70">
                {new Date(m.ts).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-snug">
              {m.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(m.id)}
            className="shrink-0 rounded p-0.5 text-red-200/80 transition hover:bg-red-500/20 hover:text-red-50"
            aria-label="Tutup pesan"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
