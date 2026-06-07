"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";

import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    name: string | null;
    small_blind: number;
  }) => Promise<void> | void;
};

const PRESET_SMALL_BLINDS: number[] = [5, 10, 25, 50, 100, 250, 500, 1000, 5000];

/**
 * Admin "Create Table" modal. Picks small blind (preset or custom);
 * the big blind is always 2× the small blind so the server-side
 * `rooms_blinds_ratio_chk` constraint is satisfied.
 */
export function CreateTableModal({
  open,
  busy,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [smallBlind, setSmallBlind] = useState<number>(10);

  useEffect(() => {
    if (open) {
      setName("");
      setSmallBlind(10);
    }
  }, [open]);

  if (!open) return null;

  const bigBlind = smallBlind * 2;
  const valid = smallBlind >= 1 && smallBlind <= 1_000_000;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    await onSubmit({
      name: name.trim() || null,
      small_blind: smallBlind,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Create table
              </h2>
              <p className="text-xs text-slate-500">
                Big blind is set to 2× the small blind automatically.
              </p>
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

        <div className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Name (optional)
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              placeholder="High Rollers, Friday Night, …"
              disabled={busy}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Small blind
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_SMALL_BLINDS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSmallBlind(preset)}
                  disabled={busy}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-xs font-medium tabular-nums transition",
                    smallBlind === preset
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  {preset.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                value={smallBlind}
                min={1}
                max={1_000_000}
                onChange={(e) => setSmallBlind(Number(e.target.value))}
                disabled={busy}
                className="w-32 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-right font-mono text-sm font-medium tabular-nums text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
              />
              <span className="text-xs text-slate-500">custom amount</span>
            </div>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-xs">
            <div className="flex items-center justify-between text-indigo-900">
              <span className="font-semibold uppercase tracking-wider">
                Blinds
              </span>
              <span className="font-mono font-bold">
                {smallBlind.toLocaleString()} / {bigBlind.toLocaleString()}
              </span>
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
