"use client";

import {
  Award,
  BookOpen,
  Coins,
  Gift,
  Hand,
  Layers,
  Spade,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";

type Props = {
  onClose: () => void;
};

/**
 * In-app rules popup. Walks the player through Texas Hold'em basics
 * plus the chip economy specific to this app (welcome bonus, hourly
 * spin, daily top-up, table stakes).
 */
export function HowToPlayModal({ onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="howto-title"
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-gold/70 bg-gradient-to-br from-amber-700/20 via-wood-dark to-black shadow-[0_0_60px_rgba(212,175,55,0.3),0_25px_60px_-15px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-gold/30 px-5 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-gold/60 bg-gradient-to-br from-gold/30 via-wood-dark to-wood-dark text-gold-soft shadow-inner">
              <BookOpen className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-soft">
                Player guide
              </p>
              <h2
                id="howto-title"
                className="font-serif text-lg font-bold tracking-tight text-ivory-soft sm:text-xl"
              >
                How to play
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-ivory/60 transition hover:bg-white/10 hover:text-ivory-soft"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-[13px] leading-relaxed text-ivory/85 sm:px-6 sm:py-5 sm:text-sm">
          <Section
            icon={<Spade className="h-4 w-4" />}
            title="About this game"
          >
            <p>
              A real-time, multi-player Texas Hold&apos;em room. Sit at any
              open table, share the URL with friends, and the dealer
              auto-runs each hand. Chips here are play money — there&apos;s
              nothing to buy. Just have fun.
            </p>
          </Section>

          <Section
            icon={<Layers className="h-4 w-4" />}
            title="Hand structure"
          >
            <ol className="ml-5 list-decimal space-y-1.5">
              <li>
                <strong>Blinds.</strong> Two forced bets each hand: the small
                blind and the big blind. They rotate clockwise after every
                hand.
              </li>
              <li>
                <strong>Pre-flop.</strong> Each player gets 2 hidden hole
                cards. Action starts left of the big blind (or with the
                dealer/SB heads-up).
              </li>
              <li>
                <strong>Flop.</strong> 3 community cards revealed face-up.
                Another betting round.
              </li>
              <li>
                <strong>Turn.</strong> 1 more community card. Bet again.
              </li>
              <li>
                <strong>River.</strong> Final community card. Last bet
                round.
              </li>
              <li>
                <strong>Showdown.</strong> Remaining players reveal their
                hands. Best 5-card combination from the 7 available cards
                wins the pot.
              </li>
            </ol>
          </Section>

          <Section
            icon={<Hand className="h-4 w-4" />}
            title="Your turn"
          >
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong>Fold</strong> — give up the hand and forfeit any
                chips already bet.
              </li>
              <li>
                <strong>Check</strong> — pass the action when no bet is
                pending.
              </li>
              <li>
                <strong>Call</strong> — match the current bet to stay in.
              </li>
              <li>
                <strong>Raise</strong> — increase the bet. Minimum raise is
                the size of the previous raise (or the big blind).
              </li>
              <li>
                <strong>All-in</strong> — push every chip you have into the
                pot.
              </li>
            </ul>
            <p className="mt-2 text-[12px] text-ivory/60">
              You have a limited time to act each turn. Idle past the timer
              and you&apos;re auto-folded — and kicked from the table after
              one timeout to keep games moving.
            </p>
          </Section>

          <Section
            icon={<Trophy className="h-4 w-4" />}
            title="Hand rankings"
          >
            <ul className="ml-5 list-decimal space-y-1 text-[12px] sm:text-[13px]">
              <li>Royal flush — A-K-Q-J-10 of one suit</li>
              <li>Straight flush — five suited cards in sequence</li>
              <li>Four of a kind</li>
              <li>Full house — three of a kind + pair</li>
              <li>Flush — five of one suit</li>
              <li>Straight — five in sequence, mixed suits</li>
              <li>Three of a kind</li>
              <li>Two pair</li>
              <li>One pair</li>
              <li>High card</li>
            </ul>
          </Section>

          <Section
            icon={<Users className="h-4 w-4" />}
            title="At the table"
          >
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                Up to 9 players per table. Each tier has a fixed small/big
                blind; the buy-in is a multiple of the big blind set by the
                room admin.
              </li>
              <li>
                Pick a stake from the lobby — you&apos;re auto-seated at the
                busiest open table at that tier, or a fresh one is created.
              </li>
              <li>
                Each table has its own theme matching the stake. Dealer is
                automatic.
              </li>
              <li>
                Cards deal as soon as 2+ players are seated.
              </li>
            </ul>
          </Section>

          <Section
            icon={<Coins className="h-4 w-4" />}
            title="Chips"
          >
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                Your <strong>main bankroll</strong> sits on your profile —
                topbar shows the total.
              </li>
              <li>
                Joining a table moves a buy-in (in big blinds, set by the
                admin) from your bankroll to the table stack. Leaving a table
                cashes out the remaining stack back to your bankroll.
              </li>
              <li>
                Bust at a table and you&apos;re seated as a spectator until
                the next hand.
              </li>
            </ul>
          </Section>

          <Section
            icon={<Gift className="h-4 w-4" />}
            title="Free chips"
          >
            <ul className="ml-5 list-disc space-y-1.5">
              <li>
                <strong>Welcome bonus.</strong> 10M chips, claimed once on
                first sign-in.
              </li>
              <li>
                <strong>Daily bonus.</strong> 1M chips, claimable every 24
                hours from the top-up panel.
              </li>
              <li>
                <strong>Hourly chip wheel.</strong> Free spin every hour. 8
                wedges from 50K up to a 10M jackpot.
              </li>
            </ul>
          </Section>

          <Section
            icon={<Award className="h-4 w-4" />}
            title="Etiquette"
          >
            <p>
              Keep play moving — act promptly when it&apos;s your turn. The
              chat box is open to everyone seated. Be a friendly opponent
              and have fun grinding up.
            </p>
          </Section>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-ivory/40">
            <Sparkles className="h-3 w-3 text-gold/60" />
            Good luck at the felt
            <Sparkles className="h-3 w-3 text-gold/60" />
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-2 flex items-center gap-2 font-serif text-sm font-bold uppercase tracking-widest text-gold-soft">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-gold/40 bg-gold/10 text-gold-soft">
          {icon}
        </span>
        {title}
      </h3>
      <div className="space-y-1.5 pl-1">{children}</div>
    </section>
  );
}
