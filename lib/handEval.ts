import { parseCard } from "@/lib/poker";

export type HandCategory =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_kind"
  | "straight_flush";

const CATEGORY_RANK: Record<HandCategory, number> = {
  high_card: 0,
  pair: 1,
  two_pair: 2,
  three_kind: 3,
  straight: 4,
  flush: 5,
  full_house: 6,
  four_kind: 7,
  straight_flush: 8,
};

export type EvaluatedHand = {
  category: HandCategory;
  /** Tie-breakers, highest first */
  kickers: number[];
  label: string;
};

export type WinnerResult = {
  playerId: string;
  hand: EvaluatedHand;
};

function rankValue(rank: string): number {
  const map: Record<string, number> = {
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    J: 11,
    Q: 12,
    K: 13,
    A: 14,
  };
  return map[rank] ?? 0;
}

const RANK_NAMES: Record<number, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "Jack",
  12: "Queen",
  13: "King",
  14: "Ace",
};

const RANK_PLURALS: Record<number, string> = {
  2: "2s",
  3: "3s",
  4: "4s",
  5: "5s",
  6: "6s",
  7: "7s",
  8: "8s",
  9: "9s",
  10: "10s",
  11: "Jacks",
  12: "Queens",
  13: "Kings",
  14: "Aces",
};

/** Singular human name, e.g. 11 -> "Jack", 14 -> "Ace", 7 -> "7". */
function rankName(n: number): string {
  return RANK_NAMES[n] ?? String(n);
}

/** Plural form for hand labels, e.g. 11 -> "Jacks", 14 -> "Aces". */
function rankPlural(n: number): string {
  return RANK_PLURALS[n] ?? `${n}s`;
}

function cardValues(codes: string[]): { rank: number; suit: string }[] {
  const out: { rank: number; suit: string }[] = [];
  for (const c of codes) {
    const p = parseCard(c);
    if (p) out.push({ rank: rankValue(p.rank), suit: p.suit });
  }
  return out;
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map((c) => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

function isStraight(ranks: number[]): number | null {
  const uniq = [...new Set(ranks)].sort((a, b) => b - a);
  if (uniq.length < 5) return null;
  // The Ace can ride at the top of Broadway (A-K-Q-J-10) AND at the
  // bottom of the wheel (A-2-3-4-5). Keep the 14 in place for the
  // Broadway check and append a synthetic 1 so the wheel check still
  // finds the 5-1 window.
  const withWheel = uniq.includes(14) ? [...uniq, 1] : uniq;
  for (let i = 0; i <= withWheel.length - 5; i++) {
    const slice = withWheel.slice(i, i + 5);
    if (slice.length === 5 && slice[0] - slice[4] === 4) {
      return slice[0] === 5 && slice[4] === 1 ? 5 : slice[0];
    }
  }
  return null;
}

function evaluateFive(cards: { rank: number; suit: string }[]): EvaluatedHand {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const rankCounts = new Map<number, number>();
  for (const r of ranks) {
    rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  }
  const counts = [...rankCounts.entries()].sort(
    (a, b) => b[1] - a[1] || b[0] - a[0],
  );
  const isFlush = suits.every((s) => s === suits[0]);
  const straightHigh = isStraight(ranks);

  if (isFlush && straightHigh !== null) {
    return {
      category: "straight_flush",
      kickers: [straightHigh],
      label:
        straightHigh === 14
          ? "Royal flush"
          : `Straight flush, ${rankName(straightHigh)} high`,
    };
  }

  if (counts[0][1] === 4) {
    return {
      category: "four_kind",
      kickers: [counts[0][0], counts[1][0]],
      label: `Four of a kind, ${rankPlural(counts[0][0])}`,
    };
  }

  if (counts[0][1] === 3 && counts[1][1] === 2) {
    return {
      category: "full_house",
      kickers: [counts[0][0], counts[1][0]],
      label: `Full house, ${rankPlural(counts[0][0])} full of ${rankPlural(counts[1][0])}`,
    };
  }

  if (isFlush) {
    return {
      category: "flush",
      kickers: ranks,
      label: `Flush, ${rankName(ranks[0])} high`,
    };
  }

  if (straightHigh !== null) {
    return {
      category: "straight",
      kickers: [straightHigh],
      label: `Straight, ${rankName(straightHigh)} high`,
    };
  }

  if (counts[0][1] === 3) {
    const kickers = counts
      .slice(1)
      .map(([r]) => r)
      .sort((a, b) => b - a);
    return {
      category: "three_kind",
      kickers: [counts[0][0], ...kickers],
      label: `Three of a kind, ${rankPlural(counts[0][0])}`,
    };
  }

  if (counts[0][1] === 2 && counts[1][1] === 2) {
    const highPair = Math.max(counts[0][0], counts[1][0]);
    const lowPair = Math.min(counts[0][0], counts[1][0]);
    const kicker = counts.find(([, c]) => c === 1)?.[0] ?? 0;
    return {
      category: "two_pair",
      kickers: [highPair, lowPair, kicker],
      label: `Two pair, ${rankPlural(highPair)} and ${rankPlural(lowPair)}`,
    };
  }

  if (counts[0][1] === 2) {
    const kickers = counts
      .slice(1)
      .map(([r]) => r)
      .sort((a, b) => b - a);
    return {
      category: "pair",
      kickers: [counts[0][0], ...kickers],
      label: `Pair of ${rankPlural(counts[0][0])}`,
    };
  }

  return {
    category: "high_card",
    kickers: ranks,
    label: `High card ${rankName(ranks[0])}`,
  };
}

/**
 * Standard comparator convention: returns
 *   > 0  when `a` is the stronger hand
 *   < 0  when `b` is the stronger hand
 *   0    when the two hands tie.
 *
 * Categories rank by `CATEGORY_RANK`, ties break on kickers in order.
 */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  const cat = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  if (cat !== 0) return cat;
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const diff = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function bestHand(
  holeCards: string[],
  communityCards: string[],
): EvaluatedHand | null {
  const all = cardValues([...holeCards, ...communityCards]);
  if (all.length < 5) return null;
  let best: EvaluatedHand | null = null;
  for (const combo of combinations(all, 5)) {
    const hand = evaluateFive(combo);
    if (!best || compareHands(hand, best) > 0) {
      best = hand;
    }
  }
  return best;
}

export function findWinners(
  contenders: { playerId: string; holeCards: string[] }[],
  communityCards: string[],
): WinnerResult[] {
  const scored = contenders
    .map((c) => {
      const hand = bestHand(c.holeCards, communityCards);
      return hand ? { playerId: c.playerId, hand } : null;
    })
    .filter((x): x is WinnerResult => x !== null);

  if (scored.length === 0) return [];

  scored.sort((a, b) => compareHands(b.hand, a.hand));
  const top = scored[0].hand;
  return scored.filter((s) => compareHands(s.hand, top) === 0);
}
