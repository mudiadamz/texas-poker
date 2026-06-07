"use client";

import { ArrowLeft } from "lucide-react";

type Props = {
  /** Pre-fold + leave + navigate to lobby. */
  onExit: () => void;
};

/**
 * Fixed top-left shortcut on the room page. Auto-folds the player if
 * it's their turn (handled by the parent's onExit) before deleting
 * the seat row and navigating back to the lobby.
 */
export function ExitButton({ onExit }: Props) {
  return (
    <button
      type="button"
      onClick={onExit}
      className="fixed left-3 top-3 z-40 inline-flex items-center gap-1.5 rounded-full border-2 border-gold/60 bg-wood-dark/95 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ivory shadow-xl ring-1 ring-gold/30 transition hover:scale-105 hover:border-gold hover:text-gold-soft sm:left-5 sm:top-5 sm:text-sm"
      aria-label="Exit to lobby"
      title="Fold (if your turn) and return to the lobby"
    >
      <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      <span>Lobby</span>
    </button>
  );
}
