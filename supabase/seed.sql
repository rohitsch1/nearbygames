-- Local development seed (runs on `supabase db reset`). Never run in production.
-- A hyperlocal demo in Hisar, Haryana: gully cricket in a lane, volleyball on an empty plot,
-- badminton on a terrace, carrom at home — games hosted wherever people already play.
-- GoTrue can't read NULLs in its token columns, so they're set to ''.
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, email_confirmed_at,
                        created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'aman@demo.nearbygames.local', '{"provider":"email","providers":["email"]}', '{"full_name":"Aman Sharma"}', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'pooja@demo.nearbygames.local', '{"provider":"email","providers":["email"]}', '{"full_name":"Pooja Verma"}', now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'vikas@demo.nearbygames.local', '{"provider":"email","providers":["email"]}', '{"full_name":"Vikas Yadav"}', now(), now(), now(), '', '', '', '')
on conflict (id) do nothing;

update public.profiles set area_name = 'Model Town', occupation = 'resident', id_verified = true,
  sports = '{cricket,volleyball}', profile_prompted = true, tour_completed = true
 where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set area_name = 'Sector 14', occupation = 'resident', id_verified = true,
  sports = '{badminton,other}', profile_prompted = true, tour_completed = true
 where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set area_name = 'Urban Estate II', occupation = 'student', id_verified = true,
  sports = '{cricket,football,gaming}', profile_prompted = true, tour_completed = true
 where id = '33333333-3333-3333-3333-333333333333';

insert into public.games (host_id, sport, spot_name, city, notes, lat, lng, starts_at, capacity, is_paid, fee_paise) values
  ('11111111-1111-1111-1111-111111111111', 'cricket', 'Gali No. 4, Model Town', 'Hisar',
   'Tennis-ball gully cricket, 6 overs a side. One-tip-one-hand allowed. Bring a bat if you have one.',
   29.1512, 75.7255, now() + interval '45 minutes', 12, false, 0),
  ('11111111-1111-1111-1111-111111111111', 'volleyball', 'Khali plot behind Shiv Mandir', 'Hisar',
   'Net is tied between the two poles. Come after 5, the sun goes behind the water tank.',
   29.1545, 75.7218, now() + interval '2 hours', 12, false, 0),
  ('22222222-2222-2222-2222-222222222222', 'badminton', 'Sharma ji ki chhat (terrace)', 'Hisar',
   'Rooftop doubles. Lights are on till 10. Please use the side staircase.',
   29.1478, 75.7302, now() + interval '5 hours', 4, false, 0),
  ('22222222-2222-2222-2222-222222222222', 'other', 'Carrom at the Verma house', 'Hisar',
   'Carrom board + chai. Two boards, so up to 8 of us. Ground floor, blue gate.',
   29.1461, 75.7331, now() + interval '3 hours', 8, false, 0),
  ('33333333-3333-3333-3333-333333333333', 'cricket', 'Hisar Box Cricket Arena', 'Hisar',
   'Box cricket, 1 hour booked. ₹60 each covers the turf. Pay and you are in.',
   29.1600, 75.7400, now() + interval '4 hours', 14, true, 6000),
  ('33333333-3333-3333-3333-333333333333', 'football', 'School ground, Urban Estate II', 'Hisar',
   '7-a-side on the school ground after school hours. Watchman knows us.',
   29.1690, 75.7285, now() + interval '1 day', 14, false, 0),
  ('33333333-3333-3333-3333-333333333333', 'gaming', 'FIFA night at Vikas''s place', 'Hisar',
   'PS5, two spare controllers. Winner stays on. ₹50 covers snacks.',
   29.1655, 75.7262, now() + interval '2 days', 6, true, 5000);
