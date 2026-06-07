/**
 * Fixed catalog of 10 stake categories shown in the lobby. Each table
 * has a buy-in *range*: a minimum of 20 × big_blind and a maximum of
 * `buy_in_bb` × big_blind (admin-tunable, default 100). Players sit
 * with min(main balance, max buy-in) and are gated by the minimum
 * (matched by the player_default_chips DB trigger). Sorting goes from
 * cheapest stakes to most expensive.
 */

export type StakeCategory = {
  /** Unique key, also used as a tier index. */
  id: string;
  /** Display label for the tier. */
  label: string;
  /** A short description tucked under the label. */
  description: string;
  /** Small blind. Big blind is always 2× this. */
  smallBlind: number;
  /** Visual theme applied to the table felt and category badge. */
  theme: StakeTheme;
};

export type StakeTheme = {
  /** CSS background-image for the felt — usually a radial gradient. */
  felt: string;
  /** Wood-frame border colour (CSS color). */
  rim: string;
  /** Glow ring around the felt (rgba string for box-shadow). */
  glow: string;
  /** Tailwind class for the category badge background. */
  badge: string;
  /** Tailwind class for accent text (used in lobby card emblem etc.). */
  accent: string;
};

const FELT = (a: string, b: string, c: string) =>
  `radial-gradient(ellipse at center, ${a} 0%, ${b} 55%, ${c} 100%)`;

const THEMES: Record<string, StakeTheme> = {
  micro: {
    felt: FELT("#1a6f55", "#0d4f3c", "#08382a"),
    rim: "#5b2a1f",
    glow: "rgba(34, 197, 94, 0.35)",
    badge: "border-emerald-400/60 bg-emerald-900/85 text-emerald-200",
    accent: "text-emerald-300",
  },
  low: {
    felt: FELT("#207a6e", "#0d544a", "#083730"),
    rim: "#4a2814",
    glow: "rgba(20, 184, 166, 0.35)",
    badge: "border-teal-400/60 bg-teal-900/85 text-teal-200",
    accent: "text-teal-300",
  },
  easy: {
    felt: FELT("#1f5f7a", "#0d4154", "#082b36"),
    rim: "#3f2010",
    glow: "rgba(6, 182, 212, 0.35)",
    badge: "border-cyan-400/60 bg-cyan-900/85 text-cyan-200",
    accent: "text-cyan-300",
  },
  casual: {
    felt: FELT("#1e457a", "#0d2f54", "#081d36"),
    rim: "#3a1c10",
    glow: "rgba(59, 130, 246, 0.35)",
    badge: "border-blue-400/60 bg-blue-900/85 text-blue-200",
    accent: "text-blue-300",
  },
  standard: {
    felt: FELT("#332870", "#1d164a", "#100a2a"),
    rim: "#341a14",
    glow: "rgba(99, 102, 241, 0.4)",
    badge: "border-indigo-400/60 bg-indigo-900/85 text-indigo-200",
    accent: "text-indigo-300",
  },
  mid: {
    felt: FELT("#542070", "#37144a", "#1f0a2a"),
    rim: "#2c1614",
    glow: "rgba(168, 85, 247, 0.4)",
    badge: "border-purple-400/60 bg-purple-900/85 text-purple-200",
    accent: "text-purple-300",
  },
  high: {
    felt: FELT("#7a1f3a", "#54122a", "#36081a"),
    rim: "#280f0f",
    glow: "rgba(244, 63, 94, 0.4)",
    badge: "border-rose-400/60 bg-rose-900/85 text-rose-200",
    accent: "text-rose-300",
  },
  pro: {
    felt: FELT("#262019", "#15110b", "#0a0805"),
    rim: "#1f1610",
    glow: "rgba(245, 158, 11, 0.45)",
    badge: "border-amber-400/70 bg-amber-950/90 text-amber-200",
    accent: "text-amber-300",
  },
  elite: {
    felt: FELT("#3b2c0f", "#1f1607", "#0c0703"),
    rim: "#1c130a",
    glow: "rgba(234, 179, 8, 0.45)",
    badge: "border-yellow-400/70 bg-yellow-950/90 text-yellow-200",
    accent: "text-yellow-300",
  },
  vip: {
    felt: FELT("#220a3e", "#0e0420", "#06010d"),
    rim: "#0d0710",
    glow: "rgba(217, 119, 6, 0.55)",
    badge:
      "border-amber-400/80 bg-gradient-to-r from-amber-700 via-amber-900 to-amber-700 text-amber-100",
    accent: "text-amber-200",
  },
};

export const STAKE_CATEGORIES: StakeCategory[] = [
  { id: "micro", label: "Micro", description: "Penny stakes, low risk", smallBlind: 50_000, theme: THEMES.micro },
  { id: "low", label: "Low", description: "Casual play", smallBlind: 100_000, theme: THEMES.low },
  { id: "easy", label: "Easy", description: "Friendly stakes", smallBlind: 250_000, theme: THEMES.easy },
  { id: "casual", label: "Casual", description: "Steady action", smallBlind: 500_000, theme: THEMES.casual },
  { id: "standard", label: "Standard", description: "Regular cash game", smallBlind: 1_000_000, theme: THEMES.standard },
  { id: "mid", label: "Mid", description: "Mid stakes grind", smallBlind: 2_500_000, theme: THEMES.mid },
  { id: "high", label: "High", description: "Bigger swings", smallBlind: 5_000_000, theme: THEMES.high },
  { id: "pro", label: "Pro", description: "Serious bankrolls only", smallBlind: 10_000_000, theme: THEMES.pro },
  { id: "elite", label: "Elite", description: "Top of the room", smallBlind: 25_000_000, theme: THEMES.elite },
  { id: "vip", label: "VIP", description: "Whales welcome", smallBlind: 50_000_000, theme: THEMES.vip },
];

const DEFAULT_THEME: StakeTheme = THEMES.micro;

/**
 * Find the catalog entry whose small blind matches the room's. Falls
 * back to `null` for legacy / custom-blind tables (admin-created with
 * an off-tier amount).
 */
export function categoryFromBlinds(smallBlind: number): StakeCategory | null {
  return (
    STAKE_CATEGORIES.find((c) => c.smallBlind === smallBlind) ?? null
  );
}

export function themeFor(smallBlind: number): StakeTheme {
  return categoryFromBlinds(smallBlind)?.theme ?? DEFAULT_THEME;
}

/** Maximum buy-in multiplier (×BB). Admin-tunable via `app_settings.buy_in_bb`. */
export const DEFAULT_BUY_IN_BB = 100;

/** Minimum buy-in multiplier (×BB). Fixed — the floor needed to sit. */
export const MIN_BUY_IN_BB = 20;

export function bigBlindOf(category: StakeCategory): number {
  return category.smallBlind * 2;
}

/**
 * Minimum chips required to sit at a table in this category — the
 * affordability gate. A player whose main balance is below this can't
 * join (20×BB; e.g. 2M on a 50k/100k table).
 */
export function minBuyInOf(category: StakeCategory): number {
  return bigBlindOf(category) * MIN_BUY_IN_BB;
}

/**
 * Maximum buy-in for a table in this category — the cap a player sits
 * with when their balance can cover it. The multiplier is
 * admin-configurable (`app_settings.buy_in_bb`); pass the live value
 * through, or omit to fall back to the 100×BB default (e.g. 10M on a
 * 50k/100k table).
 */
export function maxBuyInOf(
  category: StakeCategory,
  multiplierBb: number = DEFAULT_BUY_IN_BB,
): number {
  return bigBlindOf(category) * multiplierBb;
}

/**
 * Chips a player sits down with: the full max buy-in when they can
 * afford it, otherwise just the minimum buy-in (the rest stays in
 * their bankroll). Returns `null` when the balance is below the
 * minimum buy-in (they can't enter this category).
 */
export function entryChipsOf(
  balance: number,
  category: StakeCategory,
  multiplierBb: number = DEFAULT_BUY_IN_BB,
): number | null {
  const min = minBuyInOf(category);
  if (balance < min) return null;
  const max = maxBuyInOf(category, multiplierBb);
  return balance >= max ? max : min;
}

export function blindsLabel(category: StakeCategory): string {
  return `${formatChips(category.smallBlind)}/${formatChips(bigBlindOf(category))}`;
}

/**
 * Compact chip formatter — falls back to K / M / B suffixes for any
 * value ≥ 1,000 so the lobby and table chrome don't have to stretch
 * around 10,000,000-style numbers.
 */
export function formatChips(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) < 1_000) return n.toLocaleString();
  if (Math.abs(n) < 1_000_000) {
    const v = n / 1_000;
    return `${trim(v)}K`;
  }
  if (Math.abs(n) < 1_000_000_000) {
    const v = n / 1_000_000;
    return `${trim(v)}M`;
  }
  const v = n / 1_000_000_000;
  return `${trim(v)}B`;
}

function trim(v: number): string {
  // 1 decimal for under-10 values, otherwise round to whole.
  if (Math.abs(v) < 10) {
    const rounded = Math.round(v * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }
  return String(Math.round(v));
}
