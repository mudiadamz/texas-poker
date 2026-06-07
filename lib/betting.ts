import type { Player, Room } from "@/lib/types";

export const STARTING_CHIPS = 1000;
export const DEFAULT_SMALL_BLIND = 10;
export const DEFAULT_BIG_BLIND = 20;
export const ACTION_TIMEOUT_SEC = 45;

export type PlayerAction = "fold" | "check" | "call" | "raise" | "all_in";

export function callAmount(player: Player, room: Room): number {
  return Math.max(0, room.current_bet - player.bet_street);
}

export function canCheck(player: Player, room: Room): boolean {
  return !player.folded && !player.all_in && player.bet_street >= room.current_bet;
}

export function canCall(player: Player, room: Room): boolean {
  const need = callAmount(player, room);
  return !player.folded && !player.all_in && need > 0 && player.chips > 0;
}

export function minRaiseTotal(room: Room): number {
  return room.current_bet + Math.max(room.big_blind, room.last_raise);
}

export function isMyTurn(room: Room, playerId: string | null): boolean {
  return (
    !!playerId &&
    !!room.action_player_id &&
    room.action_player_id === playerId &&
    room.phase !== "waiting" &&
    room.phase !== "showdown"
  );
}

export function playersInHand(players: Player[]): Player[] {
  return players.filter((p) => !p.folded && Array.isArray(p.hole_cards) && p.hole_cards.length === 2);
}

export function activeBettors(players: Player[]): Player[] {
  return players.filter((p) => !p.folded && (p.chips > 0 || p.all_in));
}
