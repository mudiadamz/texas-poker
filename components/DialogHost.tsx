"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

import {
  type DialogRequest,
  type DialogTone,
  resolveDialog,
  subscribeDialogs,
} from "@/lib/dialog";

/**
 * Renders the imperative dialog queue. Mounted once at the app root
 * via the layout so any code path (hooks, effects, callbacks) can
 * `showAlert` / `showConfirm` and have it surface here.
 */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);

  useEffect(() => subscribeDialogs(setQueue), []);

  if (queue.length === 0) return null;

  return (
    <>
      {queue.map((req, i) => (
        <DialogShell key={req.id} req={req} stackIndex={queue.length - 1 - i} />
      ))}
    </>
  );
}

function DialogShell({
  req,
  stackIndex,
}: {
  req: DialogRequest;
  stackIndex: number;
}) {
  // Esc cancels (confirm → false, alert → resolve void).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        resolveDialog(req.id, false);
      } else if (e.key === "Enter" && stackIndex === 0) {
        resolveDialog(req.id, true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req.id, stackIndex]);

  const tone = TONE[req.tone ?? "default"];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`dlg-title-${req.id}`}
      aria-describedby={req.description ? `dlg-desc-${req.id}` : undefined}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ paddingTop: stackIndex * 6, paddingBottom: stackIndex * 6 }}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => resolveDialog(req.id, false)}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />
      <div
        className={`relative w-full max-w-sm overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-wood-dark via-wood-dark to-black shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] ${tone.border}`}
        style={{
          transform: `translateY(${stackIndex * -6}px) scale(${1 - stackIndex * 0.02})`,
        }}
      >
        <div className={`px-5 pt-5 pb-2 ${tone.headerGlow}`}>
          <div className="flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 ${tone.iconWrap}`}
            >
              {tone.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id={`dlg-title-${req.id}`}
                className="font-serif text-base font-bold tracking-tight text-ivory-soft sm:text-lg"
              >
                {req.title}
              </h2>
              {req.description && (
                <p
                  id={`dlg-desc-${req.id}`}
                  className="mt-1 text-[13px] leading-relaxed text-ivory/75"
                >
                  {req.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/5 bg-black/30 px-5 py-3">
          {req.kind === "confirm" && (
            <button
              type="button"
              onClick={() => resolveDialog(req.id, false)}
              className="rounded-lg border border-ivory/20 bg-white/5 px-3 py-1.5 font-serif text-xs font-bold uppercase tracking-widest text-ivory/80 transition hover:bg-white/10 hover:text-ivory-soft"
            >
              {req.cancelLabel}
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => resolveDialog(req.id, true)}
            className={`rounded-lg border-2 px-4 py-1.5 font-serif text-xs font-bold uppercase tracking-widest shadow transition ${tone.confirmBtn}`}
          >
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const TONE: Record<
  DialogTone,
  {
    border: string;
    headerGlow: string;
    iconWrap: string;
    icon: React.ReactNode;
    confirmBtn: string;
  }
> = {
  default: {
    border: "border-gold/60",
    headerGlow: "",
    iconWrap:
      "border-gold/60 bg-gradient-to-br from-gold/30 via-wood-dark to-wood-dark text-gold-soft",
    icon: <Info className="h-5 w-5" />,
    confirmBtn:
      "border-gold/60 bg-gradient-to-b from-amber-300 to-amber-600 text-wood-dark shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] hover:from-amber-200 hover:to-amber-500",
  },
  info: {
    border: "border-sky-400/70",
    headerGlow: "",
    iconWrap:
      "border-sky-400/70 bg-sky-500/20 text-sky-200",
    icon: <Info className="h-5 w-5" />,
    confirmBtn:
      "border-sky-400/70 bg-gradient-to-b from-sky-400 to-sky-700 text-white hover:from-sky-300 hover:to-sky-600",
  },
  warning: {
    border: "border-amber-400/70",
    headerGlow: "",
    iconWrap:
      "border-amber-400/70 bg-amber-500/15 text-amber-200",
    icon: <AlertTriangle className="h-5 w-5" />,
    confirmBtn:
      "border-amber-400/70 bg-gradient-to-b from-amber-400 to-amber-700 text-wood-dark hover:from-amber-300 hover:to-amber-600",
  },
  danger: {
    border: "border-red-400/70",
    headerGlow: "",
    iconWrap:
      "border-red-400/70 bg-red-500/15 text-red-200",
    icon: <ShieldAlert className="h-5 w-5" />,
    confirmBtn:
      "border-red-400/70 bg-gradient-to-b from-rose-500 to-rose-800 text-white hover:from-rose-400 hover:to-rose-700",
  },
};

// Export so callers can reference success styling explicitly later.
export const DIALOG_TONE_OPTIONS = TONE;
