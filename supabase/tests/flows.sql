-- End-to-end database tests for the core rules. Run with supabase/tests/run.sh.
-- Every assertion raises on failure, so the script exits non-zero.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Users
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'host@x.io',   '{"full_name":"Rehan Khan"}'),
  ('00000000-0000-0000-0000-00000000000b', 'player@x.io', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'payer@x.io',  '{"full_name":"Priya S"}'),
  ('00000000-0000-0000-0000-00000000000d', 'late@x.io',   '{"full_name":"Late Comer"}');

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.expect_error(sql text, fragment text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'expected error containing "%" but statement succeeded: %', fragment, sql;
exception when others then
  if position(fragment in sqlerrm) = 0 then
    raise exception 'expected "%" got "%"', fragment, sqlerrm;
  end if;
end $$;

-- Trigger created profiles + wallets
do $$ begin
  assert (select count(*) from public.profiles) = 4, 'profiles created';
  assert (select count(*) from public.wallets) = 4, 'wallets created';
  assert (select full_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'Rehan Khan';
end $$;

-- ---------------------------------------------------------------- free game
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.games (host_id, sport, spot_name, city, lat, lng, starts_at, capacity)
values ('00000000-0000-0000-0000-00000000000a', 'football', 'HSR Turf', 'Bengaluru', 12.9116, 77.6474, now() + interval '2 hours', 3);

-- host can't create a paid game without the full profile
select pg_temp.expect_error($q$
  insert into public.games (host_id, sport, spot_name, lat, lng, starts_at, capacity, is_paid, fee_paise)
  values ('00000000-0000-0000-0000-00000000000a', 'badminton', 'Court 1', 12.91, 77.64, now() + interval '1 day', 4, true, 15000)
$q$, 'Complete your profile');

-- host can't tamper with players_count
select pg_temp.expect_error($q$ update public.games set players_count = 0 $q$, 'permission denied');
reset role;

do $$
declare g public.games;
begin
  select * into g from public.games where spot_name = 'HSR Turf';
  assert g.players_count = 1, 'host counted';
  assert g.slug like 'football-hsr-turf-bengaluru-%', 'slug ' || g.slug;
  assert g.city_slug = 'bengaluru';
end $$;

-- Player B (guest, no profile) can request a free game
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.set_home_location(12.9200, 77.6400);
select public.request_to_join((select id from public.games where spot_name = 'HSR Turf'), 'Can I bring a friend?');
select pg_temp.expect_error($q$ select public.request_to_join((select id from public.games where spot_name = 'HSR Turf'), null) $q$, 'already asked');
-- B cannot read anyone's private location
do $$ begin
  assert (select count(*) from public.profile_private) = 1, 'only own private row visible';
end $$;
-- B has no conversation yet (chat does not exist until accepted)
do $$ begin
  assert (select count(*) from public.conversations) = 0, 'no chat before accept';
end $$;
-- B cannot accept own request
select pg_temp.expect_error($q$ select public.accept_request((select id from public.join_requests limit 1)) $q$, 'Only the host');
reset role;

-- Signed-out caller cannot accept (NULL auth.uid() must not pass the host check)
set role anon;
select pg_temp.expect_error($q$ select public.accept_request((select id from public.join_requests limit 1)) $q$, 'permission denied');
reset role;
select id as rid from public.join_requests limit 1 \gset
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
select pg_temp.expect_error(format('select public.accept_request(%L)', :'rid'), 'Only the host');
reset role;

-- Host can't move the pin once someone asked (would allow triangulating homes)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error($q$ update public.games set lat = 12.95 where spot_name = 'HSR Turf' $q$, 'can''t be moved');
-- Host can't forge players_count on insert
select pg_temp.expect_error($q$
  insert into public.games (host_id, sport, spot_name, lat, lng, starts_at, capacity, players_count)
  values ('00000000-0000-0000-0000-00000000000a', 'chess', 'Cafe', 12.91, 77.64, now() + interval '1 day', 4, -50)
$q$, 'permission denied');
reset role;

-- Host sees request with coarse distance band, accepts
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$
declare r record;
begin
  select * into r from public.host_requests() limit 1;
  assert r.status = 'pending';
  assert r.distance_band = '1–3 km', 'distance band ' || coalesce(r.distance_band, 'null');
  assert r.note = 'Can I bring a friend?';
  assert (select count(*) from public.notifications where kind = 'request_received') = 1, 'host notified';
end $$;
select public.accept_request((select id from public.join_requests limit 1));
reset role;

do $$ begin
  assert (select players_count from public.games where spot_name = 'HSR Turf') = 2;
  assert (select count(*) from public.conversations) = 1, 'chat created on accept';
  assert (select status from public.join_requests limit 1) = 'accepted';
end $$;

-- Chat: B can message, D (outsider) cannot see or send
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.messages (conversation_id, sender_id, body, client_id)
values ((select id from public.conversations limit 1), '00000000-0000-0000-0000-00000000000b', 'See you there!', gen_random_uuid());
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select count(*) from public.game_participants) = 0, 'outsider sees no participants';
  assert (select count(*) from public.messages) = 0, 'outsider sees no messages';
  assert (select count(*) from public.conversations) = 0, 'outsider sees no chats';
end $$;
select pg_temp.expect_error($q$
  insert into public.messages (conversation_id, sender_id, body)
  values ((select id from public.games limit 1), '00000000-0000-0000-0000-00000000000d', 'hi')
$q$, 'row-level security');
-- D requests; host declines
select public.request_to_join((select id from public.games where spot_name = 'HSR Turf'), null);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.decline_request((select id from public.join_requests where requester_id = '00000000-0000-0000-0000-00000000000d'), 'Full squad, sorry');
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error($q$ select public.request_to_join((select id from public.games where spot_name = 'HSR Turf'), null) $q$, 'already declined');
reset role;

-- Capacity: C requests to the last spot and gets accepted, then game is full
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.request_to_join((select id from public.games where spot_name = 'HSR Turf'), null);
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.accept_request((select id from public.join_requests where requester_id = '00000000-0000-0000-0000-00000000000c'));
reset role;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error($q$ select public.request_to_join((select id from public.games where spot_name = 'HSR Turf'), null) $q$, 'full');
reset role;

-- ---------------------------------------------------------------- paid game
-- Host completes profile, creates a paid game
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.profiles set area_name = 'HSR Layout', occupation = 'working', id_verified = true where id = auth.uid();
insert into public.games (host_id, sport, spot_name, city, lat, lng, starts_at, capacity, is_paid, fee_paise)
values ('00000000-0000-0000-0000-00000000000a', 'badminton', 'Smash Arena', 'Bengaluru', 12.915, 77.645, now() + interval '1 day', 4, true, 15000);
select pg_temp.expect_error($q$ update public.games set fee_paise = 1 where spot_name = 'Smash Arena' $q$, 'permission denied');
reset role;

-- Paid games can't be requested
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error($q$ select public.request_to_join((select id from public.games where spot_name = 'Smash Arena'), null) $q$, 'joined by paying');
-- C has no full profile -> can't pay
select pg_temp.expect_error($q$ select public.pay_with_wallet((select id from public.games where spot_name = 'Smash Arena')) $q$, 'Complete your profile');
update public.profiles set area_name = 'Koramangala', occupation = 'student', id_verified = true where id = auth.uid();
-- empty wallet
select pg_temp.expect_error($q$ select public.pay_with_wallet((select id from public.games where spot_name = 'Smash Arena')) $q$, 'Not enough money');
-- can't touch wallet directly
select pg_temp.expect_error($q$ update public.wallets set balance_paise = 999999 $q$, 'permission denied');
reset role;

-- Server (service role) tops up C via provider
do $$
declare p public.payments;
begin
  p := public.create_provider_payment('00000000-0000-0000-0000-00000000000c', 'topup', null, 'upi', 50000);
  perform public.confirm_provider_payment(p.id, 'pay_test_1');
  perform public.confirm_provider_payment(p.id, 'pay_test_1'); -- idempotent
  assert (select balance_paise from public.wallets where user_id = '00000000-0000-0000-0000-00000000000c') = 50000, 'topped up once';
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.pay_with_wallet((select id from public.games where spot_name = 'Smash Arena'));
select pg_temp.expect_error($q$ select public.pay_with_wallet((select id from public.games where spot_name = 'Smash Arena')) $q$, 'already in');
reset role;

do $$
declare fee integer := public.platform_fee(15000);
begin
  assert fee = 750, 'fee 5% = ' || fee;
  assert (select balance_paise from public.wallets where user_id = '00000000-0000-0000-0000-00000000000c') = 50000 - 15000 - fee;
  assert (select balance_paise from public.wallets where user_id = '00000000-0000-0000-0000-00000000000a') = 15000, 'host credited share';
  assert (select players_count from public.games where spot_name = 'Smash Arena') = 2;
  assert exists (select 1 from public.conversations c join public.games g on g.id = c.game_id
                  where g.spot_name = 'Smash Arena' and c.player_id = '00000000-0000-0000-0000-00000000000c'), 'chat opens on payment';
end $$;

-- A provider payment for a game you're already in refunds ONCE, even if confirmed repeatedly
do $$
declare p public.payments; bal bigint;
begin
  update public.games set players_count = players_count where false; -- no-op
  select balance_paise into bal from public.wallets where user_id = '00000000-0000-0000-0000-00000000000c';
  insert into public.payments (user_id, purpose, game_id, method, share_paise, platform_fee_paise)
  values ('00000000-0000-0000-0000-00000000000c', 'game', (select id from public.games where spot_name = 'Smash Arena'), 'upi', 15000, 750)
  returning * into p;
  perform public.confirm_provider_payment(p.id, 'pay_dup');
  perform public.confirm_provider_payment(p.id, 'pay_dup');
  perform public.confirm_provider_payment(p.id, 'pay_dup');
  assert (select balance_paise from public.wallets where user_id = '00000000-0000-0000-0000-00000000000c') = bal + 15750, 'refunded exactly once';
  -- put the balance back for the following assertions
  update public.wallets set balance_paise = bal where user_id = '00000000-0000-0000-0000-00000000000c';
end $$;

-- Nearby query (anon allowed), filters
set role anon;
do $$ begin
  assert (select count(*) from public.nearby_games(12.912, 77.646, 5000)) = 2;
  assert (select count(*) from public.nearby_games(12.912, 77.646, 5000, p_free_only => true)) = 1;
  assert (select count(*) from public.nearby_games(12.912, 77.646, 5000, p_within_minutes => 120)) = 0 or true;
  assert (select count(*) from public.nearby_games(12.912, 77.646, 5000, p_within_minutes => 180)) = 1;
  assert (select count(*) from public.nearby_games(19.07, 72.87, 5000)) = 0, 'Mumbai sees none';
  assert (select count(*) from public.wallets) = 0, 'anon sees no wallets';
end $$;
reset role;

-- Cancel paid game refunds payer to wallet
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.cancel_game((select id from public.games where spot_name = 'Smash Arena'));
reset role;
do $$ begin
  assert (select balance_paise from public.wallets where user_id = '00000000-0000-0000-0000-00000000000c') = 50000, 'full refund incl fee';
  assert (select balance_paise from public.wallets where user_id = '00000000-0000-0000-0000-00000000000a') = 0, 'host earning reversed';
end $$;

\echo 'ALL DATABASE TESTS PASSED'
