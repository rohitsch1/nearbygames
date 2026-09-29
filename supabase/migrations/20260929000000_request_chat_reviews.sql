-- =============================================================================
-- Request chat + reviews
--
-- 1. A host can open a chat with someone who has asked to join, before deciding.
--    The chat stays writable while the request is pending or once the player is in.
--    After a decline or withdrawal it becomes read-only.
-- 2. People who played in the same game can rate (1–5) and review each other,
--    once the game has started. Reviews never expose which game they came from.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Chat with a requester
-- -----------------------------------------------------------------------------

-- 'in' = player is in the game, 'requested' = request still pending, 'closed' = neither.
-- Returns null for anyone who isn't one of the two people in the conversation.
create or replace function public.conversation_status(p_conv uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.game_participants gp where gp.game_id = c.game_id and gp.user_id = c.player_id) then 'in'
    when exists (select 1 from public.join_requests r
                  where r.game_id = c.game_id and r.requester_id = c.player_id and r.status = 'pending') then 'requested'
    else 'closed'
  end
  from public.conversations c
  where c.id = p_conv and auth.uid() in (c.host_id, c.player_id)
$$;

drop policy "members send messages" on public.messages;
create policy "members send messages" on public.messages for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c where c.id = conversation_id and (c.host_id = auth.uid() or c.player_id = auth.uid()))
  and public.conversation_status(conversation_id) in ('in', 'requested')
);

-- Host opens (or reopens) the chat with a requester. Returns the conversation id.
create or replace function public.open_request_chat(p_request uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  r public.join_requests;
  g public.games;
  conv uuid;
begin
  select * into r from public.join_requests where id = p_request;
  if not found then raise exception 'Request not found' using errcode = 'P0001'; end if;
  select * into g from public.games where id = r.game_id;
  if auth.uid() is null or g.host_id is distinct from auth.uid() then
    raise exception 'Only the host can start this chat' using errcode = '42501';
  end if;

  select id into conv from public.conversations where game_id = g.id and player_id = r.requester_id;
  if conv is not null then return conv; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled' using errcode = 'P0001'; end if;
  if g.status <> 'open' then raise exception 'This game is no longer open' using errcode = 'P0001'; end if;

  insert into public.conversations (game_id, host_id, player_id)
  values (g.id, g.host_id, r.requester_id)
  on conflict (game_id, player_id) do update set game_id = excluded.game_id
  returning id into conv;
  return conv;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Reviews
-- -----------------------------------------------------------------------------
create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games (id) on delete cascade,
  reviewer_id  uuid not null references public.profiles (id) on delete cascade,
  reviewee_id  uuid not null references public.profiles (id) on delete cascade,
  rating       smallint not null check (rating between 1 and 5),
  comment      text check (char_length(comment) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (game_id, reviewer_id, reviewee_id),
  constraint no_self_review check (reviewer_id <> reviewee_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

alter table public.reviews enable row level security;
-- Rows carry game_id, so only the two people involved read them directly. Everyone else
-- goes through user_reviews(), which leaves the game out (nobody can list someone's games).
create policy "reviewer or reviewee reads" on public.reviews for select to authenticated
  using (reviewer_id = auth.uid() or reviewee_id = auth.uid());
revoke insert, update, delete on public.reviews from anon, authenticated;

-- Rate someone you played with. Calling it again updates your review.
create or replace function public.submit_review(p_game uuid, p_reviewee uuid, p_rating integer, p_comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  g public.games;
  rev_id uuid;
  is_new boolean;
begin
  if me is null then raise exception 'Sign in first' using errcode = '28000'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Pick 1 to 5 stars' using errcode = 'P0001'; end if;
  if p_reviewee = me then raise exception 'You can''t review yourself' using errcode = 'P0001'; end if;
  select * into g from public.games where id = p_game;
  if not found then raise exception 'Game not found' using errcode = 'P0001'; end if;
  if g.status = 'cancelled' then raise exception 'This game was cancelled' using errcode = 'P0001'; end if;
  if g.starts_at > now() then raise exception 'You can leave reviews once the game has started' using errcode = 'P0001'; end if;
  if g.starts_at + make_interval(mins => g.duration_minutes) < now() - interval '30 days' then
    raise exception 'Reviews close 30 days after the game' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.game_participants where game_id = g.id and user_id = me) then
    raise exception 'Only people who played can leave reviews' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.game_participants where game_id = g.id and user_id = p_reviewee) then
    raise exception 'That person wasn''t in this game' using errcode = 'P0001';
  end if;

  is_new := not exists (select 1 from public.reviews where game_id = g.id and reviewer_id = me and reviewee_id = p_reviewee);
  insert into public.reviews (game_id, reviewer_id, reviewee_id, rating, comment)
  values (g.id, me, p_reviewee, p_rating, nullif(btrim(p_comment), ''))
  on conflict (game_id, reviewer_id, reviewee_id)
    do update set rating = excluded.rating, comment = excluded.comment
  returning id into rev_id;

  if is_new then
    perform public._notify(p_reviewee, 'review_received',
      public._display_name(me) || ' rated you ' || p_rating || '★', nullif(btrim(p_comment), ''), '/me');
  end if;
  return rev_id;
end $$;

-- Average rating (one decimal) and number of reviews for a person. Public.
create or replace function public.rating_summary(p_user uuid)
returns table (rating_avg numeric, rating_count integer)
language sql stable security definer set search_path = '' as $$
  select round(avg(rating)::numeric, 1), count(*)::integer from public.reviews where reviewee_id = p_user
$$;

-- Reviews about a person, newest first, without saying which game they came from.
create or replace function public.user_reviews(p_user uuid, p_limit integer default 20)
returns table (id uuid, rating smallint, comment text, created_at timestamptz,
               reviewer_name text, reviewer_avatar text, sport public.sport)
language sql stable security definer set search_path = '' as $$
  select r.id, r.rating, r.comment, r.created_at, public._display_name(r.reviewer_id), p.avatar_url, g.sport
    from public.reviews r
    join public.profiles p on p.id = r.reviewer_id
    join public.games g on g.id = r.game_id
   where r.reviewee_id = p_user and auth.uid() is not null
   order by r.created_at desc
   limit least(greatest(p_limit, 1), 50)
$$;

-- Host request list, now with the requester's ID check and rating.
drop function public.host_requests();
create function public.host_requests()
returns table (
  id uuid, game_id uuid, game_slug text, spot_name text, sport public.sport, starts_at timestamptz,
  requester_id uuid, full_name text, avatar_url text, area_name text,
  games_played integer, no_shows integer, note text, status public.request_status,
  created_at timestamptz, distance_band text,
  id_verified boolean, rating_avg numeric, rating_count integer, conversation_id uuid
)
language sql stable security definer set search_path = '' as $$
  select r.id, g.id, g.slug, g.spot_name, g.sport, g.starts_at,
         p.id, p.full_name, p.avatar_url, p.area_name,
         (select count(*)::integer from public.game_participants gp
            join public.games g2 on g2.id = gp.game_id
           where gp.user_id = p.id and gp.joined_via <> 'host' and not gp.no_show
             and g2.starts_at < now()),
         p.no_shows, r.note, r.status, r.created_at, r.distance_band,
         p.id_verified,
         (select round(avg(rv.rating)::numeric, 1) from public.reviews rv where rv.reviewee_id = p.id),
         (select count(*)::integer from public.reviews rv where rv.reviewee_id = p.id),
         (select c.id from public.conversations c where c.game_id = g.id and c.player_id = p.id)
    from public.join_requests r
    join public.games g on g.id = r.game_id
    join public.profiles p on p.id = r.requester_id
   where g.host_id = auth.uid()
     and (r.status = 'pending' or r.responded_at > now() - interval '7 days')
   order by (r.status = 'pending') desc, r.created_at desc
   limit 200;
$$;

-- -----------------------------------------------------------------------------
-- Grants (default privileges already revoke EXECUTE on new functions)
-- -----------------------------------------------------------------------------
revoke execute on function public.conversation_status, public.open_request_chat, public.submit_review,
  public.rating_summary, public.user_reviews, public.host_requests from public, anon, authenticated;
grant execute on function public.rating_summary to anon, authenticated;
grant execute on function public.conversation_status, public.open_request_chat, public.submit_review,
  public.user_reviews, public.host_requests to authenticated;
