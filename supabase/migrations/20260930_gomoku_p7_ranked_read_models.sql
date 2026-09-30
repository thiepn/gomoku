-- P7 — Ranked read models for profile and leaderboard endpoints.

create or replace function public.gomoku_ranked_summary(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with mine as (
  select r.* from public.gomoku_ratings r where r.user_id=p_user_id
),
ranked as (
  select m.*,
    case when m.games=0 then null else 1 + (
      select count(*) from public.gomoku_ratings x
      where x.games>0 and (
        x.rating>m.rating
        or (x.rating=m.rating and x.wins>m.wins)
        or (x.rating=m.rating and x.wins=m.wins and x.games>m.games)
        or (x.rating=m.rating and x.wins=m.wins and x.games=m.games and x.user_id<m.user_id)
      )
    ) end as rank
  from mine m
)
select coalesce((
  select jsonb_build_object(
    'rating',rating,'peakRating',peak_rating,'games',games,'wins',wins,'draws',draws,'losses',losses,
    'rank',rank,'provisional',games<10,'lastPlayedAt',last_played_at
  ) from ranked
),jsonb_build_object(
  'rating',1500,'peakRating',1500,'games',0,'wins',0,'draws',0,'losses',0,
  'rank',null,'provisional',true,'lastPlayedAt',null
));
$$;

revoke all on function public.gomoku_ranked_summary(uuid) from public, anon, authenticated;
grant execute on function public.gomoku_ranked_summary(uuid) to service_role;

create or replace function public.gomoku_ranked_leaderboard(p_limit integer default 50)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'rank',q.rank,'userId',q.user_id,'username',q.username,'rating',q.rating,'peakRating',q.peak_rating,
  'games',q.games,'wins',q.wins,'draws',q.draws,'losses',q.losses,
  'provisional',q.games<10,'lastPlayedAt',q.last_played_at
) order by q.rank),'[]'::jsonb)
from (
  select
    row_number() over (order by r.rating desc,r.wins desc,r.games desc,r.user_id)::integer as rank,
    r.user_id,p.username,r.rating,r.peak_rating,r.games,r.wins,r.draws,r.losses,r.last_played_at
  from public.gomoku_ratings r
  join public.leaderboard_profiles p on p.user_id=r.user_id
  where r.games>0
  order by r.rating desc,r.wins desc,r.games desc,r.user_id
  limit greatest(1,least(coalesce(p_limit,50),100))
) q;
$$;

revoke all on function public.gomoku_ranked_leaderboard(integer) from public, anon, authenticated;
grant execute on function public.gomoku_ranked_leaderboard(integer) to service_role;
