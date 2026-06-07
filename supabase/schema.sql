-- =====================================================================
-- Texas Hold'em multiplayer schema for Supabase
-- Run once in Supabase SQL Editor, then run supabase/betting.sql.
-- =====================================================================

create table if not exists public.rooms (
  id                      text primary key,
  name                    text,
  phase                   text        not null default 'waiting'
                                      check (phase in ('waiting','preflop','flop','turn','river','showdown')),
  community_cards         jsonb       not null default '[]'::jsonb,
  deck_remaining          jsonb       not null default '[]'::jsonb,
  phase_ends_at           timestamptz,
  pot                     bigint      not null default 0,
  current_bet             bigint      not null default 0,
  last_raise              bigint      not null default 0,
  action_player_id        uuid,
  dealer_player_id        uuid,
  small_blind             bigint      not null default 10,
  big_blind               bigint      not null default 20,
  acts_remaining          int         not null default 0,
  winners                 jsonb,
  -- Tunable per-room game timings (admin-editable via /admin).
  action_timeout_seconds  int         not null default 45,
  between_hand_seconds    int         not null default 5,
  showdown_seconds        int         not null default 20,
  reveal_seconds          int         not null default 3,
  created_at              timestamptz not null default now()
);

alter table public.rooms add column if not exists action_timeout_seconds int not null default 45;
alter table public.rooms add column if not exists between_hand_seconds int not null default 5;
alter table public.rooms add column if not exists showdown_seconds int not null default 20;
alter table public.rooms add column if not exists reveal_seconds int not null default 3;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rooms_action_timeout_chk') then
    alter table public.rooms add constraint rooms_action_timeout_chk
      check (action_timeout_seconds between 5 and 300);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_between_hand_chk') then
    alter table public.rooms add constraint rooms_between_hand_chk
      check (between_hand_seconds between 0 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_showdown_chk') then
    alter table public.rooms add constraint rooms_showdown_chk
      check (showdown_seconds between 3 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rooms_reveal_chk') then
    alter table public.rooms add constraint rooms_reveal_chk
      check (reveal_seconds between 0 and 30);
  end if;
end $$;

alter table public.rooms add column if not exists phase text not null default 'waiting';
alter table public.rooms add column if not exists community_cards jsonb not null default '[]'::jsonb;
alter table public.rooms add column if not exists deck_remaining jsonb not null default '[]'::jsonb;
alter table public.rooms add column if not exists phase_ends_at timestamptz;

-- Drop legacy columns from older schemas.
alter table public.rooms drop column if exists deck;
alter table public.rooms drop column if exists revealed;
alter table public.rooms drop column if exists owner_id;

create table if not exists public.players (
  id           uuid        primary key default gen_random_uuid(),
  room_id      text        not null references public.rooms(id) on delete cascade,
  name         text        not null,
  hole_cards   jsonb,
  chips        bigint      not null default 1000,
  bet_street   bigint      not null default 0,
  folded       boolean     not null default false,
  all_in       boolean     not null default false,
  -- Static slot 1..9 around the table; assigned by trigger on insert.
  seat_number  int         not null,
  last_seen    timestamptz not null default now(),
  joined_at    timestamptz not null default now()
);

alter table public.players add column if not exists hole_cards jsonb;
alter table public.players add column if not exists seat_number int;
alter table public.players add column if not exists avatar_url text;
alter table public.players add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.players drop column if exists vote;

-- Widen chip columns to bigint: high tiers (Elite/VIP) carry buy-ins
-- and pots well past the 2.1B int4 ceiling.
alter table public.players alter column chips type bigint;
alter table public.players alter column bet_street type bigint;
alter table public.players alter column last_action_amount type bigint;

create index if not exists players_user_id_idx on public.players (user_id);

-- =====================================================================
-- Main chips: per-user persistent bankroll.
-- =====================================================================
create table if not exists public.profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  chips                bigint not null default 0,
  is_admin             boolean not null default false,
  spins_remaining      int  not null default 3,
  next_spin_refill_at  timestamptz,
  welcome_claimed_at   timestamptz,
  last_spin_at         timestamptz,
  last_daily_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.profiles
  add column if not exists is_admin             boolean not null default false,
  add column if not exists spins_remaining      int     not null default 3,
  add column if not exists next_spin_refill_at  timestamptz,
  add column if not exists welcome_claimed_at   timestamptz,
  add column if not exists last_spin_at         timestamptz,
  add column if not exists last_daily_at        timestamptz;

alter table public.profiles
  alter column chips type bigint;

alter table public.profiles
  alter column chips set default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_chips_chk') then
    alter table public.profiles
      add constraint profiles_chips_chk check (chips >= 0);
  end if;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
  on public.profiles for select to authenticated
  using (user_id = auth.uid());

create or replace function public.profiles_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.profiles_touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Welcome bonus + hourly spin wheel.
-- =====================================================================

-- One-time 10M welcome bonus, claimed via the lobby popup the first
-- time a user signs in.
create or replace function public.claim_welcome_bonus()
returns table(amount int, total_chips int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_amount int := 10000000;
  v_claimed timestamptz;
  v_total int;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select welcome_claimed_at into v_claimed
    from public.profiles
   where user_id = v_uid
   for update;

  if v_claimed is not null then
    raise exception 'welcome bonus already claimed' using errcode = 'P0001';
  end if;

  update public.profiles
     set chips = chips + v_amount,
         welcome_claimed_at = now()
   where user_id = v_uid
  returning chips into v_total;

  return query select v_amount, v_total;
end;
$$;

grant execute on function public.claim_welcome_bonus() to authenticated;

-- Spin the chip wheel. Picks a weighted-random prize (50K..10M) from
-- the 8 wedges, credits the user, and stamps the cooldown. Returns
-- the segment index so the client can land the reel on the right
-- wedge during the animation. 3 free spins per hour: cooldown only
-- starts running once the player burns through all three.
drop function if exists public.spin_wheel();

create or replace function public.spin_wheel()
returns table(
  prize int,
  segment_index int,
  total_chips int,
  spins_remaining int,
  next_refill_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_cooldown interval := interval '1 hour';
  v_remaining int;
  v_refill_at timestamptz;
  v_prizes int[]  := array[50000, 100000, 250000, 500000, 1000000, 2000000, 5000000, 10000000];
  v_weights int[] := array[35, 25, 15, 10, 8, 5, 1, 1];
  v_total_w int := 100;
  v_roll int;
  v_acc int := 0;
  v_loop_i int;
  v_picked int;
  v_prize int;
  v_total int;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select p.spins_remaining, p.next_spin_refill_at
    into v_remaining, v_refill_at
    from public.profiles p
   where p.user_id = v_uid
   for update;

  -- Lazy refill: when the cooldown expires top the bar back to 3.
  if v_refill_at is not null and v_now >= v_refill_at then
    v_remaining := 3;
    v_refill_at := null;
  end if;

  if coalesce(v_remaining, 0) <= 0 then
    raise exception 'spin cooldown active' using errcode = 'P0001';
  end if;

  v_roll := floor(random() * v_total_w)::int + 1;
  -- PL/pgSQL `FOR i IN 1..N LOOP` declares an inner loop variable
  -- that shadows the outer scope, so the function-level variable is
  -- left undefined after the loop. Copy the winning index into
  -- v_picked before exit so the returned segment_index is non-null.
  for v_loop_i in 1..array_length(v_weights, 1) loop
    v_acc := v_acc + v_weights[v_loop_i];
    if v_roll <= v_acc then
      v_prize := v_prizes[v_loop_i];
      v_picked := v_loop_i;
      exit;
    end if;
  end loop;

  v_remaining := v_remaining - 1;
  -- Burning the last spin starts the cooldown countdown.
  if v_remaining <= 0 then
    v_refill_at := v_now + v_cooldown;
  end if;

  update public.profiles as p
     set chips               = p.chips + v_prize,
         spins_remaining     = v_remaining,
         next_spin_refill_at = v_refill_at,
         last_spin_at        = v_now
   where p.user_id = v_uid
  returning p.chips into v_total;

  return query select v_prize, v_picked - 1, v_total, v_remaining, v_refill_at;
end;
$$;

grant execute on function public.spin_wheel() to authenticated;

-- Daily top-up bonus claimed from the lobby's "+" panel; one free 1M
-- chip drop per 24 hours.
create or replace function public.claim_daily_bonus()
returns table(prize int, total_chips int, next_claim_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_cooldown interval := interval '24 hours';
  v_amount int := 1000000;
  v_last timestamptz;
  v_total int;
begin
  if v_uid is null then
    raise exception 'auth required' using errcode = '42501';
  end if;

  select last_daily_at into v_last
    from public.profiles
   where user_id = v_uid
   for update;

  if v_last is not null and v_last + v_cooldown > v_now then
    raise exception 'daily bonus on cooldown' using errcode = 'P0001';
  end if;

  update public.profiles
     set chips = chips + v_amount,
         last_daily_at = v_now
   where user_id = v_uid
  returning chips into v_total;

  return query select v_amount, v_total, v_now + v_cooldown;
end;
$$;

grant execute on function public.claim_daily_bonus() to authenticated;

-- Backfill seat numbers for legacy rows, then enforce non-null + constraints.
with ranked as (
  select id, row_number() over (partition by room_id order by joined_at) as rn
    from public.players
)
update public.players p set seat_number = r.rn
  from ranked r where p.id = r.id and p.seat_number is null;

alter table public.players alter column seat_number set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_seat_number_chk') then
    alter table public.players
      add constraint players_seat_number_chk check (seat_number between 1 and 9);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'players_room_seat_unique') then
    alter table public.players
      add constraint players_room_seat_unique unique (room_id, seat_number);
  end if;
end $$;

-- Auto-assign a random unused seat (1..9) when a player joins. The
-- random pick keeps consecutive rejoins from always landing the same
-- chair. Raises if the table is full so the client can surface a
-- friendly error.
create or replace function public.assign_seat_number()
returns trigger
language plpgsql
as $$
declare
  v_taken int[];
  v_available int[];
  v_total int;
begin
  if new.seat_number is not null then
    return new;
  end if;

  select coalesce(array_agg(seat_number), array[]::int[])
    into v_taken
    from public.players
   where room_id = new.room_id;

  select coalesce(array_agg(s), array[]::int[])
    into v_available
    from generate_series(1, 9) as s
   where not (s = any(v_taken));

  v_total := coalesce(array_length(v_available, 1), 0);
  if v_total = 0 then
    raise exception 'Room is full (9 players maximum)' using errcode = 'P0001';
  end if;

  new.seat_number := v_available[1 + floor(random() * v_total)::int];
  return new;
end;
$$;

drop trigger if exists players_assign_seat on public.players;
create trigger players_assign_seat
  before insert on public.players
  for each row execute function public.assign_seat_number();

create index if not exists players_room_id_idx on public.players (room_id);
create index if not exists players_last_seen_idx on public.players (last_seen);

-- When a player joins, seed their chips from the table's buy-in range
-- and deduct that buy-in from the user's main bankroll. The range runs
-- from a minimum of 20×big_blind (MIN_BUY_IN_BB — the floor needed to
-- sit) up to app_settings.buy_in_bb × big_blind (the max, default
-- 100×). A player sits with min(balance, max buy-in) and is rejected if
-- their balance is below the minimum. Anonymous joins skip the
-- deduction and take the full max buy-in.
--
-- SECURITY DEFINER so the inner UPDATE on `profiles` bypasses the
-- self-only RLS read policy — RLS would otherwise drop the UPDATE
-- silently and the trigger would mistakenly think the bankroll is
-- empty.
create or replace function public.player_default_chips()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bb bigint;
  v_mult int;
  v_min_buyin bigint;
  v_max_buyin bigint;
  v_buyin bigint;
  v_balance bigint;
begin
  select big_blind into v_bb from public.rooms where id = new.room_id;
  select buy_in_bb into v_mult from public.app_settings where id = 1;
  v_min_buyin := coalesce(v_bb, 20) * 20;          -- MIN_BUY_IN_BB
  v_max_buyin := coalesce(v_bb, 20) * coalesce(v_mult, 100);

  if new.user_id is not null then
    select chips into v_balance
      from public.profiles
     where user_id = new.user_id
     for update;

    if coalesce(v_balance, 0) < v_min_buyin then
      raise exception 'Not enough main chips. Minimum buy-in is %, you have %.',
        v_min_buyin, coalesce(v_balance, 0)
        using errcode = 'P0001';
    end if;

    -- Sit with the full max buy-in when affordable; otherwise just the
    -- minimum, leaving the rest of the bankroll intact.
    v_buyin := case when v_balance >= v_max_buyin then v_max_buyin
                    else v_min_buyin end;
    new.chips := v_buyin;

    update public.profiles
       set chips = chips - v_buyin
     where user_id = new.user_id;
  else
    new.chips := v_max_buyin;
  end if;

  return new;
end;
$$;

drop trigger if exists players_default_chips on public.players;
create trigger players_default_chips
  before insert on public.players
  for each row execute function public.player_default_chips();

-- Grace timer when a player joins a waiting room. Reuses
-- `between_hand_seconds` (admin knob, default 5s) so newly seated
-- players get a beat before the auto-dealer fires the next hand.
create or replace function public.player_join_waiting_timer()
returns trigger
language plpgsql
as $$
declare
  v_phase text;
  v_delay int;
  v_active int;
  v_now timestamptz := now();
begin
  if coalesce(new.chips, 0) <= 0 then return new; end if;

  select phase into v_phase from public.rooms where id = new.room_id;
  if v_phase is distinct from 'waiting' then return new; end if;

  select between_hand_seconds into v_delay from public.timing_settings();
  v_delay := greatest(coalesce(v_delay, 5), 3);

  select count(*)::int into v_active
    from public.players
   where room_id = new.room_id and chips > 0;
  if v_active < 2 then return new; end if;

  update public.rooms
     set phase_ends_at = greatest(
       coalesce(phase_ends_at, v_now),
       v_now + make_interval(secs => v_delay)
     )
   where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists players_waiting_timer on public.players;
create trigger players_waiting_timer
  after insert on public.players
  for each row execute function public.player_join_waiting_timer();

drop table if exists public.voting_rounds;

-- =====================================================================
-- Realtime
-- =====================================================================
alter table public.rooms        replica identity full;
alter table public.players      replica identity full;
alter table public.profiles     replica identity full;
alter table public.app_settings replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
  ) then
    execute 'alter publication supabase_realtime add table public.rooms';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    execute 'alter publication supabase_realtime add table public.players';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings'
  ) then
    execute 'alter publication supabase_realtime add table public.app_settings';
  end if;
end $$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.rooms   enable row level security;
alter table public.players enable row level security;

drop policy if exists "rooms_select_all"  on public.rooms;
drop policy if exists "rooms_insert_all" on public.rooms;
drop policy if exists "players_anon_all" on public.players;

create policy "rooms_select_all"
  on public.rooms for select to anon, authenticated using (true);

create policy "rooms_insert_all"
  on public.rooms for insert to anon, authenticated with check (true);

create policy "players_anon_all"
  on public.players for all to anon, authenticated using (true) with check (true);

-- =====================================================================
-- Deck helper
-- =====================================================================
-- Build and shuffle a standard 52-card deck (codes like AS, 10H).
create or replace function public.new_shuffled_deck()
returns jsonb
language plpgsql
as $$
declare
  ranks text[] := array['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  suits text[] := array['S','H','D','C'];
  deck jsonb := '[]'::jsonb;
  r text;
  s text;
  i int;
  j int;
  tmp jsonb;
  n int;
begin
  foreach r in array ranks loop
    foreach s in array suits loop
      deck := deck || jsonb_build_array(r || s);
    end loop;
  end loop;

  n := jsonb_array_length(deck);
  for i in reverse n-1..1 loop
    j := floor(random() * (i + 1))::int;
    tmp := deck->i;
    deck := jsonb_set(deck, array[i::text], deck->j);
    deck := jsonb_set(deck, array[j::text], tmp);
  end loop;

  return deck;
end;
$$;

-- =====================================================================
-- Drop legacy ownership / planning-poker RPCs (auto-dealer takes over)
-- =====================================================================
drop function if exists public.kick_player(text, uuid, uuid);
drop function if exists public.transfer_room_ownership(text, uuid, uuid);
drop function if exists public.is_room_owner(text, uuid);
drop function if exists public.current_room_owner(text);
drop function if exists public.reveal_room(text, uuid);
drop function if exists public.reset_room(text, uuid);
drop function if exists public.update_room_deck(text, uuid, jsonb);

-- Betting, pot, hand resolution, and the idempotent auto-dealer
-- `start_hand` live in supabase/betting.sql. Run it after this file.
