-- Run after schema.sql (or merge into a fresh install).
-- Adds chips, pot, betting actions, and the auto-dealer flow.

alter table public.rooms add column if not exists pot bigint not null default 0;
alter table public.rooms add column if not exists current_bet bigint not null default 0;
alter table public.rooms add column if not exists last_raise bigint not null default 0;
alter table public.rooms add column if not exists action_player_id uuid;
alter table public.rooms add column if not exists dealer_player_id uuid;
alter table public.rooms add column if not exists small_blind bigint not null default 10;
alter table public.rooms add column if not exists big_blind bigint not null default 20;
alter table public.rooms add column if not exists acts_remaining int not null default 0;
alter table public.rooms add column if not exists winners jsonb;

alter table public.players add column if not exists chips bigint not null default 1000;
alter table public.players add column if not exists bet_street bigint not null default 0;
alter table public.players add column if not exists folded boolean not null default false;
alter table public.players add column if not exists all_in boolean not null default false;

-- Widen money columns to bigint so high tiers (Elite/VIP) don't blow
-- past the 2.1B int4 ceiling on buy-ins, pots, bets, and blinds.
alter table public.rooms   alter column pot         type bigint;
alter table public.rooms   alter column current_bet type bigint;
alter table public.rooms   alter column last_raise  type bigint;
alter table public.rooms   alter column small_blind type bigint;
alter table public.rooms   alter column big_blind   type bigint;
alter table public.players alter column chips        type bigint;
alter table public.players alter column bet_street   type bigint;

-- =====================================================================
-- Seat helpers (order by joined_at)
-- =====================================================================
create or replace function public.room_seat_ids(p_room_id text)
returns uuid[]
language sql
stable
as $$
  select coalesce(array_agg(id order by seat_number), array[]::uuid[])
  from public.players
  where room_id = p_room_id;
$$;

create or replace function public.seat_index(p_seats uuid[], p_player_id uuid)
returns int
language sql
immutable
as $$
  select coalesce(
    (select ord::int - 1
     from unnest(p_seats) with ordinality as t(id, ord)
     where id = p_player_id),
    -1
  );
$$;

create or replace function public.next_seat_player(
  p_seats uuid[],
  p_from_id uuid,
  p_skip_folded boolean default true
)
returns uuid
language plpgsql
stable
as $$
declare
  v_idx int;
  v_n int;
  v_i int;
  v_id uuid;
  v_folded boolean;
begin
  v_n := coalesce(array_length(p_seats, 1), 0);
  if v_n = 0 then return null; end if;
  v_idx := public.seat_index(p_seats, p_from_id);
  if v_idx < 0 then return p_seats[1]; end if;

  for v_i in 1..v_n loop
    v_idx := (v_idx + 1) % v_n;
    v_id := p_seats[v_idx + 1];
    if not p_skip_folded then return v_id; end if;
    select folded into v_folded from public.players where id = v_id;
    if not coalesce(v_folded, false) then return v_id; end if;
  end loop;
  return null;
end;
$$;

create or replace function public.count_not_folded(p_room_id text)
returns int
language sql
stable
as $$
  select count(*)::int from public.players
  where room_id = p_room_id
    and not folded
    and jsonb_array_length(coalesce(hole_cards, '[]'::jsonb)) = 2;
$$;

create or replace function public.count_can_act(p_room_id text)
returns int
language sql
stable
as $$
  select count(*)::int from public.players
  where room_id = p_room_id
    and not folded
    and not all_in
    and chips > 0
    and jsonb_array_length(coalesce(hole_cards, '[]'::jsonb)) = 2;
$$;

-- Post chips from player to pot
drop function if exists public.player_commit(uuid, int);
create or replace function public.player_commit(
  p_player_id uuid,
  p_amount bigint
)
returns bigint
language plpgsql
as $$
declare
  v_chips bigint;
  v_pay bigint;
  v_room_id text;
begin
  select chips, room_id into v_chips, v_room_id
  from public.players where id = p_player_id for update;
  v_pay := least(greatest(p_amount, 0), v_chips);
  update public.players
     set chips = chips - v_pay,
         bet_street = bet_street + v_pay,
         all_in = (v_chips - v_pay <= 0)
   where id = p_player_id;
  update public.rooms set pot = pot + v_pay where id = v_room_id;
  return v_pay;
end;
$$;

create or replace function public.award_pot_to(p_room_id text, p_winner_id uuid)
returns void
language plpgsql
as $$
declare
  v_pot bigint;
begin
  select pot into v_pot from public.rooms where id = p_room_id for update;
  update public.players set chips = chips + v_pot where id = p_winner_id;
  update public.rooms set pot = 0 where id = p_room_id;
end;
$$;

-- =====================================================================
-- Timing source of truth: read from app_settings so admin changes
-- propagate to existing rooms without a per-room sync step.
-- =====================================================================
create or replace function public.timing_settings()
returns table(
  action_timeout_seconds int,
  between_hand_seconds int,
  showdown_seconds int,
  reveal_seconds int
)
language sql
stable
as $$
  select
    coalesce(action_timeout_seconds, 45)::int,
    coalesce(between_hand_seconds, 5)::int,
    coalesce(showdown_seconds, 20)::int,
    coalesce(reveal_seconds, 3)::int
  from public.app_settings
  where id = 1;
$$;

-- After a hand ends the room sits in `waiting` for `between_hand_seconds`
-- (admin-configurable, default 5s) before the auto-dealer fires again.
create or replace function public.reset_hand_state(p_room_id text)
returns void
language plpgsql
as $$
declare
  v_between int;
begin
  select between_hand_seconds into v_between from public.timing_settings();
  v_between := coalesce(v_between, 5);

  update public.players
     set hole_cards = null,
         bet_street = 0,
         folded = false,
         all_in = false,
         last_action = null,
         last_action_amount = 0
   where room_id = p_room_id;
  update public.rooms
     set phase = 'waiting',
         community_cards = '[]'::jsonb,
         deck_remaining = '[]'::jsonb,
         pot = 0,
         current_bet = 0,
         last_raise = 0,
         action_player_id = null,
         acts_remaining = 0,
         winners = null,
         phase_ends_at = now() + make_interval(secs => v_between)
   where id = p_room_id;
end;
$$;

create or replace function public.deal_community(
  p_room record,
  p_count int
)
returns jsonb
language plpgsql
as $$
declare
  v_deck jsonb;
begin
  v_deck := coalesce(p_room.deck_remaining, '[]'::jsonb);
  if jsonb_array_length(v_deck) < p_count + 1 then
    raise exception 'Not enough cards in deck';
  end if;
  return (
    select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
    from jsonb_array_elements(v_deck) with ordinality as t(elem, ord)
    where ord > p_count
  );
end;
$$;

create or replace function public.next_action_player(
  p_room_id text,
  p_start uuid
)
returns uuid
language plpgsql
stable
as $$
declare
  v_seats uuid[];
  v_cur uuid;
  v_i int;
  v_n int;
  v_p public.players%rowtype;
begin
  v_seats := public.room_seat_ids(p_room_id);
  v_n := coalesce(array_length(v_seats, 1), 0);
  if v_n = 0 then return null; end if;
  v_cur := p_start;
  if v_cur is null then v_cur := v_seats[1]; end if;

  for v_i in 1..v_n loop
    select * into v_p from public.players where id = v_cur;
    if not v_p.folded
       and not v_p.all_in
       and v_p.chips > 0
       and jsonb_array_length(coalesce(v_p.hole_cards, '[]'::jsonb)) = 2 then
      return v_cur;
    end if;
    v_cur := public.next_seat_player(v_seats, v_cur, true);
  end loop;
  return null;
end;
$$;

create or replace function public.betting_round_done(p_room_id text)
returns boolean
language plpgsql
stable
as $$
declare
  v_room public.rooms%rowtype;
  v_unmatched int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if v_room.acts_remaining <= 0 then
    select count(*)::int into v_unmatched
    from public.players
    where room_id = p_room_id
      and not folded
      and not all_in
      and chips > 0
      and jsonb_array_length(coalesce(hole_cards, '[]'::jsonb)) = 2
      and bet_street < v_room.current_bet;
    return v_unmatched = 0;
  end if;
  return false;
end;
$$;

create or replace function public.complete_betting_round(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_seats uuid[];
  v_dealer uuid;
  v_first uuid;
  v_deck jsonb;
  v_not_folded int;
  v_can_act int;
  v_action_sec int;
  v_showdown_sec int;
  v_reveal_sec int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  v_seats := public.room_seat_ids(p_room_id);

  select action_timeout_seconds, showdown_seconds, reveal_seconds
    into v_action_sec, v_showdown_sec, v_reveal_sec
  from public.timing_settings();
  v_action_sec := coalesce(v_action_sec, 45);
  v_showdown_sec := coalesce(v_showdown_sec, 20);
  v_reveal_sec := coalesce(v_reveal_sec, 3);

  update public.players
     set bet_street = 0,
         last_action = null,
         last_action_amount = 0
   where room_id = p_room_id;
  update public.rooms
     set current_bet = 0,
         last_raise = 0,
         acts_remaining = 0
   where id = p_room_id;

  v_not_folded := public.count_not_folded(p_room_id);
  if v_not_folded <= 1 then
    select id into v_first from public.players
     where room_id = p_room_id
       and not folded
       and jsonb_array_length(coalesce(hole_cards, '[]'::jsonb)) = 2
     limit 1;
    if v_first is not null then
      perform public.award_pot_to(p_room_id, v_first);
    end if;
    perform public.reset_hand_state(p_room_id);
    return;
  end if;

  v_dealer := v_room.dealer_player_id;

  -- Re-fetch room because we just mutated it above.
  select * into v_room from public.rooms where id = p_room_id for update;

  if v_room.phase = 'preflop' then
    v_deck := coalesce(v_room.deck_remaining, '[]'::jsonb);
    update public.rooms
       set phase = 'flop',
           community_cards = jsonb_build_array(v_deck->1, v_deck->2, v_deck->3),
           deck_remaining = public.deal_community(v_room, 3)
     where id = p_room_id;
  elsif v_room.phase = 'flop' then
    v_deck := coalesce(v_room.deck_remaining, '[]'::jsonb);
    update public.rooms
       set phase = 'turn',
           community_cards = v_room.community_cards || jsonb_build_array(v_deck->1),
           deck_remaining = public.deal_community(v_room, 1)
     where id = p_room_id;
  elsif v_room.phase = 'turn' then
    v_deck := coalesce(v_room.deck_remaining, '[]'::jsonb);
    update public.rooms
       set phase = 'river',
           community_cards = v_room.community_cards || jsonb_build_array(v_deck->1),
           deck_remaining = public.deal_community(v_room, 1)
     where id = p_room_id;
  elsif v_room.phase = 'river' then
    update public.rooms
       set phase = 'showdown',
           action_player_id = null,
           phase_ends_at = now() + make_interval(secs => v_showdown_sec)
     where id = p_room_id;
    return;
  end if;

  v_can_act := public.count_can_act(p_room_id);

  if v_can_act <= 1 then
    update public.rooms
       set action_player_id = null,
           acts_remaining = 0,
           phase_ends_at = now() + make_interval(secs => v_reveal_sec)
     where id = p_room_id;
    return;
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  v_first := public.next_seat_player(v_seats, v_dealer, true);
  v_first := public.next_action_player(p_room_id, v_first);

  update public.rooms
     set action_player_id = v_first,
         acts_remaining = v_can_act,
         phase_ends_at = now() + make_interval(secs => v_action_sec)
   where id = p_room_id;
end;
$$;

create or replace function public.advance_action(p_room_id text)
returns void
language plpgsql
as $$
declare
  v_room public.rooms%rowtype;
  v_next uuid;
  v_seats uuid[];
  v_action_sec int;
  v_reveal_sec int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  select action_timeout_seconds, reveal_seconds
    into v_action_sec, v_reveal_sec
  from public.timing_settings();
  v_action_sec := coalesce(v_action_sec, 45);
  v_reveal_sec := coalesce(v_reveal_sec, 3);

  -- Hand effectively over (everyone but one folded). Stage a reveal
  -- pause so the last fold badge is readable; complete_betting_round
  -- (called by advance_phase once the timer expires) will award the
  -- pot and reset the hand.
  if public.count_not_folded(p_room_id) <= 1 then
    update public.rooms
       set action_player_id = null,
           acts_remaining = 0,
           phase_ends_at = now() + make_interval(secs => v_reveal_sec)
     where id = p_room_id;
    return;
  end if;

  -- Round closed (everyone matched + acts_remaining = 0). Stage the
  -- same pause so every player sees the closing action badge before
  -- complete_betting_round wipes bet_street + last_action and peels
  -- the next street.
  if public.betting_round_done(p_room_id) then
    update public.rooms
       set action_player_id = null,
           acts_remaining = 0,
           phase_ends_at = now() + make_interval(secs => v_reveal_sec)
     where id = p_room_id;
    return;
  end if;

  v_seats := public.room_seat_ids(p_room_id);
  v_next := public.next_seat_player(v_seats, v_room.action_player_id, true);
  v_next := public.next_action_player(p_room_id, v_next);

  update public.rooms
     set action_player_id = v_next,
         phase_ends_at = now() + make_interval(secs => v_action_sec)
   where id = p_room_id;
end;
$$;

-- =====================================================================
-- player_action
-- =====================================================================
drop function if exists public.player_action(text, uuid, text, int);
create or replace function public.player_action(
  p_room_id text,
  p_player_id uuid,
  p_action text,
  p_raise_to bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_player public.players%rowtype;
  v_pay bigint;
  v_to_call bigint;
  v_min_raise bigint;
  v_raise_total bigint;
  v_others_can_act int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;
  if v_room.phase in ('waiting', 'showdown') then
    raise exception 'No betting in this phase';
  end if;
  if v_room.action_player_id is distinct from p_player_id then
    raise exception 'Not your turn';
  end if;

  select * into v_player from public.players where id = p_player_id for update;
  if v_player.folded or v_player.all_in then
    raise exception 'Cannot act';
  end if;

  v_to_call := v_room.current_bet - v_player.bet_street;

  if p_action = 'fold' then
    update public.players
       set folded = true,
           last_action = 'fold',
           last_action_amount = 0
     where id = p_player_id;
    update public.rooms set acts_remaining = greatest(acts_remaining - 1, 0)
     where id = p_room_id;
    perform public.advance_action(p_room_id);
    return;
  end if;

  if p_action = 'check' then
    if v_to_call > 0 then raise exception 'Cannot check, must call or fold'; end if;
    update public.players
       set last_action = 'check',
           last_action_amount = 0
     where id = p_player_id;
    update public.rooms set acts_remaining = greatest(acts_remaining - 1, 0)
     where id = p_room_id;
    perform public.advance_action(p_room_id);
    return;
  end if;

  if p_action = 'call' then
    if v_to_call <= 0 then raise exception 'Nothing to call'; end if;
    v_pay := public.player_commit(p_player_id, v_to_call);
    update public.players
       set last_action = 'call',
           last_action_amount = v_pay
     where id = p_player_id;
    update public.rooms set acts_remaining = greatest(acts_remaining - 1, 0)
     where id = p_room_id;
    perform public.advance_action(p_room_id);
    return;
  end if;

  if p_action = 'all_in' then
    v_pay := public.player_commit(p_player_id, v_player.chips);
    select bet_street into v_raise_total from public.players where id = p_player_id;
    update public.players
       set last_action = 'all_in',
           last_action_amount = v_raise_total
     where id = p_player_id;
    if v_raise_total > v_room.current_bet then
      -- Treat as a raise: every other able player owes a response.
      select count(*)::int into v_others_can_act
        from public.players
       where room_id = p_room_id
         and id <> p_player_id
         and not folded and not all_in and chips > 0;
      update public.rooms
         set current_bet = v_raise_total,
             last_raise = v_raise_total - v_room.current_bet,
             acts_remaining = v_others_can_act
       where id = p_room_id;
    else
      update public.rooms set acts_remaining = greatest(acts_remaining - 1, 0)
       where id = p_room_id;
    end if;
    perform public.advance_action(p_room_id);
    return;
  end if;

  if p_action = 'raise' then
    if p_raise_to is null then raise exception 'raise_to required'; end if;
    v_min_raise := v_room.current_bet + greatest(v_room.last_raise, v_room.big_blind);
    v_raise_total := greatest(p_raise_to, v_min_raise);
    if v_raise_total <= v_room.current_bet then
      raise exception 'Raise must exceed current bet';
    end if;
    v_pay := public.player_commit(p_player_id, v_raise_total - v_player.bet_street);
    select bet_street into v_raise_total from public.players where id = p_player_id;
    update public.players
       set last_action = 'raise',
           last_action_amount = v_raise_total
     where id = p_player_id;
    select count(*)::int into v_others_can_act
      from public.players
     where room_id = p_room_id
       and id <> p_player_id
       and not folded and not all_in and chips > 0;
    update public.rooms
       set current_bet = v_raise_total,
           last_raise = v_raise_total - v_room.current_bet,
           acts_remaining = v_others_can_act
     where id = p_room_id;
    perform public.advance_action(p_room_id);
    return;
  end if;

  raise exception 'Unknown action: %', p_action;
end;
$$;

create or replace function public.action_timeout(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.action_player_id is null then return; end if;
  if v_room.phase_ends_at is not null and now() < v_room.phase_ends_at then
    raise exception 'Action timer not expired';
  end if;
  perform public.player_action(p_room_id, v_room.action_player_id, 'fold');
end;
$$;

-- =====================================================================
-- Auto-dealer: callable by ANY client, idempotent under row lock.
-- Honors the 5-second cooldown set by `reset_hand_state`.
-- =====================================================================
drop function if exists public.start_hand(text, uuid);

create or replace function public.start_hand(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck jsonb;
  v_idx int := 0;
  v_player record;
  v_active_count int;
  v_phase text;
  v_phase_ends_at timestamptz;
  v_seats uuid[];
  v_n int;
  v_sb uuid;
  v_bb uuid;
  v_first uuid;
  v_dealer uuid;
  v_sb_amt bigint;
  v_bb_amt bigint;
  v_action_sec int;
begin
  select phase, phase_ends_at
    into v_phase, v_phase_ends_at
  from public.rooms where id = p_room_id for update;

  if not found then
    raise exception 'Room not found';
  end if;
  -- Idempotent: silently no-op if a hand is already running.
  if v_phase is distinct from 'waiting' then return; end if;
  -- Respect inter-hand cooldown (5s after showdown).
  if v_phase_ends_at is not null and now() < v_phase_ends_at then return; end if;

  -- Only count funded players as eligible for the next hand. Broke
  -- players stay seated but sit out as spectators.
  select count(*) into v_active_count
    from public.players where room_id = p_room_id and chips > 0;
  if v_active_count < 2 then return; end if;

  -- Active seat list (chips > 0), ordered by join time.
  select coalesce(array_agg(id order by seat_number), array[]::uuid[])
    into v_seats
  from public.players where room_id = p_room_id and chips > 0;
  v_n := array_length(v_seats, 1);

  select dealer_player_id into v_dealer from public.rooms where id = p_room_id;
  if v_dealer is null or public.seat_index(v_seats, v_dealer) < 0 then
    v_dealer := v_seats[1];
  else
    v_dealer := public.next_seat_player(v_seats, v_dealer, false);
  end if;

  if v_n = 2 then
    v_sb := v_dealer;
    v_bb := public.next_seat_player(v_seats, v_dealer, false);
    v_first := v_dealer;
  else
    v_sb := public.next_seat_player(v_seats, v_dealer, false);
    v_bb := public.next_seat_player(v_seats, v_sb, false);
    v_first := public.next_seat_player(v_seats, v_bb, false);
  end if;

  -- Reset state for everyone (broke players stay at chips = 0).
  update public.players
     set bet_street = 0, folded = false, all_in = false, hole_cards = null,
         last_action = null, last_action_amount = 0
   where room_id = p_room_id;

  select small_blind, big_blind into v_sb_amt, v_bb_amt from public.rooms where id = p_room_id;

  perform public.player_commit(v_sb, v_sb_amt);
  perform public.player_commit(v_bb, v_bb_amt);

  v_deck := public.new_shuffled_deck();
  -- Deal hole cards to ACTIVE players only, clockwise by seat number.
  for v_player in
    select id from public.players
      where room_id = p_room_id and chips > 0
      order by seat_number
  loop
    update public.players
       set hole_cards = jsonb_build_array(v_deck->v_idx, v_deck->(v_idx+1))
     where id = v_player.id;
    v_idx := v_idx + 2;
  end loop;

  select action_timeout_seconds into v_action_sec from public.timing_settings();
  v_action_sec := coalesce(v_action_sec, 45);

  update public.rooms
     set phase = 'preflop',
         dealer_player_id = v_dealer,
         community_cards = '[]'::jsonb,
         deck_remaining = (
           select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
           from jsonb_array_elements(v_deck) with ordinality as t(elem, ord)
           where ord > v_idx
         ),
         pot = (select coalesce(sum(bet_street), 0) from public.players where room_id = p_room_id),
         current_bet = v_bb_amt,
         last_raise = v_bb_amt,
         action_player_id = public.next_action_player(p_room_id, v_first),
         acts_remaining = public.count_can_act(p_room_id),
         winners = null,
         phase_ends_at = now() + make_interval(secs => v_action_sec)
   where id = p_room_id;
end;
$$;

-- end_showdown: after winners resolved client-side
create or replace function public.end_showdown(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.phase is distinct from 'showdown' then return; end if;
  if v_room.phase_ends_at is not null and now() < v_room.phase_ends_at then
    raise exception 'Showdown not finished';
  end if;
  perform public.reset_hand_state(p_room_id);
end;
$$;

create or replace function public.apply_showdown_winners(
  p_room_id text,
  p_winners jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_pot bigint;
  v_count int;
  v_share bigint;
  w jsonb;
  v_pid uuid;
  v_showdown_sec int;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if v_room.phase is distinct from 'showdown' then
    raise exception 'Not in showdown';
  end if;
  if v_room.winners is not null then return; end if;

  select showdown_seconds into v_showdown_sec from public.timing_settings();
  v_showdown_sec := coalesce(v_showdown_sec, 20);
  v_pot := v_room.pot;
  v_count := jsonb_array_length(p_winners);
  if v_count <= 0 then
    perform public.reset_hand_state(p_room_id);
    return;
  end if;

  v_share := v_pot / v_count;
  for w in select * from jsonb_array_elements(p_winners) loop
    v_pid := (w->>'player_id')::uuid;
    update public.players set chips = chips + v_share where id = v_pid;
  end loop;

  update public.rooms
     set pot = 0,
         winners = p_winners,
         phase_ends_at = now() + make_interval(secs => v_showdown_sec)
   where id = p_room_id;
end;
$$;

revoke all on function public.start_hand(text) from public;
revoke all on function public.player_action(text, uuid, text, bigint) from public;
revoke all on function public.action_timeout(text) from public;
revoke all on function public.end_showdown(text) from public;
revoke all on function public.apply_showdown_winners(text, jsonb) from public;

grant execute on function public.start_hand(text) to anon, authenticated;
grant execute on function public.player_action(text, uuid, text, bigint) to anon, authenticated;
grant execute on function public.action_timeout(text) to anon, authenticated;
grant execute on function public.end_showdown(text) to anon, authenticated;
grant execute on function public.apply_showdown_winners(text, jsonb) to anon, authenticated;

-- advance_phase drives: action timeout, showdown end, or the all-in
-- auto-reveal between streets.
create or replace function public.advance_phase(p_room_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'Room not found'; end if;

  if v_room.phase = 'showdown' then
    perform public.end_showdown(p_room_id);
    return;
  end if;

  if v_room.phase_ends_at is null or now() < v_room.phase_ends_at then
    return;
  end if;

  if v_room.action_player_id is not null then
    perform public.action_timeout(p_room_id);
    return;
  end if;

  -- Mid-hand and nobody can act (e.g. everyone all-in): peel the next
  -- street; complete_betting_round handles river -> showdown on its own.
  if v_room.phase in ('preflop', 'flop', 'turn', 'river') then
    perform public.complete_betting_round(p_room_id);
  end if;
end;
$$;
