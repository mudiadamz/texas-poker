import type { GamePhase } from "@/lib/poker";

export type WinnerInfo = {
  player_id: string;
  name: string;
  amount: number;
  hand_label: string;
};

export type Room = {
  id: string;
  name: string | null;
  phase: GamePhase;
  community_cards: string[];
  phase_ends_at: string | null;
  created_at: string;
  pot: number;
  current_bet: number;
  last_raise: number;
  small_blind: number;
  big_blind: number;
  action_player_id: string | null;
  dealer_player_id: string | null;
  acts_remaining: number;
  winners: WinnerInfo[] | null;
  /** How long each player has to act (seconds). */
  action_timeout_seconds: number;
  /** Cooldown after a hand ends before auto-dealer fires again (seconds). */
  between_hand_seconds: number;
  /** How long the showdown banner stays visible (seconds). */
  showdown_seconds: number;
  /** Pause between auto-revealed streets when everyone is all-in (seconds). */
  reveal_seconds: number;
};

export type AppSettings = {
  action_timeout_seconds: number;
  between_hand_seconds: number;
  showdown_seconds: number;
  reveal_seconds: number;
  /** Buy-in multiplier in big blinds (chips = big_blind × buy_in_bb). */
  buy_in_bb: number;
};

export const APP_SETTING_LIMITS = {
  action_timeout_seconds: { min: 5, max: 300 },
  between_hand_seconds: { min: 0, max: 60 },
  showdown_seconds: { min: 3, max: 120 },
  reveal_seconds: { min: 0, max: 30 },
  buy_in_bb: { min: 1, max: 1000 },
} as const;

export type PlayerActionLabel =
  | "fold"
  | "check"
  | "call"
  | "raise"
  | "all_in";

export type Player = {
  id: string;
  room_id: string;
  name: string;
  hole_cards: string[] | null;
  last_seen: string;
  joined_at: string;
  chips: number;
  bet_street: number;
  folded: boolean;
  all_in: boolean;
  /** Fixed table slot 1..9. Assigned on insert; stays put while seated. */
  seat_number: number;
  /** Profile picture URL pulled from the auth provider (Google etc.). */
  avatar_url: string | null;
  /** Owning auth user (null for anonymous joins). */
  user_id: string | null;
  /** Last action this player took on the current betting street (null
      if they haven't acted yet, or after street resets). */
  last_action: PlayerActionLabel | null;
  /** Chips committed (for call/all-in) or new total (for raise) tied
      to `last_action`. 0 for check/fold. */
  last_action_amount: number;
};

/** Max seats on the table (excluding the static dealer at the top). */
export const MAX_PLAYERS_PER_ROOM = 9;
