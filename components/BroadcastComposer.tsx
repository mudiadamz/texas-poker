"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Megaphone, Send, X } from "lucide-react";

type Props = {
  open: boolean;
  context?: string;
  placeholder?: string;
  initialValue?: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (message: string) => Promise<void> | void;
  onClose: () => void;
};

const MAX_LENGTH = 500;

/**
 * Modal composer used by the admin dashboard to push announcements
 * into a room. Minimal black-and-white styling to match the rest of
 * the admin panel.
 */
export function BroadcastComposer({
  open,
  context,
  placeholder,
  initialValue,
  busy,
  error,
  onSubmit,
  onClose,
}: Props) {
  const [draft, setDraft] = useState(initialValue ?? "");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initialValue ?? "");
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [open, initialValue]);

  if (!open) return null;

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !busy;

  async function handleSend() {
    if (!canSend) return;
    await onSubmit(trimmed);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-900/50 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Megaphone className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Broadcast message
              </h2>
              {context && (
                <p className="text-xs text-slate-500">{context}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(e) => {
            if (
              (e.key === "Enter" && (e.ctrlKey || e.metaKey)) ||
              (e.key === "Enter" && !e.shiftKey && !e.altKey)
            ) {
              e.preventDefault();
              void handleSend();
            } else if (e.key === "Escape") {
              if (!busy) onClose();
            }
          }}
          disabled={busy}
          rows={4}
          placeholder={placeholder ?? "Message for everyone in the room…"}
          className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        />

        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Enter to send, Shift+Enter for newline.</span>
          <span>
            {draft.length} / {MAX_LENGTH}
          </span>
        </div>

        {error && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
