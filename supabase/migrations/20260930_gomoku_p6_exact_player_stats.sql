create or replace function public.gomoku_player_stats(p_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with base as (
  select
    m.room_id,
    m.game_version,
    m.completed_at,
    m.move_count,
    m.black_user_id,
    m.white_user_id,
    m.winner_color,
    case
      when m.black_user_id = p_user_id then 1
      when m.white_user_id = p_user_id then 2
      else 0
    end as player_color,
    case
      when m.black_user_id = p_user_id then m.white_user_id
      else m.black_user_id
    end as opponent_id
  from public.gomoku_matches m
  where m.black_user_id = p_user_id or m.white_user_id = p_user_id
),
outcomes as (
  select *,
    case
      when winner_color = 0 then 'D'
      when winner_color = player_color then 'W'
      else 'L'
    end as outcome
  from base
  where player_color in (1,2)
),
ranked as (
  select *,
    row_number() over (
      order by completed_at desc, room_id desc, game_version desc
    ) as rn
  from outcomes
),
chronological as (
  select *,
    sum(case when outcome <> 'W' then 1 else 0 end) over (
      order by completed_at asc, room_id asc, game_version asc
      rows between unbounded preceding and current row
    ) as win_group
  from outcomes
),
win_runs as (
  select count(*)::integer as wins
  from chronological
  where outcome = 'W'
  group by win_group
),
first_outcome as (
  select outcome
  from ranked
  where rn = 1
),
current_streak as (
  select count(*)::integer as count
  from ranked r
  cross join first_outcome f
  where r.outcome = f.outcome
    and not exists (
      select 1
      from ranked x
      where x.rn < r.rn and x.outcome <> f.outcome
    )
)
select jsonb_build_object(
  'games', count(*)::integer,
  'wins', count(*) filter (where outcome='W')::integer,
  'draws', count(*) filter (where outcome='D')::integer,
  'losses', count(*) filter (where outcome='L')::integer,
  'winRate', case when count(*)=0 then 0 else round(100.0 * count(*) filter (where outcome='W') / count(*), 1) end,
  'blackGames', count(*) filter (where player_color=1)::integer,
  'blackWins', count(*) filter (where player_color=1 and outcome='W')::integer,
  'whiteGames', count(*) filter (where player_color=2)::integer,
  'whiteWins', count(*) filter (where player_color=2 and outcome='W')::integer,
  'averageMoves', case when count(*)=0 then 0 else round(avg(move_count)::numeric, 1) end,
  'currentStreak', jsonb_build_object(
    'type', (select outcome from first_outcome),
    'count', coalesce((select count from current_streak),0)
  ),
  'longestWinStreak', coalesce((select max(wins) from win_runs),0),
  'recentForm', coalesce((
    select jsonb_agg(outcome order by rn)
    from ranked
    where rn <= 10
  ), '[]'::jsonb),
  'opponents', count(distinct opponent_id) filter (where opponent_id is not null)::integer,
  'firstGameAt', min(completed_at),
  'lastGameAt', max(completed_at)
)
from outcomes;
$$;

revoke all on function public.gomoku_player_stats(uuid) from public, anon, authenticated;
grant execute on function public.gomoku_player_stats(uuid) to service_role;
