-- Local development seed (runs on `supabase db reset`). Never run in production.
-- Creates two demo hosts and a handful of games around HSR Layout, Bengaluru.
-- GoTrue can't read NULLs in its token columns, so they're set to ''.
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, email_confirmed_at,
                        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'rehan@demo.nearbygames.local', '{"provider":"email","providers":["email"]}', '{"full_name":"Rehan Khan"}', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'ananya@demo.nearbygames.local', '{"provider":"email","providers":["email"]}', '{"full_name":"Ananya Rao"}', now(), now(), now(), '', '', '', '')
on conflict (id) do nothing;

update public.profiles set area_name = 'HSR Layout', occupation = 'working', id_verified = true,
  sports = '{football,cricket}', profile_prompted = true, tour_completed = true
 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set area_name = 'Koramangala', occupation = 'resident', id_verified = true,
  sports = '{badminton,chess}', profile_prompted = true, tour_completed = true
 where id = '22222222-2222-2222-2222-222222222222';

insert into public.games (host_id, sport, spot_name, city, notes, lat, lng, starts_at, capacity, is_paid, fee_paise) values
  ('11111111-1111-1111-1111-111111111111', 'football', 'HSR Sector 2 Turf', 'Bengaluru',
   'Bibs and ball sorted, just bring turf shoes.', 12.9116, 77.6389, now() + interval '90 minutes', 14, false, 0),
  ('22222222-2222-2222-2222-222222222222', 'badminton', 'Smash Arena Court 3', 'Bengaluru',
   'Court booked for 2 hours. Feather shuttles provided.', 12.9279, 77.6271, now() + interval '3 hours', 4, true, 15000),
  ('11111111-1111-1111-1111-111111111111', 'cricket', 'Society Ground, Agara', 'Bengaluru',
   'Tennis ball cricket, 8 overs a side.', 12.9230, 77.6490, now() + interval '1 day', 16, false, 0),
  ('22222222-2222-2222-2222-222222222222', 'chess', 'Third Wave Coffee, 27th Main', 'Bengaluru',
   'Bring your own board if you have one. Rapid 10+5.', 12.9121, 77.6446, now() + interval '5 hours', 6, false, 0),
  ('11111111-1111-1111-1111-111111111111', 'gaming', 'Clubhouse FIFA Night', 'Bengaluru',
   'PS5, 2 controllers spare. Winner stays on.', 12.9081, 77.6512, now() + interval '2 days', 8, true, 10000);
