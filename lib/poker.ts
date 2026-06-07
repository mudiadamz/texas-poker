export type Suit = "S" | "H" | "D" | "C";
export type SuitName = "spade" | "heart" | "diamond" | "club";

export type GamePhase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown";

export const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: "Waiting for hand",
  preflop: "Pre-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
};

/** Seconds before community cards auto-advance to the next street. */
export const PHASE_DURATIONS_SEC: Record<
  Exclude<GamePhase, "waiting">,
  number
> = {
  preflop: 25,
  flop: 18,
  turn: 18,
  river: 18,
  showdown: 12,
};

const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
const SUITS: Suit[] = ["S", "H", "D", "C"];

export function buildDeck(): string[] {
  const deck: string[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

/** Fisher–Yates shuffle (client preview only; server deals via RPC). */
export function shuffleDeck(deck: string[]): string[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function parseCard(code: string): { rank: string; suit: Suit } | null {
  const m = code.match(/^(10|[2-9AJQK])([SHDC])$/i);
  if (!m) return null;
  return { rank: m[1].toUpperCase(), suit: m[2].toUpperCase() as Suit };
}

export const SUIT_GLYPH: Record<Suit, string> = {
  S: "\u2660",
  H: "\u2665",
  D: "\u2666",
  C: "\u2663",
};

const SUIT_TO_NAME: Record<Suit, SuitName> = {
  S: "spade",
  H: "heart",
  D: "diamond",
  C: "club",
};

export function suitName(suit: Suit): SuitName {
  return SUIT_TO_NAME[suit];
}

export function isRedSuit(suit: Suit): boolean {
  return suit === "H" || suit === "D";
}

export function formatCard(code: string): { rank: string; glyph: string; red: boolean } {
  const parsed = parseCard(code);
  if (!parsed) {
    return { rank: code, glyph: "?", red: false };
  }
  return {
    rank: parsed.rank,
    glyph: SUIT_GLYPH[parsed.suit],
    red: isRedSuit(parsed.suit),
  };
}

export function communityCount(phase: GamePhase): number {
  switch (phase) {
    case "flop":
      return 3;
    case "turn":
      return 4;
    case "river":
    case "showdown":
      return 5;
    default:
      return 0;
  }
}
