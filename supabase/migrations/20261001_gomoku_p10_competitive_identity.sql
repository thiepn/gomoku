-- P10 competitive careers, earned achievements, and profile showcase.

create table if not exists public.gomoku_competitive_careers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  ranked_games integer not null default 0 check (ranked_games>=0),
  ranked_wins integer not null default 0 check (ranked_wins>=0),
  ranked_draws integer not null default 0 check (ranked_draws>=0),
  ranked_losses integer not null default 0 check (ranked_losses>=0),
  current_rating integer not null default 1500,
  peak_rating integer not null default 1500,
  current_ranked_win_streak integer not null default 0 check (current_ranked_win_streak>=0),
  best_ranked_win_streak integer not null default 0 check (best_ranked_win_streak>=0),
  tournament_entries integer not null default 0 check (tournament_entries>=0),
  tournament_matches integer not null default 0 check (tournament_matches>=0),
  tournament_match_wins integer not null default 0 check (tournament_match_wins>=0),
  tournament_finals integer not null default 0 check (tournament_finals>=0),
  tournament_titles integer not null default 0 check (tournament_titles>=0),
  seasons_played integer not null default 0 check (seasons_played>=0),
  best_season_rank integer,
  season_podiums integer not null default 0 check (season_podiums>=0),
  season_titles integer not null default 0 check (season_titles>=0),
  last_competitive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gomoku_competitive_careers_record_check check (ranked_games=ranked_wins+ranked_draws+ranked_losses),
  constraint gomoku_competitive_careers_rank_check check (best_season_rank is null or best_season_rank>=1)
);
create index if not exists gomoku_competitive_careers_peak_idx on public.gomoku_competitive_careers (peak_rating desc,ranked_games desc);
create index if not exists gomoku_competitive_careers_titles_idx on public.gomoku_competitive_careers (tournament_titles desc,season_titles desc,peak_rating desc);

create table if not exists public.gomoku_player_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_code text not null,
  earned_at timestamptz not null default now(),
  source_kind text,
  source_ref text,
  context jsonb not null default '{}'::jsonb,
  primary key(user_id,achievement_code),
  constraint gomoku_player_achievements_code_check check (achievement_code ~ '^[a-z][a-z0-9_]{2,47}$'),
  constraint gomoku_player_achievements_context_check check (jsonb_typeof(context)='object')
);
create index if not exists gomoku_player_achievements_earned_idx on public.gomoku_player_achievements (user_id,earned_at desc);
create index if not exists gomoku_player_achievements_code_idx on public.gomoku_player_achievements (achievement_code,earned_at);

create table if not exists public.gomoku_competitive_showcase (
  user_id uuid primary key references auth.users(id) on delete cascade,
  achievement_codes text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  constraint gomoku_competitive_showcase_limit_check check (cardinality(achievement_codes)<=3)
);

alter table public.gomoku_competitive_careers enable row level security;
alter table public.gomoku_player_achievements enable row level security;
alter table public.gomoku_competitive_showcase enable row level security;
revoke all on table public.gomoku_competitive_careers from public,anon,authenticated;
revoke all on table public.gomoku_player_achievements from public,anon,authenticated;
revoke all on table public.gomoku_competitive_showcase from public,anon,authenticated;
grant select,insert,update,delete on table public.gomoku_competitive_careers to service_role;
grant select,insert,update,delete on table public.gomoku_player_achievements to service_role;
grant select,insert,update,delete on table public.gomoku_competitive_showcase to service_role;

create or replace function public.gomoku_award_achievement(
  p_user_id uuid,p_code text,p_source_kind text default null,p_source_ref text default null,
  p_context jsonb default '{}'::jsonb,p_earned_at timestamptz default now()
) returns boolean
language plpgsql security invoker set search_path=''
as $$
declare v_n integer;
begin
  if p_user_id is null or p_code is null or p_code !~ '^[a-z][a-z0-9_]{2,47}$' then return false; end if;
  insert into public.gomoku_player_achievements(user_id,achievement_code,earned_at,source_kind,source_ref,context)
  values(
    p_user_id,p_code,coalesce(p_earned_at,now()),
    nullif(left(coalesce(p_source_kind,''),40),''),
    nullif(left(coalesce(p_source_ref,''),96),''),
    case when jsonb_typeof(coalesce(p_context,'{}'::jsonb))='object' then coalesce(p_context,'{}'::jsonb) else '{}'::jsonb end
  ) on conflict(user_id,achievement_code) do nothing;
  get diagnostics v_n=row_count;
  return v_n>0;
end $$;
revoke all on function public.gomoku_award_achievement(uuid,text,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.gomoku_award_achievement(uuid,text,text,text,jsonb,timestamptz) to service_role;

create or replace function public.gomoku_refresh_competitive_career(p_user_id uuid)
returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  u text; rg integer:=0; rw integer:=0; rd integer:=0; rl integer:=0; cr integer:=1500; pr integer:=1500;
  cs integer:=0; bs integer:=0; te integer:=0; tm integer:=0; tw integer:=0; tf integer:=0; tt integer:=0;
  sp integer:=0; br integer; podiums integer:=0; stitles integer:=0;
  lr timestamptz; lt timestamptz; first_ranked timestamptz; first_win timestamptz; first_cup timestamptz;
  first_cup_win timestamptz; first_final timestamptz; first_title timestamptz; first_season timestamptz;
  first_top10 timestamptz; first_podium timestamptz; first_season_title timestamptz;
begin
  if p_user_id is null then return null; end if;
  select username into u from public.leaderboard_profiles where user_id=p_user_id;
  if u is null then delete from public.gomoku_competitive_careers where user_id=p_user_id; return null; end if;

  select games,wins,draws,losses,rating,peak_rating,last_played_at
    into rg,rw,rd,rl,cr,pr,lr
  from public.gomoku_ratings where user_id=p_user_id;
  rg:=coalesce(rg,0); rw:=coalesce(rw,0); rd:=coalesce(rd,0); rl:=coalesce(rl,0);
  cr:=coalesce(cr,1500); pr:=coalesce(pr,cr,1500);

  with o as (
    select row_number() over(order by created_at,room_id,game_version) rn,
      ((black_user_id=p_user_id and winner_color=1) or (white_user_id=p_user_id and winner_color=2)) win
    from public.gomoku_rating_events where black_user_id=p_user_id or white_user_id=p_user_id
  ), g as (
    select rn,win,sum(case when win then 0 else 1 end) over(order by rn) grp from o
  ), streaks as (
    select grp,count(*)::integer n from g where win group by grp
  ), tail as (
    select coalesce(max(rn) filter(where not win),0) last_non_win from o
  )
  select coalesce((select max(n) from streaks),0),
         coalesce((select count(*)::integer from o,tail where win and rn>tail.last_non_win),0)
  into bs,cs;

  select min(created_at) into first_ranked from public.gomoku_rating_events
    where black_user_id=p_user_id or white_user_id=p_user_id;
  select min(created_at) into first_win from public.gomoku_rating_events
    where (black_user_id=p_user_id and winner_color=1) or (white_user_id=p_user_id and winner_color=2);

  select count(*)::integer,min(e.joined_at) into te,first_cup
  from public.gomoku_tournament_entries e join public.gomoku_tournaments t on t.id=e.tournament_id
  where e.user_id=p_user_id and t.status<>'cancelled';

  select count(*)::integer,count(*) filter(where winner_user_id=p_user_id)::integer,max(completed_at),
         min(completed_at) filter(where winner_user_id=p_user_id)
    into tm,tw,lt,first_cup_win
  from public.gomoku_tournament_matches
  where status='completed' and (player1_user_id=p_user_id or player2_user_id=p_user_id);

  select count(*)::integer,min(m.completed_at) into tf,first_final
  from public.gomoku_tournament_matches m join public.gomoku_tournaments t on t.id=m.tournament_id
  where t.status='completed' and m.round=case t.size when 4 then 2 when 8 then 3 else 99 end
    and (m.player1_user_id=p_user_id or m.player2_user_id=p_user_id);

  select count(*)::integer,min(completed_at) into tt,first_title
  from public.gomoku_tournaments where status='completed' and champion_user_id=p_user_id;

  with ranks as (
    select ss.user_id,s.status,s.starts_at,s.completed_at,
      row_number() over(partition by ss.season_id order by ss.points desc,ss.wins desc,ss.rating_current desc,ss.updated_at asc,ss.user_id)::integer r
    from public.gomoku_season_standings ss join public.gomoku_seasons s on s.id=ss.season_id
  ), mine as (select * from ranks where user_id=p_user_id)
  select count(*)::integer,min(r),
    count(*) filter(where status='completed' and r<=3)::integer,
    count(*) filter(where status='completed' and r=1)::integer,
    min(starts_at),
    min(completed_at) filter(where status='completed' and r<=10),
    min(completed_at) filter(where status='completed' and r<=3),
    min(completed_at) filter(where status='completed' and r=1)
  into sp,br,podiums,stitles,first_season,first_top10,first_podium,first_season_title from mine;

  insert into public.gomoku_competitive_careers(
    user_id,username,ranked_games,ranked_wins,ranked_draws,ranked_losses,current_rating,peak_rating,
    current_ranked_win_streak,best_ranked_win_streak,tournament_entries,tournament_matches,tournament_match_wins,
    tournament_finals,tournament_titles,seasons_played,best_season_rank,season_podiums,season_titles,last_competitive_at,updated_at
  ) values (
    p_user_id,u,rg,rw,rd,rl,cr,pr,cs,bs,te,tm,tw,tf,tt,sp,br,podiums,stitles,greatest(lr,lt),now()
  ) on conflict(user_id) do update set
    username=excluded.username,ranked_games=excluded.ranked_games,ranked_wins=excluded.ranked_wins,
    ranked_draws=excluded.ranked_draws,ranked_losses=excluded.ranked_losses,current_rating=excluded.current_rating,
    peak_rating=excluded.peak_rating,current_ranked_win_streak=excluded.current_ranked_win_streak,
    best_ranked_win_streak=excluded.best_ranked_win_streak,tournament_entries=excluded.tournament_entries,
    tournament_matches=excluded.tournament_matches,tournament_match_wins=excluded.tournament_match_wins,
    tournament_finals=excluded.tournament_finals,tournament_titles=excluded.tournament_titles,seasons_played=excluded.seasons_played,
    best_season_rank=excluded.best_season_rank,season_podiums=excluded.season_podiums,season_titles=excluded.season_titles,
    last_competitive_at=excluded.last_competitive_at,updated_at=now();

  if rg>=1 then perform public.gomoku_award_achievement(p_user_id,'ranked_debut','ranked',null,jsonb_build_object('games',rg),coalesce(first_ranked,now())); end if;
  if rg>=10 then perform public.gomoku_award_achievement(p_user_id,'ranked_10','ranked',null,jsonb_build_object('games',rg),coalesce(lr,now())); end if;
  if rg>=50 then perform public.gomoku_award_achievement(p_user_id,'ranked_50','ranked',null,jsonb_build_object('games',rg),coalesce(lr,now())); end if;
  if rg>=100 then perform public.gomoku_award_achievement(p_user_id,'ranked_100','ranked',null,jsonb_build_object('games',rg),coalesce(lr,now())); end if;
  if rw>=1 then perform public.gomoku_award_achievement(p_user_id,'first_ranked_win','ranked',null,jsonb_build_object('wins',rw),coalesce(first_win,now())); end if;
  if rw>=10 then perform public.gomoku_award_achievement(p_user_id,'ranked_wins_10','ranked',null,jsonb_build_object('wins',rw),coalesce(lr,now())); end if;
  if rw>=50 then perform public.gomoku_award_achievement(p_user_id,'ranked_wins_50','ranked',null,jsonb_build_object('wins',rw),coalesce(lr,now())); end if;
  if bs>=3 then perform public.gomoku_award_achievement(p_user_id,'streak_3','ranked',null,jsonb_build_object('bestStreak',bs),coalesce(lr,now())); end if;
  if bs>=5 then perform public.gomoku_award_achievement(p_user_id,'streak_5','ranked',null,jsonb_build_object('bestStreak',bs),coalesce(lr,now())); end if;
  if bs>=10 then perform public.gomoku_award_achievement(p_user_id,'streak_10','ranked',null,jsonb_build_object('bestStreak',bs),coalesce(lr,now())); end if;
  if pr>=1600 then perform public.gomoku_award_achievement(p_user_id,'rating_1600','rating',null,jsonb_build_object('peakRating',pr),coalesce(lr,now())); end if;
  if pr>=1800 then perform public.gomoku_award_achievement(p_user_id,'rating_1800','rating',null,jsonb_build_object('peakRating',pr),coalesce(lr,now())); end if;
  if pr>=2000 then perform public.gomoku_award_achievement(p_user_id,'rating_2000','rating',null,jsonb_build_object('peakRating',pr),coalesce(lr,now())); end if;
  if te>=1 then perform public.gomoku_award_achievement(p_user_id,'cup_debut','tournament',null,jsonb_build_object('entries',te),coalesce(first_cup,now())); end if;
  if te>=5 then perform public.gomoku_award_achievement(p_user_id,'cups_5','tournament',null,jsonb_build_object('entries',te),coalesce(lt,first_cup,now())); end if;
  if tw>=1 then perform public.gomoku_award_achievement(p_user_id,'cup_match_win','tournament',null,jsonb_build_object('wins',tw),coalesce(first_cup_win,now())); end if;
  if tf>=1 then perform public.gomoku_award_achievement(p_user_id,'cup_finalist','tournament',null,jsonb_build_object('finals',tf),coalesce(first_final,now())); end if;
  if tt>=1 then perform public.gomoku_award_achievement(p_user_id,'cup_champion','tournament',null,jsonb_build_object('titles',tt),coalesce(first_title,now())); end if;
  if tt>=3 then perform public.gomoku_award_achievement(p_user_id,'cup_champion_3','tournament',null,jsonb_build_object('titles',tt),coalesce(lt,first_title,now())); end if;
  if sp>=1 then perform public.gomoku_award_achievement(p_user_id,'season_debut','season',null,jsonb_build_object('seasons',sp),coalesce(first_season,now())); end if;
  if br is not null and br<=10 and first_top10 is not null then perform public.gomoku_award_achievement(p_user_id,'season_top10','season',null,jsonb_build_object('bestRank',br),first_top10); end if;
  if podiums>=1 then perform public.gomoku_award_achievement(p_user_id,'season_podium','season',null,jsonb_build_object('podiums',podiums),coalesce(first_podium,now())); end if;
  if stitles>=1 then perform public.gomoku_award_achievement(p_user_id,'season_champion','season',null,jsonb_build_object('titles',stitles),coalesce(first_season_title,now())); end if;

  return (select to_jsonb(c) from public.gomoku_competitive_careers c where c.user_id=p_user_id);
end $$;
revoke all on function public.gomoku_refresh_competitive_career(uuid) from public,anon,authenticated;
grant execute on function public.gomoku_refresh_competitive_career(uuid) to service_role;

create or replace function public.gomoku_set_competitive_showcase(p_user_id uuid,p_codes text[])
returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare c text[]:=coalesce(p_codes,'{}'::text[]); n integer;
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if cardinality(c)>3 then raise exception 'Showcase supports at most three achievements'; end if;
  select count(distinct x)::integer into n from unnest(c) x;
  if n<>cardinality(c) then raise exception 'Showcase achievements must be unique'; end if;
  if exists(select 1 from unnest(c) x where not exists(
    select 1 from public.gomoku_player_achievements a where a.user_id=p_user_id and a.achievement_code=x
  )) then raise exception 'Only earned achievements can be showcased'; end if;
  insert into public.gomoku_competitive_showcase(user_id,achievement_codes,updated_at)
  values(p_user_id,c,now())
  on conflict(user_id) do update set achievement_codes=excluded.achievement_codes,updated_at=now();
  return jsonb_build_object('achievementCodes',c,'updatedAt',now());
end $$;
revoke all on function public.gomoku_set_competitive_showcase(uuid,text[]) from public,anon,authenticated;
grant execute on function public.gomoku_set_competitive_showcase(uuid,text[]) to service_role;

create or replace function public.gomoku_competitive_from_rating_event() returns trigger
language plpgsql security invoker set search_path=''
as $$ begin perform public.gomoku_refresh_competitive_career(new.black_user_id); perform public.gomoku_refresh_competitive_career(new.white_user_id); return new; end $$;
revoke all on function public.gomoku_competitive_from_rating_event() from public,anon,authenticated;
drop trigger if exists gomoku_p10_rating_event_trigger on public.gomoku_rating_events;
create trigger gomoku_p10_rating_event_trigger after insert on public.gomoku_rating_events for each row execute function public.gomoku_competitive_from_rating_event();

create or replace function public.gomoku_competitive_from_tournament_entry() returns trigger
language plpgsql security invoker set search_path=''
as $$ begin perform public.gomoku_refresh_competitive_career(coalesce(new.user_id,old.user_id)); return coalesce(new,old); end $$;
revoke all on function public.gomoku_competitive_from_tournament_entry() from public,anon,authenticated;
drop trigger if exists gomoku_p10_tournament_entry_trigger on public.gomoku_tournament_entries;
create trigger gomoku_p10_tournament_entry_trigger after insert or delete on public.gomoku_tournament_entries for each row execute function public.gomoku_competitive_from_tournament_entry();

create or replace function public.gomoku_competitive_from_tournament_match() returns trigger
language plpgsql security invoker set search_path=''
as $$ begin
  if new.status='completed' and old.status is distinct from 'completed' then
    if new.player1_user_id is not null then perform public.gomoku_refresh_competitive_career(new.player1_user_id); end if;
    if new.player2_user_id is not null then perform public.gomoku_refresh_competitive_career(new.player2_user_id); end if;
  end if; return new;
end $$;
revoke all on function public.gomoku_competitive_from_tournament_match() from public,anon,authenticated;
drop trigger if exists gomoku_p10_tournament_match_trigger on public.gomoku_tournament_matches;
create trigger gomoku_p10_tournament_match_trigger after update of status,winner_user_id on public.gomoku_tournament_matches for each row execute function public.gomoku_competitive_from_tournament_match();

create or replace function public.gomoku_competitive_from_tournament() returns trigger
language plpgsql security invoker set search_path=''
as $$ declare r record; begin
  if new.status is distinct from old.status and new.status in ('completed','cancelled') then
    for r in select user_id from public.gomoku_tournament_entries where tournament_id=new.id loop
      perform public.gomoku_refresh_competitive_career(r.user_id);
    end loop;
  end if; return new;
end $$;
revoke all on function public.gomoku_competitive_from_tournament() from public,anon,authenticated;
drop trigger if exists gomoku_p10_tournament_trigger on public.gomoku_tournaments;
create trigger gomoku_p10_tournament_trigger after update of status,champion_user_id on public.gomoku_tournaments for each row execute function public.gomoku_competitive_from_tournament();

create or replace function public.gomoku_competitive_from_season() returns trigger
language plpgsql security invoker set search_path=''
as $$ declare r record; begin
  if new.status='completed' and old.status is distinct from 'completed' then
    for r in select user_id from public.gomoku_season_standings where season_id=new.id loop
      perform public.gomoku_refresh_competitive_career(r.user_id);
    end loop;
  end if; return new;
end $$;
revoke all on function public.gomoku_competitive_from_season() from public,anon,authenticated;
drop trigger if exists gomoku_p10_season_trigger on public.gomoku_seasons;
create trigger gomoku_p10_season_trigger after update of status on public.gomoku_seasons for each row execute function public.gomoku_competitive_from_season();

create or replace function public.gomoku_competitive_from_profile() returns trigger
language plpgsql security invoker set search_path=''
as $$ begin if new.username is distinct from old.username then perform public.gomoku_refresh_competitive_career(new.user_id); end if; return new; end $$;
revoke all on function public.gomoku_competitive_from_profile() from public,anon,authenticated;
drop trigger if exists gomoku_p10_profile_trigger on public.leaderboard_profiles;
create trigger gomoku_p10_profile_trigger after update of username on public.leaderboard_profiles for each row execute function public.gomoku_competitive_from_profile();

do $$ declare r record; begin
  for r in select user_id from public.leaderboard_profiles loop perform public.gomoku_refresh_competitive_career(r.user_id); end loop;
end $$;

comment on table public.gomoku_competitive_careers is 'Server-owned projection of verified competitive accomplishments rebuilt from ranked, tournament, and season source tables.';
comment on table public.gomoku_player_achievements is 'Permanent earned competitive milestones; no XP, currency, paid progression, or daily grind.';
comment on table public.gomoku_competitive_showcase is 'Up to three earned achievements selected for a public competitive profile.';
