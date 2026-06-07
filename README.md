# Texas Hold'em Online

Real-time multiplayer Texas Hold'em with **Next.js 15** + **Supabase Realtime**.

- Multi-table (shareable URLs)
- **1,000 starting chips**, blinds 10/20
- Two hole cards per player; community cards on the felt
- **Betting**: fold, check, call, raise, all-in
- Turn-based action with **45s timer** (auto-fold on timeout)
- **Pot** and street bets synced in realtime
- **Showdown**: 7-card hand evaluation, winner payout, split pots on ties
- **Automatic dealer** — no room host; next hand auto-deals 5s after showdown
- **Table chat** — floating chat panel with quick-chat shortcuts for everyone seated
- Emoji reactions, admin dashboard

## 1. Setup Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor.
3. Run [`supabase/betting.sql`](supabase/betting.sql) (adds chips, pot, `player_action`, showdown payout).
4. Confirm **Database → Replication** includes `rooms` and `players`.
5. Copy **Project URL**, **anon** key, and **service role** key (needed for showdown resolve).

## 2. Local development

```bash
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY  (showdown winner payout)

npm install
npm run dev
```

Open <http://localhost:3000>.

## 3. How a hand works

1. Players join → each gets **1000 chips**.
2. **Auto-dealer**: as soon as 2+ players are seated, any connected client
   triggers `start_hand` (idempotent via row lock); the dealer button
   rotates automatically between hands.
3. Server posts **SB/BB**, deals hole cards, sets first actor.
4. Players act in turn: **Fold / Check / Call / Raise / All-in**.
5. When the betting round is complete, the server deals the next street (flop → turn → river).
6. After river betting → **showdown** → `/api/room/[id]/resolve` ranks hands and pays the pot.
7. After ~20s the showdown winner is shown, then the table sits in
   **waiting** for 5 seconds before auto-dealing the next hand.

## 4. Deploy to Vercel

Set the same env vars as planning-poker plus `SUPABASE_SERVICE_ROLE_KEY`. `vercel.json` includes the daily ghost-player cleanup cron.

## Project structure

```
lib/
  poker.ts          # Deck, phases
  handEval.ts       # 7-card hand ranking
  betting.ts        # Action helpers
  normalize.ts      # DB row → typed models
components/
  BettingControls.tsx
  TurnTimer.tsx          # 45s pill rendered inside the acting seat
  ShowdownCountdown.tsx  # 20s countdown shown at the table center
  ShowdownBanner.tsx
  ChatBox.tsx
  PokerTable.tsx
app/api/room/[roomId]/resolve/route.ts
supabase/
  schema.sql
  betting.sql       # Run after schema on existing DBs
```

## License

MIT
