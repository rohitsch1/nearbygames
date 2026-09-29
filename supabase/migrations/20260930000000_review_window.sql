-- =============================================================================
-- Reviews: only between people who actually played together, within one day.
--   * Window: from the game's start until 24 hours after it ends (was 30 days).
--   * Anyone the host marked as a no-show can't give or get a review for that game.
-- =============================================================================

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
  if g.starts_at + make_interval(mins => g.duration_minutes) < now() - interval '1 day' then
    raise exception 'Reviews close 24 hours after the game' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.game_participants where game_id = g.id and user_id = me and not no_show) then
    raise exception 'Only people who played can leave reviews' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.game_participants where game_id = g.id and user_id = p_reviewee and not no_show) then
    raise exception 'You can only review people who played with you' using errcode = 'P0001';
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

-- create or replace keeps existing grants, but be explicit.
revoke execute on function public.submit_review from public, anon;
grant execute on function public.submit_review to authenticated;
