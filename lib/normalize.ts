import { DEFAULT_BIG_BLIND, DEFAULT_SMALL_BLIND, STARTING_CHIPS } from "@/lib/betting";
import type { GamePhase } from "@/lib/poker";
import type { Player, PlayerActionLabel, Room, WinnerInfo } from "@/lib/types";

const VALID_ACTIONS: ReadonlyArray<PlayerActionLabel> = [
  "fold",
  "check",
  "call",
  "raise",
  "all_in",
];

export function normalizeRoom(raw: Record<string, unknown>): Room {
  return {
    id: raw.id as string,
    name: (raw.name as string | null) ?? null,
    phase: (raw.phase as GamePhase) ?? "waiting",
    community_cards: Array.isArray(raw.community_cards)
      ? (raw.community_cards as string[])
      : [],
    phase_ends_at: (raw.phase_ends_at as string | null) ?? null,
    created_at: raw.created_at as string,
    pot: Number(raw.pot ?? 0),
    current_bet: Number(raw.current_bet ?? 0),
    last_raise: Number(raw.last_raise ?? 0),
    small_blind: Number(raw.small_blind ?? DEFAULT_SMALL_BLIND),
    big_blind: Number(raw.big_blind ?? DEFAULT_BIG_BLIND),
    action_player_id: (raw.action_player_id as string | null) ?? null,
    dealer_player_id: (raw.dealer_player_id as string | null) ?? null,
    acts_remaining: Number(raw.acts_remaining ?? 0),
    winners: Array.isArray(raw.winners)
      ? (raw.winners as WinnerInfo[])
      : null,
    action_timeout_seconds: Number(raw.action_timeout_seconds ?? 45),
    between_hand_seconds: Number(raw.between_hand_seconds ?? 5),
    showdown_seconds: Number(raw.showdown_seconds ?? 20),
    reveal_seconds: Number(raw.reveal_seconds ?? 3),
  };
}

export function normalizePlayer(raw: Record<string, unknown>): Player {
  const rawAction = raw.last_action;
  const lastAction =
    typeof rawAction === "string" &&
    (VALID_ACTIONS as ReadonlyArray<string>).includes(rawAction)
      ? (rawAction as PlayerActionLabel)
      : null;
  return {
    id: raw.id as string,
    room_id: raw.room_id as string,
    name: raw.name as string,
    hole_cards: Array.isArray(raw.hole_cards)
      ? (raw.hole_cards as string[])
      : null,
    last_seen: raw.last_seen as string,
    joined_at: raw.joined_at as string,
    chips: Number(raw.chips ?? STARTING_CHIPS),
    bet_street: Number(raw.bet_street ?? 0),
    folded: Boolean(raw.folded ?? false),
    all_in: Boolean(raw.all_in ?? false),
    seat_number: Number(raw.seat_number ?? 1),
    avatar_url: (raw.avatar_url as string | null) ?? null,
    user_id: (raw.user_id as string | null) ?? null,
    last_action: lastAction,
    last_action_amount: Number(raw.last_action_amount ?? 0),
  };
}
