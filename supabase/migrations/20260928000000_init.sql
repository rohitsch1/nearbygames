-- =============================================================================
-- nearbygames — initial schema
--
-- Core rule, enforced here in the database (not just the UI):
--   * Free games are a REQUEST  -> join_requests, host must accept.
--   * Paid games are a TRANSACTION -> payment confirmed == you're in.
--
-- Privacy rule: a user's own location is never stored in a readable column.
-- Home location lives in profile_private (owner-only RLS); other users only
-- ever receive a rounded distance computed by SECURITY DEFINER functions.
--
-- Money is stored in paise (integer) everywhere.
-- =============================================================================

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.sport as enum (
  'football', 'cricket', 'badminton', 'basketball', 'tennis', 'table_tennis',
  'volleyball', 'pickleball', 'chess', 'gaming', 'running', 'other'
);
create type public.occupation as enum ('student', 'working', 'resident');
create type public.game_status as enum ('open', 'cancelled');
create type public.request_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.payment_method as enum ('wallet', 'upi', 'card', 'in_person');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payment_purpose as enum ('game', 'topup');
create type public.wallet_tx_kind as enum ('topup', 'game_payment', 'host_earning', 'refund', 'adjustment');
create type public.join_via as enum ('host', 'request', 'payment');

-- -----------------------------------------------------------------------------
-- Profiles (public-ish) + private profile + wallet
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text check (char_length(full_name) between 1 and 60),
  avatar_url        text,
  area_name         text check (char_length(area_name) <= 80),
  occupation        public.occupation,
  id_verified       boolean not null default false,
  sports            public.sport[] not null default '{}',
  no_shows          integer not null default 0 check (no_shows >= 0),
  profile_prompted  boolean not null default false,  -- saw the "complete profile" step
  tour_completed    boolean not null default false,  -- finished the welcome tour
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.profile_private (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  home_location  extensions.geography(point, 4326),
  updated_at     timestamptz not null default now()
);

create table public.wallets (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  balance_paise  bigint not null default 0 check (balance_paise >= 0),
  updated_at     timestamptz not null default now()
);

-- A user can pay / charge only once the fuller profile is complete.
create or replace function public.can_transact(p public.profiles)
returns boolean language sql immutable as $$
  select p.full_name is not null
     and p.area_name is not null
     and p.occupation is not null
     and p.id_verified
$$;

-- -----------------------------------------------------------------------------
-- Games
-- -----------------------------------------------------------------------------
create table public.games (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  host_id           uuid not null references public.profiles (id) on delete cascade,
  sport             public.sport not null,
  spot_name         text not null check (char_length(spot_name) between 2 and 80),
  city              text check (char_length(city) <= 60),
  city_slug         text generated always as (
                      nullif(regexp_replace(lower(coalesce(city, '')), '[^a-z0-9]+', '-', 'g'), '')
                    ) stored,
  notes             text check (char_length(notes) <= 500),
  photo_url         text,
  location          extensions.geography(point, 4326) not null,
  lat               double precision not null check (lat between -90 and 90),
  lng               double precision not null check (lng between -180 and 180),
  starts_at         timestamptz not null,
  duration_minutes  integer not null default 90 check (duration_minutes between 15 and 600),
  capacity          integer not null check (capacity between 2 and 100),   -- total players incl. host
  is_paid           boolean not null default false,
  fee_paise         integer not null default 0 check (fee_paise >= 0 and fee_paise <= 1000000),
  players_count     integer not null default 0,   -- maintained by trigger
  status            public.game_status not null default 'open',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint paid_has_fee check ((is_paid and fee_paise >= 1000) or (not is_paid and fee_paise = 0))
);
create index games_location_idx on public.games using gist (location);
create index games_starts_at_idx on public.games (starts_at) where status = 'open';
create index games_host_idx on public.games (host_id);
create index games_sport_city_idx on public.games (sport, city_slug);

create table public.game_participants (
  game_id     uuid not null references public.games (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  joined_via  public.join_via not null,
  no_show     boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index game_participants_user_idx on public.game_participants (user_id);

create table public.join_requests (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games (id) on delete cascade,
  requester_id    uuid not null references public.profiles (id) on delete cascade,
  note            text check (char_length(note) <= 280),
  status          public.request_status not null default 'pending',
  decline_reason  text check (char_length(decline_reason) <= 200),
  -- Coarse distance from requester's home to the game, fixed at request time (never recomputed,
  -- so a host can't triangulate someone's home by moving the game pin).
  distance_band   text,
  created_at      timestamptz not null default now(),
  responded_at    timestamptz
);
-- At most one live request per person per game.
create unique index join_requests_one_pending on public.join_requests (game_id, requester_id)
  where status = 'pending';
create index join_requests_requester_idx on public.join_requests (requester_id, created_at desc);
create index join_requests_game_idx on public.join_requests (game_id, status);

-- -----------------------------------------------------------------------------
-- Chat: one conversation per (game, player) between host and that player.
-- It only exists once the player is actually in the game.
-- -----------------------------------------------------------------------------
create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references public.games (id) on delete cascade,
  host_id          uuid not null references public.profiles (id) on delete cascade,
  player_id        uuid not null references public.profiles (id) on delete cascade,
  last_message_at  timestamptz not null default now(),
  last_message     text,
  created_at       timestamptz not null default now(),
  unique (game_id, player_id)
);
create index conversations_host_idx on public.conversations (host_id, last_message_at desc);
create index conversations_player_idx on public.conversations (player_id, last_message_at desc);

create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  body             text not null check (char_length(btrim(body)) between 1 and 2000),
  client_id        uuid,            -- lets the client reconcile optimistic messages
  created_at       timestamptz not null default now(),
  unique (conversation_id, client_id)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Money
-- -----------------------------------------------------------------------------
create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  purpose               public.payment_purpose not null,
  game_id               uuid references public.games (id) on delete set null,
  method                public.payment_method not null,
  status                public.payment_status not null default 'pending',
  share_paise           integer not null default 0 check (share_paise >= 0),   -- goes to host
  platform_fee_paise    integer not null default 0 check (platform_fee_paise >= 0),
  amount_paise          integer generated always as (share_paise + platform_fee_paise) stored,
  provider_order_id     text unique,
  provider_payment_id   text unique,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint game_payment_has_game check (purpose <> 'game' or game_id is not null)
);
create index payments_user_idx on public.payments (user_id, created_at desc);

create table public.wallet_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  amount_paise  bigint not null,     -- signed: + credit, - debit
  kind          public.wallet_tx_kind not null,
  payment_id    uuid references public.payments (id) on delete set null,
  game_id       uuid references public.games (id) on delete set null,
  description   text,
  created_at    timestamptz not null default now()
);
create index wallet_tx_user_idx on public.wallet_transactions (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- In-app notifications (drive the toast + future push)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null,   -- request_received | request_accepted | request_declined | player_joined | message
  title       text not null,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- =============================================================================
-- Helpers
-- =============================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger games_touch before update on public.games
  for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- Platform fee: 5% of the share, minimum ₹5, maximum ₹50. Mirrored in src/lib/money.ts
create or replace function public.platform_fee(share_paise integer)
returns integer language sql immutable as $$
  select least(greatest(round(share_paise * 0.05)::integer, 500), 5000)
$$;

-- New auth user -> profile + private row + wallet
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 60), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  insert into public.profile_private (user_id) values (new.id) on conflict do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep games.location in sync with lat/lng, and compute a slug on insert.
create or replace function public.games_before_write()
returns trigger language plpgsql as $$
begin
  new.location := extensions.st_setsrid(extensions.st_makepoint(new.lng, new.lat), 4326)::extensions.geography;
  if tg_op = 'INSERT' then
    -- Server-controlled fields: never trust what the client sent.
    new.players_count := 0;
    new.status := 'open';
    new.slug := left(
      regexp_replace(lower(new.sport::text || '-' || new.spot_name || coalesce('-' || new.city, '')), '[^a-z0-9]+', '-', 'g'),
      60
    ) || '-' || substr(replace(new.id::text, '-', ''), 1, 6);
    new.slug := regexp_replace(new.slug, '-+', '-', 'g');
  end if;
  return new;
end $$;

create trigger games_before_write before insert or update of lat, lng on public.games
  for each row execute function public.games_before_write();

-- Host is always participant #1.
create or replace function public.games_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.game_participants (game_id, user_id, joined_via)
  values (new.id, new.host_id, 'host');
  return new;
end $$;

create trigger games_after_insert after insert on public.games
  for each row execute function public.games_after_insert();

-- players_count maintenance
create or replace function public.game_participants_count()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.games set players_count = players_count + 1 where id = new.game_id;
  elsif tg_op = 'DELETE' then
    update public.games set players_count = greatest(players_count - 1, 0) where id = old.game_id;
  end if;
  return null;
end $$;

create trigger game_participants_count after insert or delete on public.game_participants
  for each row execute function public.game_participants_count();

-- Guard against changing money/host fields after creation, and paid games needing a full profile.
create or replace function public.games_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  host public.profiles;
begin
  if tg_op = 'INSERT' then
    if new.starts_at < now() - interval '5 minutes' then
      raise exception 'Game must start in the future' using errcode = 'P0001';
    end if;
    select * into host from public.profiles where id = new.host_id;
    if host.full_name is null then
      raise exception 'Add your name before hosting' using errcode = 'P0001';
    end if;
    if new.is_paid and not public.can_transact(host) then
      raise exception 'Complete your profile to host paid games' using errcode = 'P0001';
    end if;
  elsif tg_op = 'UPDATE' then
    -- host_id / is_paid / fee_paise / players_count are not client-updatable (column grants below).
    if (new.lat <> old.lat or new.lng <> old.lng)
       and (old.players_count > 1 or exists (select 1 from public.join_requests where game_id = old.id)) then
      raise exception 'The location can''t be moved once players have joined or asked to join' using errcode = 'P0001';
    end if;
    if new.capacity < old.players_count then
      raise exception 'Capacity cannot be lower than players already in' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger games_guard before insert or update on public.games
  for each row execute function public.games_guard();

-- Internal: put a user in a game + open their chat with the host.
create or replace function public._admit_player(p_game public.games, p_user uuid, p_via public.join_via)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  conv_id uuid;
begin
  insert into public.game_participants (game_id, user_id, joined_via)
  values (p_game.id, p_user, p_via)
  on conflict do nothing;

  insert into public.conversations (game_id, host_id, player_id)
  values (p_game.id, p_game.host_id, p_user)
  on conflict (game_id, player_id) do update set game_id = excluded.game_id
  returning id into conv_id;

  -- Any still-pending request is now moot.
  update public.join_requests
     set status = 'accepted', responded_at = now()
   where game_id = p_game.id and requester_id = p_user and status = 'pending';

  return conv_id;
end $$;
revoke all on function public._admit_player(public.games, uuid, public.join_via) from public, anon, authenticated;

create or replace function public._notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, p_kind, p_title, p_body, p_link);
$$;
revoke all on function public._notify(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function public._display_name(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(split_part(full_name, ' ', 1), 'A player') from public.profiles where id = p_user
$$;

-- =============================================================================
-- RPCs (called from the app)
-- =============================================================================

-- Map query. Distance is from the point the caller passes in (their live
-- location or saved neighbourhood). That point is never stored.
create or replace function public.nearby_games(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer default 10000,
  p_sport public.sport default null,
  p_within_minutes integer default null,
  p_free_only boolean default false,
  p_limit integer default 200
)
returns table (
  id uuid, slug text, sport public.sport, spot_name text, city text, photo_url text,
  lat double precision, lng double precision, starts_at timestamptz, duration_minutes integer,
  capacity integer, players_count integer, is_paid boolean, fee_paise integer,
  host_id uuid, distance_m integer
)
language sql stable security definer set search_path = '' as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select g.id, g.slug, g.sport, g.spot_name, g.city, g.photo_url, g.lat, g.lng, g.starts_at,
         g.duration_minutes, g.capacity, g.players_count, g.is_paid, g.fee_paise, g.host_id,
         round(extensions.st_distance(g.location, o.g))::integer as distance_m
    from public.games g, origin o
   where g.status = 'open'
     and g.starts_at + make_interval(mins => g.duration_minutes) > now()
     and extensions.st_dwithin(g.location, o.g, least(greatest(p_radius_m, 500), 50000))
     and (p_sport is null or g.sport = p_sport)
     and (p_within_minutes is null or g.starts_at <= now() + make_interval(mins => p_within_minutes))
     and (not p_free_only or not g.is_paid)
   order by g.starts_at asc, distance_m asc
   limit least(greatest(p_limit, 1), 500);
$$;
grant execute on function public.nearby_games to anon, authenticated;

-- Ask to join a free game.
create or replace function public.request_to_join(p_game uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.games;
  req_id uuid;
begin
  if me is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select * into g from public.games where id = p_game;
  if not found or g.status <> 'open' then raise exception 'This game is no longer open' using errcode = 'P0001'; end if;
  if g.is_paid then raise exception 'Paid games are joined by paying, not by request' using errcode = 'P0001'; end if;
  if g.host_id = me then raise exception 'This is your own game' using errcode = 'P0001'; end if;
  if g.starts_at + make_interval(mins => g.duration_minutes) < now() then raise exception 'This game has already finished' using errcode = 'P0001'; end if;
  if exists (select 1 from public.game_participants where game_id = g.id and user_id = me) then
    raise exception 'You are already in this game' using errcode = 'P0001';
  end if;
  if g.players_count >= g.capacity then raise exception 'This game is full' using errcode = 'P0001'; end if;
  if exists (select 1 from public.join_requests where game_id = g.id and requester_id = me and status = 'declined') then
    raise exception 'The host has already declined a request from you for this game' using errcode = 'P0001';
  end if;
  if (select count(*) from public.join_requests where requester_id = me and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many requests — try again in a bit' using errcode = 'P0001';
  end if;

  insert into public.join_requests (game_id, requester_id, note, distance_band)
  values (
    g.id, me, nullif(btrim(p_note), ''),
    (select case
       when pp.home_location is null then null
       when extensions.st_distance(pp.home_location, g.location) < 1000 then 'under 1 km'
       when extensions.st_distance(pp.home_location, g.location) < 3000 then '1–3 km'
       when extensions.st_distance(pp.home_location, g.location) < 5000 then '3–5 km'
       when extensions.st_distance(pp.home_location, g.location) < 10000 then '5–10 km'
       else '10+ km' end
     from public.profile_private pp where pp.user_id = me)
  )
  returning id into req_id;

  perform public._notify(g.host_id, 'request_received',
    public._display_name(me) || ' wants to join ' || g.spot_name, nullif(btrim(p_note), ''), '/requests');
  return req_id;
exception when unique_violation then
  raise exception 'You have already asked to join this game' using errcode = 'P0001';
end $$;
grant execute on function public.request_to_join to authenticated;

create or replace function public.withdraw_request(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.join_requests set status = 'withdrawn', responded_at = now()
   where id = p_request and requester_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Request not found' using errcode = 'P0001'; end if;
end $$;
grant execute on function public.withdraw_request to authenticated;

-- Host accepts -> player admitted + chat created. Returns conversation id.
create or replace function public.accept_request(p_request uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.join_requests;
  g public.games;
  conv uuid;
begin
  select * into r from public.join_requests where id = p_request for update;
  if not found then raise exception 'Request not found' using errcode = 'P0001'; end if;
  select * into g from public.games where id = r.game_id for update;
  if auth.uid() is null or g.host_id is distinct from auth.uid() then raise exception 'Only the host can accept' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled' using errcode = 'P0001'; end if;
  if g.players_count >= g.capacity then raise exception 'Your game is already full' using errcode = 'P0001'; end if;

  conv := public._admit_player(g, r.requester_id, 'request');
  perform public._notify(r.requester_id, 'request_accepted',
    'You''re in! ' || public._display_name(g.host_id) || ' accepted you', g.spot_name, '/messages/' || conv);
  return conv;
end $$;
grant execute on function public.accept_request to authenticated;

create or replace function public.decline_request(p_request uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.join_requests;
  g public.games;
begin
  select * into r from public.join_requests where id = p_request for update;
  if not found then raise exception 'Request not found' using errcode = 'P0001'; end if;
  select * into g from public.games where id = r.game_id;
  if auth.uid() is null or g.host_id is distinct from auth.uid() then raise exception 'Only the host can decline' using errcode = '42501'; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled' using errcode = 'P0001'; end if;
  update public.join_requests
     set status = 'declined', decline_reason = nullif(btrim(p_reason), ''), responded_at = now()
   where id = r.id;
  perform public._notify(r.requester_id, 'request_declined',
    'Request declined for ' || g.spot_name, nullif(btrim(p_reason), ''), '/requests?tab=mine');
end $$;
grant execute on function public.decline_request to authenticated;

-- Host view of requests, with a rounded distance to the requester's home.
create or replace function public.host_requests()
returns table (
  id uuid, game_id uuid, game_slug text, spot_name text, sport public.sport, starts_at timestamptz,
  requester_id uuid, full_name text, avatar_url text, area_name text,
  games_played integer, no_shows integer, note text, status public.request_status,
  created_at timestamptz, distance_band text
)
language sql stable security definer set search_path = '' as $$
  select r.id, g.id, g.slug, g.spot_name, g.sport, g.starts_at,
         p.id, p.full_name, p.avatar_url, p.area_name,
         (select count(*)::integer from public.game_participants gp
            join public.games g2 on g2.id = gp.game_id
           where gp.user_id = p.id and gp.joined_via <> 'host' and not gp.no_show
             and g2.starts_at < now()),
         p.no_shows, r.note, r.status, r.created_at, r.distance_band
    from public.join_requests r
    join public.games g on g.id = r.game_id
    join public.profiles p on p.id = r.requester_id
   where g.host_id = auth.uid()
     and (r.status = 'pending' or r.responded_at > now() - interval '7 days')
   order by (r.status = 'pending') desc, r.created_at desc
   limit 200;
$$;
grant execute on function public.host_requests to authenticated;

-- Save my home neighbourhood point (never readable by others).
create or replace function public.set_home_location(p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_lat is null or p_lng is null then
    update public.profile_private set home_location = null, updated_at = now() where user_id = auth.uid();
    return;
  end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;
  -- Store coarsened to ~100 m: it's a neighbourhood, not an address.
  update public.profile_private
     set home_location = extensions.st_setsrid(extensions.st_makepoint(round(p_lng::numeric, 3)::float8, round(p_lat::numeric, 3)::float8), 4326)::extensions.geography,
         updated_at = now()
   where user_id = auth.uid();
end $$;
grant execute on function public.set_home_location to authenticated;

create or replace function public.my_home_location()
returns table (lat double precision, lng double precision)
language sql stable security definer set search_path = '' as $$
  select extensions.st_y(home_location::extensions.geometry), extensions.st_x(home_location::extensions.geometry)
    from public.profile_private where user_id = auth.uid() and home_location is not null
$$;
grant execute on function public.my_home_location to authenticated;

-- Pay for a paid game from wallet: atomic debit + credit + admit.
create or replace function public.pay_with_wallet(p_game uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.games;
  prof public.profiles;
  fee integer;
  total integer;
  bal bigint;
  pay_id uuid;
  conv uuid;
begin
  if me is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select * into g from public.games where id = p_game for update;
  if not found or g.status <> 'open' then raise exception 'This game is no longer open' using errcode = 'P0001'; end if;
  if not g.is_paid then raise exception 'Free games are joined by request' using errcode = 'P0001'; end if;
  if g.host_id = me then raise exception 'This is your own game' using errcode = 'P0001'; end if;
  if exists (select 1 from public.game_participants where game_id = g.id and user_id = me) then
    raise exception 'You are already in this game' using errcode = 'P0001';
  end if;
  if g.players_count >= g.capacity then raise exception 'This game is full' using errcode = 'P0001'; end if;
  if g.starts_at + make_interval(mins => g.duration_minutes) < now() then raise exception 'This game has already finished' using errcode = 'P0001'; end if;
  select * into prof from public.profiles where id = me;
  if not public.can_transact(prof) then raise exception 'Complete your profile to pay for games' using errcode = 'P0001'; end if;

  fee := public.platform_fee(g.fee_paise);
  total := g.fee_paise + fee;

  select balance_paise into bal from public.wallets where user_id = me for update;
  if bal < total then raise exception 'Not enough money in your wallet' using errcode = 'P0001'; end if;

  insert into public.payments (user_id, purpose, game_id, method, status, share_paise, platform_fee_paise)
  values (me, 'game', g.id, 'wallet', 'paid', g.fee_paise, fee)
  returning id into pay_id;

  update public.wallets set balance_paise = balance_paise - total, updated_at = now() where user_id = me;
  insert into public.wallet_transactions (user_id, amount_paise, kind, payment_id, game_id, description)
  values (me, -total, 'game_payment', pay_id, g.id, 'Joined ' || g.spot_name);

  update public.wallets set balance_paise = balance_paise + g.fee_paise, updated_at = now() where user_id = g.host_id;
  insert into public.wallet_transactions (user_id, amount_paise, kind, payment_id, game_id, description)
  values (g.host_id, g.fee_paise, 'host_earning', pay_id, g.id, public._display_name(me) || ' paid for ' || g.spot_name);

  conv := public._admit_player(g, me, 'payment');
  perform public._notify(g.host_id, 'player_joined', public._display_name(me) || ' paid and joined ' || g.spot_name, null, '/messages/' || conv);
  return conv;
end $$;
grant execute on function public.pay_with_wallet to authenticated;

-- Pay the host in person at the ground: admitted now, payment recorded as pending
-- (the host collects it). Still requires the fuller profile.
create or replace function public.join_pay_in_person(p_game uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.games;
  prof public.profiles;
  conv uuid;
begin
  if me is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  select * into g from public.games where id = p_game for update;
  if not found or g.status <> 'open' then raise exception 'This game is no longer open' using errcode = 'P0001'; end if;
  if not g.is_paid then raise exception 'Free games are joined by request' using errcode = 'P0001'; end if;
  if g.host_id = me then raise exception 'This is your own game' using errcode = 'P0001'; end if;
  if exists (select 1 from public.game_participants where game_id = g.id and user_id = me) then
    raise exception 'You are already in this game' using errcode = 'P0001';
  end if;
  if g.players_count >= g.capacity then raise exception 'This game is full' using errcode = 'P0001'; end if;
  if g.starts_at + make_interval(mins => g.duration_minutes) < now() then raise exception 'This game has already finished' using errcode = 'P0001'; end if;
  select * into prof from public.profiles where id = me;
  if not public.can_transact(prof) then raise exception 'Complete your profile to pay for games' using errcode = 'P0001'; end if;

  insert into public.payments (user_id, purpose, game_id, method, status, share_paise, platform_fee_paise)
  values (me, 'game', g.id, 'in_person', 'pending', g.fee_paise, 0);

  conv := public._admit_player(g, me, 'payment');
  perform public._notify(g.host_id, 'player_joined', public._display_name(me) || ' joined ' || g.spot_name || ' (pays at the ground)', null, '/messages/' || conv);
  return conv;
end $$;
grant execute on function public.join_pay_in_person to authenticated;

-- Server-only (service role): create a pending provider payment (UPI/card via Razorpay).
create or replace function public.create_provider_payment(
  p_user uuid, p_purpose public.payment_purpose, p_game uuid, p_method public.payment_method, p_topup_paise integer
)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
  prof public.profiles;
  p public.payments;
begin
  if p_method not in ('upi', 'card') then raise exception 'Invalid method' using errcode = '22023'; end if;
  select * into prof from public.profiles where id = p_user;
  if p_purpose = 'game' then
    select * into g from public.games where id = p_game;
    if not found or g.status <> 'open' or not g.is_paid then raise exception 'This game cannot be paid for' using errcode = 'P0001'; end if;
    if g.host_id = p_user then raise exception 'This is your own game' using errcode = 'P0001'; end if;
    if g.players_count >= g.capacity then raise exception 'This game is full' using errcode = 'P0001'; end if;
    if exists (select 1 from public.game_participants where game_id = g.id and user_id = p_user) then
      raise exception 'You are already in this game' using errcode = 'P0001';
    end if;
    if not public.can_transact(prof) then raise exception 'Complete your profile to pay for games' using errcode = 'P0001'; end if;
    insert into public.payments (user_id, purpose, game_id, method, share_paise, platform_fee_paise)
    values (p_user, 'game', g.id, p_method, g.fee_paise, public.platform_fee(g.fee_paise))
    returning * into p;
  else
    if p_topup_paise is null or p_topup_paise < 10000 or p_topup_paise > 1000000 then
      raise exception 'Top-up must be between ₹100 and ₹10,000' using errcode = 'P0001';
    end if;
    insert into public.payments (user_id, purpose, method, share_paise, platform_fee_paise)
    values (p_user, 'topup', p_method, p_topup_paise, 0)
    returning * into p;
  end if;
  return p;
end $$;
revoke all on function public.create_provider_payment from public, anon, authenticated;

-- Server-only (service role): provider confirmed the money. Idempotent.
-- If the game filled up meanwhile, the money goes to the player's wallet instead.
create or replace function public.confirm_provider_payment(p_payment uuid, p_provider_payment_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.payments;
  g public.games;
  conv uuid;
begin
  select * into p from public.payments where id = p_payment for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0001'; end if;
  -- Idempotent: only a pending (or previously failed) payment is ever processed.
  -- 'paid' and 'refunded' rows return without touching any wallet again.
  if p.status not in ('pending', 'failed') then
    select id into conv from public.conversations where game_id = p.game_id and player_id = p.user_id;
    return jsonb_build_object('status', case when p.status = 'refunded' then 'refunded_to_wallet' else 'already_paid' end, 'conversation_id', conv);
  end if;
  if exists (select 1 from public.payments where provider_payment_id = p_provider_payment_id and id <> p.id) then
    raise exception 'Provider payment already used' using errcode = 'P0001';
  end if;

  update public.payments set status = 'paid', provider_payment_id = p_provider_payment_id where id = p.id;

  if p.purpose = 'topup' then
    update public.wallets set balance_paise = balance_paise + p.share_paise, updated_at = now() where user_id = p.user_id;
    insert into public.wallet_transactions (user_id, amount_paise, kind, payment_id, description)
    values (p.user_id, p.share_paise, 'topup', p.id, 'Wallet top-up');
    return jsonb_build_object('status', 'topped_up');
  end if;

  select * into g from public.games where id = p.game_id for update;
  if g.id is null or g.status <> 'open' or g.players_count >= g.capacity
     or exists (select 1 from public.game_participants where game_id = g.id and user_id = p.user_id) then
    update public.payments set status = 'refunded' where id = p.id;
    update public.wallets set balance_paise = balance_paise + p.share_paise + p.platform_fee_paise, updated_at = now()
     where user_id = p.user_id;
    insert into public.wallet_transactions (user_id, amount_paise, kind, payment_id, game_id, description)
    values (p.user_id, p.share_paise + p.platform_fee_paise, 'refund', p.id, p.game_id, 'Game was full — refunded to wallet');
    return jsonb_build_object('status', 'refunded_to_wallet');
  end if;

  update public.wallets set balance_paise = balance_paise + p.share_paise, updated_at = now() where user_id = g.host_id;
  insert into public.wallet_transactions (user_id, amount_paise, kind, payment_id, game_id, description)
  values (g.host_id, p.share_paise, 'host_earning', p.id, g.id, public._display_name(p.user_id) || ' paid for ' || g.spot_name);

  conv := public._admit_player(g, p.user_id, 'payment');
  perform public._notify(g.host_id, 'player_joined', public._display_name(p.user_id) || ' paid and joined ' || g.spot_name, null, '/messages/' || conv);
  return jsonb_build_object('status', 'joined', 'conversation_id', conv);
end $$;
revoke all on function public.confirm_provider_payment from public, anon, authenticated;

create or replace function public.fail_provider_payment(p_payment uuid)
returns void language sql security definer set search_path = '' as $$
  update public.payments set status = 'failed' where id = p_payment and status = 'pending';
$$;
revoke all on function public.fail_provider_payment from public, anon, authenticated;

-- Host marks a player as a no-show once the game has started.
create or replace function public.set_no_show(p_game uuid, p_user uuid, p_no_show boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
  prev boolean;
begin
  select * into g from public.games where id = p_game;
  if g.host_id is distinct from auth.uid() then raise exception 'Only the host can do this' using errcode = '42501'; end if;
  if g.starts_at > now() then raise exception 'You can mark no-shows once the game has started' using errcode = 'P0001'; end if;
  if p_user = g.host_id then raise exception 'You can''t mark yourself' using errcode = 'P0001'; end if;
  select no_show into prev from public.game_participants where game_id = p_game and user_id = p_user for update;
  if not found then raise exception 'Player not in this game' using errcode = 'P0001'; end if;
  if prev = p_no_show then return; end if;
  update public.game_participants set no_show = p_no_show where game_id = p_game and user_id = p_user;
  update public.profiles set no_shows = greatest(no_shows + case when p_no_show then 1 else -1 end, 0) where id = p_user;
end $$;
grant execute on function public.set_no_show to authenticated;

-- Host cancels a game. Wallet/UPI/card payers are refunded to their wallet.
create or replace function public.cancel_game(p_game uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
  p record;
begin
  select * into g from public.games where id = p_game for update;
  if g.host_id is distinct from auth.uid() then raise exception 'Only the host can cancel' using errcode = '42501'; end if;
  if g.status = 'cancelled' then return; end if;
  update public.games set status = 'cancelled' where id = g.id;
  update public.join_requests set status = 'declined', decline_reason = 'Game was cancelled', responded_at = now()
   where game_id = g.id and status = 'pending';
  for p in select * from public.payments where game_id = g.id and status = 'paid' and method <> 'in_person' for update loop
    update public.payments set status = 'refunded' where id = p.id;
    update public.wallets set balance_paise = balance_paise + p.share_paise + p.platform_fee_paise, updated_at = now() where user_id = p.user_id;
    insert into public.wallet_transactions (user_id, amount_paise, kind, payment_id, game_id, description)
    values (p.user_id, p.share_paise + p.platform_fee_paise, 'refund', p.id, g.id, g.spot_name || ' was cancelled');
    -- Pull back the host's earning (host wallet can't go negative; clamp and log).
    update public.wallets set balance_paise = greatest(balance_paise - p.share_paise, 0), updated_at = now() where user_id = g.host_id;
    insert into public.wallet_transactions (user_id, amount_paise, kind, payment_id, game_id, description)
    values (g.host_id, -p.share_paise, 'refund', p.id, g.id, 'Refund for cancelled ' || g.spot_name);
  end loop;
  for p in select user_id from public.game_participants where game_id = g.id and user_id <> g.host_id loop
    perform public._notify(p.user_id, 'game_cancelled', g.spot_name || ' was cancelled', 'Any payment has been refunded to your wallet.', '/me');
  end loop;
end $$;
grant execute on function public.cancel_game to authenticated;

-- True if the caller hosts or plays in the game (SECURITY DEFINER avoids RLS recursion).
create or replace function public.is_game_member(p_game uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.game_participants where game_id = p_game and user_id = auth.uid())
$$;

-- Who's in one game (first names + avatars) for the game page. Per-game only, so nobody can
-- list every game a particular person has joined. no_show is only revealed to the host.
create or replace function public.game_roster(p_game uuid)
returns table (user_id uuid, full_name text, avatar_url text, no_show boolean)
language sql stable security definer set search_path = '' as $$
  select gp.user_id, p.full_name, p.avatar_url,
         case when g.host_id = auth.uid() then gp.no_show else false end
    from public.game_participants gp
    join public.profiles p on p.id = gp.user_id
    join public.games g on g.id = gp.game_id
   where gp.game_id = p_game and auth.uid() is not null
   order by gp.created_at
   limit 50
$$;
grant execute on function public.game_roster to authenticated;

-- Player stats (public).
create or replace function public.player_stats(p_user uuid)
returns table (games_played integer, games_hosted integer, no_shows integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::integer from public.game_participants gp join public.games g on g.id = gp.game_id
      where gp.user_id = p_user and gp.joined_via <> 'host' and not gp.no_show and g.starts_at < now() and g.status = 'open'),
    (select count(*)::integer from public.games g where g.host_id = p_user and g.starts_at < now() and g.status = 'open'),
    (select no_shows from public.profiles where id = p_user)
$$;
grant execute on function public.player_stats to anon, authenticated;

-- Bump conversation preview + notify on new message.
create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  other uuid;
begin
  update public.conversations
     set last_message_at = new.created_at, last_message = left(new.body, 140)
   where id = new.conversation_id
  returning * into c;
  other := case when c.host_id = new.sender_id then c.player_id else c.host_id end;
  perform public._notify(other, 'message', public._display_name(new.sender_id), left(new.body, 140), '/messages/' || c.id);
  return null;
end $$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.profile_private     enable row level security;
alter table public.wallets             enable row level security;
alter table public.games               enable row level security;
alter table public.game_participants   enable row level security;
alter table public.join_requests       enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.payments            enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.notifications       enable row level security;

-- profiles: public display info (no location, no money in this table)
create policy "profiles are viewable" on public.profiles for select to anon, authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- private + wallet: owner only, read-only (writes go through RPCs)
create policy "read own private" on public.profile_private for select to authenticated using (user_id = auth.uid());
create policy "read own wallet" on public.wallets for select to authenticated using (user_id = auth.uid());
create policy "read own wallet tx" on public.wallet_transactions for select to authenticated using (user_id = auth.uid());
create policy "read own payments" on public.payments for select to authenticated using (user_id = auth.uid());

-- games: public listing; host manages
create policy "games are viewable" on public.games for select to anon, authenticated using (true);
create policy "host creates games" on public.games for insert to authenticated with check (host_id = auth.uid());
create policy "host updates games" on public.games for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());

-- participants: visible to signed-in users (count is public on games)
create policy "participants visible to the game's members" on public.game_participants for select to authenticated
  using (user_id = auth.uid() or public.is_game_member(game_id));

-- requests: requester and the game's host
create policy "see own or hosted requests" on public.join_requests for select to authenticated using (
  requester_id = auth.uid()
  or exists (select 1 from public.games g where g.id = game_id and g.host_id = auth.uid())
);

-- conversations & messages: only the two people in it
create policy "members see conversation" on public.conversations for select to authenticated
  using (host_id = auth.uid() or player_id = auth.uid());
create policy "members read messages" on public.messages for select to authenticated using (
  exists (select 1 from public.conversations c where c.id = conversation_id and (c.host_id = auth.uid() or c.player_id = auth.uid()))
);
create policy "members send messages" on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and (c.host_id = auth.uid() or c.player_id = auth.uid()))
);

-- notifications: own
create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own notifications" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Column-level hardening: authenticated users can only update safe profile columns.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, area_name, occupation, id_verified, sports, profile_prompted, tour_completed)
  on public.profiles to authenticated;
revoke update on public.games from authenticated;
grant update (spot_name, city, notes, photo_url, lat, lng, starts_at, duration_minutes, capacity)
  on public.games to authenticated;
revoke insert on public.games from authenticated, anon;
grant insert (host_id, sport, spot_name, city, notes, photo_url, lat, lng, starts_at, duration_minutes, capacity, is_paid, fee_paise)
  on public.games to authenticated;
-- Everything else is written only through SECURITY DEFINER functions / triggers.
revoke insert, update, delete on public.profile_private, public.wallets, public.wallet_transactions,
  public.payments, public.game_participants, public.join_requests, public.conversations from anon, authenticated;
revoke insert, update, delete on public.messages, public.notifications, public.profiles from anon;
revoke delete on public.games, public.profiles, public.messages, public.notifications from authenticated;
revoke insert on public.notifications, public.profiles from authenticated;

-- Functions: Postgres grants EXECUTE to PUBLIC by default and Supabase adds anon/authenticated.
-- Lock everything down, then re-grant only what each role needs.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.nearby_games, public.player_stats to anon, authenticated;
grant execute on function public.request_to_join, public.withdraw_request, public.accept_request, public.decline_request,
  public.host_requests, public.set_home_location, public.my_home_location, public.pay_with_wallet,
  public.join_pay_in_person, public.set_no_show, public.cancel_game, public.game_roster, public.is_game_member
  to authenticated;
grant execute on function public.create_provider_payment, public.confirm_provider_payment, public.fail_provider_payment
  to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- =============================================================================
-- Realtime
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.join_requests, public.notifications, public.conversations;
  end if;
end $$;

-- =============================================================================
-- Storage: public buckets for avatars and ground photos, folder = user id
-- =============================================================================
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
      ('game-photos', 'game-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "public read images" on storage.objects for select
        using (bucket_id in ('avatars', 'game-photos'))
    $p$;
    execute $p$
      create policy "upload own images" on storage.objects for insert to authenticated
        with check (bucket_id in ('avatars', 'game-photos') and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy "update own images" on storage.objects for update to authenticated
        using (bucket_id in ('avatars', 'game-photos') and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy "delete own images" on storage.objects for delete to authenticated
        using (bucket_id in ('avatars', 'game-photos') and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  end if;
end $$;
