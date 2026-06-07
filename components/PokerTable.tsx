"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Coins } from "lucide-react";

import type { Player, Room } from "@/lib/types";
import { categoryFromBlinds, formatChips, themeFor } from "@/lib/stakes";
import { usePortrait } from "@/lib/useMediaQuery";
import { CommunityBoard } from "./CommunityBoard";
import { DealerSeat } from "./DealerSeat";
import { PlayerHand } from "./PlayerHand";
import { PlayerSeat } from "./PlayerSeat";
import { ShowdownBanner } from "./ShowdownBanner";
import { ShowdownCountdown } from "./ShowdownCountdown";

type Props = {
  room: Room;
  players: Player[];
  meId: string | null;
  onAdvance?: () => void;
  myHandLabel?: string | null;
  /** Duration (seconds) of an action turn — drives the avatar timer ring. */
  actionTimeoutSec: number;
};

type SeatPos = { x: number; y: number; angle: number };

/**
 * Fixed 9-seat layout, distributed clockwise around the lower 270° of
 * the table. Seat 1 sits just to the right of the dealer (top-right)
 * and seat 9 sits just to the left (top-left). The dealer occupies the
 * top-center anchor outside this list.
 *
 * Positions are in percentage coordinates of the table container so
 * they scale with whatever size the felt is rendered at.
 */
const SEAT_POSITIONS: SeatPos[] = [
  { x: 80, y: 22, angle: 315 }, // 1: top-right
  { x: 91, y: 42, angle: 349 }, // 2: right-upper
  { x: 89, y: 65, angle: 23 }, // 3: right-lower
  { x: 73, y: 83, angle: 56 }, // 4: bottom-right
  { x: 50, y: 90, angle: 90 }, // 5: bottom-center
  { x: 27, y: 83, angle: 124 }, // 6: bottom-left
  { x: 11, y: 65, angle: 158 }, // 7: left-lower
  { x: 9, y: 42, angle: 191 }, // 8: left-upper
  { x: 20, y: 22, angle: 225 }, // 9: top-left
];

/**
 * Portrait layout: a tall oval. The dealer still anchors the top, so
 * seats hug the long left/right rails and the bottom, leaving the
 * center clear for the community board. Tuned to keep avatars off the
 * rounded corners of the `aspect-[3/4]` felt.
 */
const SEAT_POSITIONS_PORTRAIT: SeatPos[] = [
  { x: 86, y: 13, angle: 315 }, // 1: top-right
  { x: 95, y: 32, angle: 349 }, // 2: right-upper
  { x: 95, y: 54, angle: 23 }, // 3: right-mid
  { x: 86, y: 75, angle: 56 }, // 4: right-lower
  { x: 50, y: 91, angle: 90 }, // 5: bottom-center
  { x: 14, y: 75, angle: 124 }, // 6: left-lower
  { x: 5, y: 54, angle: 158 }, // 7: left-mid
  { x: 5, y: 32, angle: 191 }, // 8: left-upper
  { x: 14, y: 13, angle: 225 }, // 9: top-left
];

function seatPosition(
  seatNumber: number,
  portrait: boolean,
): SeatPos | null {
  const set = portrait ? SEAT_POSITIONS_PORTRAIT : SEAT_POSITIONS;
  if (seatNumber < 1 || seatNumber > set.length) return null;
  return set[seatNumber - 1];
}

/**
 * Project a seat's outer position toward the center to place that
 * player's hole cards on the felt. Higher `frac` = closer to the
 * center.
 */
function projectInward(pos: SeatPos, frac: number): { x: number; y: number } {
  return {
    x: pos.x + (50 - pos.x) * frac,
    y: pos.y + (50 - pos.y) * frac,
  };
}

function deriveBlinds(
  sorted: Player[],
  dealerId: string | null,
): { sb: string | null; bb: string | null } {
  if (sorted.length < 2 || !dealerId) return { sb: null, bb: null };
  const dealerIdx = sorted.findIndex((p) => p.id === dealerId);
  if (dealerIdx < 0) return { sb: null, bb: null };
  const n = sorted.length;
  if (n === 2) {
    return {
      sb: sorted[dealerIdx].id,
      bb: sorted[(dealerIdx + 1) % n].id,
    };
  }
  return {
    sb: sorted[(dealerIdx + 1) % n].id,
    bb: sorted[(dealerIdx + 2) % n].id,
  };
}

/**
 * Live countdown to the next auto-dealt hand, shown at the table
 * center while the room is in `waiting`.
 */
function WaitingPanel({
  playerCount,
  phaseEndsAt,
}: {
  playerCount: number;
  phaseEndsAt: string | null;
}) {
  const target = useMemo(
    () => (phaseEndsAt ? new Date(phaseEndsAt).getTime() : null),
    [phaseEndsAt],
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (target === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [target]);

  if (playerCount < 2) {
    return (
      <p className="font-serif text-xs font-medium uppercase tracking-wider text-ivory/85 sm:text-sm">
        Waiting for more players…
      </p>
    );
  }

  const remainingMs = target === null ? 0 : Math.max(0, target - now);
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className="font-serif text-xs font-medium uppercase tracking-wider text-ivory/85 sm:text-sm">
        {seconds > 0 ? "Next hand in" : "Dealing next hand…"}
      </p>
      {seconds > 0 && (
        <span className="font-mono text-3xl font-bold text-gold-soft sm:text-4xl">
          {seconds}
        </span>
      )}
    </div>
  );
}

export function PokerTable({
  room,
  players,
  meId,
  onAdvance,
  myHandLabel,
  actionTimeoutSec,
}: Props) {
  // Sort by seat_number so the dealer-button / blind derivation walks
  // the table clockwise the same way the SQL does.
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.seat_number - b.seat_number),
    [players],
  );

  const blinds = useMemo(
    () => deriveBlinds(sortedPlayers, room.dealer_player_id),
    [sortedPlayers, room.dealer_player_id],
  );

  const communityCards = Array.isArray(room.community_cards)
    ? room.community_cards
    : [];
  const inHand = room.phase !== "waiting";
  const activeCount = useMemo(
    () => sortedPlayers.filter((p) => p.chips > 0).length,
    [sortedPlayers],
  );

  // Visual theme keyed off the table's small blind. Keeps each stake
  // tier feeling distinct without hardcoding colours per page.
  const theme = themeFor(room.small_blind);
  const category = categoryFromBlinds(room.small_blind);

  // On phones / portrait screens the felt stands up vertically so the
  // 9 seats fit comfortably on a narrow viewport.
  const portrait = usePortrait();

  return (
    <div
      className={`relative mx-auto w-full ${
        portrait ? "aspect-[4/5] max-w-[26rem]" : "aspect-[4/3] max-w-3xl"
      }`}
    >
      {/* Outer table rim — rounded-square felt with dark wood frame.
          In portrait the felt is inset so the seat ring can spread to
          the screen edges while the table itself stays compact. */}
      <div
        className={
          portrait
            ? "absolute inset-x-[12%] inset-y-[6%] rounded-[16%] border-[8px] shadow-2xl"
            : "absolute inset-0 rounded-[18%] border-[10px] shadow-2xl sm:border-[14px] sm:rounded-[16%]"
        }
        style={{
          background: `${theme.felt}, repeating-radial-gradient(circle at 50% 50%, rgba(0,0,0,0.05) 0, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 4px)`,
          backgroundBlendMode: "multiply",
          borderColor: theme.rim,
          boxShadow: `inset 0 0 0 3px #d4af37, inset 0 0 40px rgba(0,0,0,0.55), 0 0 28px ${theme.glow}, 0 18px 40px -12px rgba(0,0,0,0.7)`,
        }}
        aria-hidden
      />

      {/* Dealer figure at the head of the table */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: portrait ? "6%" : "0%", transform: "translate(-50%, -50%)" }}
      >
        <DealerSeat phase={room.phase} />
      </div>

      {/* Stake category plaque, sitting just below the dealer like an
          engraved table marker. */}
      {category && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{ top: portrait ? "15%" : "10%" }}
        >
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 font-serif text-[10px] font-bold uppercase tracking-[0.18em] shadow-lg backdrop-blur sm:text-[11px] ${category.theme.badge}`}
          >
            <span>{category.label}</span>
            <span className="opacity-60">·</span>
            <span className="font-mono">
              {formatChips(category.smallBlind)}/
              {formatChips(category.smallBlind * 2)}
            </span>
          </span>
        </div>
      )}

      {/* Center: pot chip + community + hand label + countdown */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        {inHand && room.pot > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-gold/70 bg-gradient-to-br from-gold/40 via-wood-dark to-wood-dark px-2 py-0.5 font-serif text-[10px] font-bold text-gold-soft shadow-md ring-1 ring-gold/30 sm:gap-1.5 sm:border-2 sm:px-3 sm:py-1 sm:text-sm">
            <Coins className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            <span className="font-mono" title={room.pot.toLocaleString()}>
              {formatChips(room.pot)}
            </span>
            {room.current_bet > 0 && (
              <span className="ml-0.5 text-[9px] font-normal text-ivory-dim/90 sm:ml-1 sm:text-xs">
                bet {formatChips(room.current_bet)}
              </span>
            )}
          </span>
        )}

        {inHand && (
          <CommunityBoard
            phase={room.phase}
            communityCards={communityCards}
            size={portrait ? "xs" : "md"}
          />
        )}

        {inHand && myHandLabel && (
          <span className="rounded-md border border-gold/40 bg-wood-dark/85 px-2 py-0.5 font-serif text-[9px] font-bold uppercase tracking-wider text-gold-soft shadow sm:px-2.5 sm:text-sm">
            {myHandLabel}
          </span>
        )}

        {room.phase === "waiting" ? (
          <WaitingPanel
            playerCount={activeCount}
            phaseEndsAt={room.phase_ends_at}
          />
        ) : room.phase === "showdown" ? (
          <ShowdownBanner
            winners={room.winners ?? []}
            pot={room.pot}
            phaseEndsAt={room.phase_ends_at}
            onExpired={onAdvance}
          />
        ) : !room.action_player_id ? (
          <ShowdownCountdown
            phaseEndsAt={room.phase_ends_at}
            onExpired={onAdvance}
            label="Revealing…"
            tone="reveal"
          />
        ) : null}
      </div>

      {/* Players + their hole cards positioned around the oval perimeter */}
      {sortedPlayers.map((p) => {
        const pos = seatPosition(p.seat_number, portrait);
        if (!pos) return null;
        const isActing = p.id === room.action_player_id;
        // Cards lay on the felt toward the center, far enough in that
        // they clear the seat card's name/chip bars. Bet chip pip sits
        // a bit further inward still.
        const cardPos = projectInward(pos, 0.42);
        const chipPos = projectInward(pos, 0.6);

        return (
          <Fragment key={p.id}>
            <div
              className="absolute"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <PlayerSeat
                player={p}
                phase={room.phase}
                actionTimeoutSec={actionTimeoutSec}
                isMe={p.id === meId}
                isDealer={p.id === room.dealer_player_id}
                isActing={isActing}
                smallBlindId={blinds.sb}
                bigBlindId={blinds.bb}
                phaseEndsAt={isActing ? room.phase_ends_at : null}
                onTurnExpired={isActing ? onAdvance : undefined}
              />
            </div>

            {inHand && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${cardPos.x}%`,
                  top: `${cardPos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <PlayerHand
                  player={p}
                  phase={room.phase}
                  isMe={p.id === meId}
                />
              </div>
            )}

            {inHand && p.bet_street > 0 && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${chipPos.x}%`,
                  top: `${chipPos.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-gold/60 bg-wood-dark/95 px-2 py-0.5 font-mono text-[10px] font-bold text-gold-soft shadow"
                  title={p.bet_street.toLocaleString()}
                >
                  <Coins className="h-3 w-3" />
                  {formatChips(p.bet_street)}
                </span>
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
