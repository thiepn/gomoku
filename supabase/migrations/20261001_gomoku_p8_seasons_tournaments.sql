-- P8 — Competitive Seasons & Tournaments
-- Server-owned competitive metadata. Public clients access this only through gomoku-room.

alter table public.gomoku_matches
  drop constraint if exists gomoku_matches_mode_check;

alter table public.gomoku_matches
  add constraint gomoku_matches_mode_check
  check (match_mode in ('casual','ranked','tournament'));

create table if not exists public.gomoku_seasons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'upcoming'
    check (status in ('upcoming','active','completed')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint gomoku_seasons_window_check check (ends_at > starts_at),
  constraint gomoku_seasons_code_check check (code ~ '^[a-z0-9][a-z0-9-]{2,31}$')
);

create unique index if not exists gomoku_seasons_one_active_idx
  on public.gomoku_seasons ((status))
  where status='active';

create table if not exists public.gomoku_season_standings (
  season_id uuid not null references public.gomoku_seasons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  losses integer not null default 0 check (losses >= 0),
  points integer not null default 0 check (points >= 0),
  rating_start integer not null default 1500,
  rating_current integer not null default 1500,
  rating_delta integer not null default 0,
  last_played_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (season_id,user_id),
  constraint gomoku_season_standings_record_check check (games = wins + draws + losses)
);

create index if not exists gomoku_season_standings_board_idx
  on public.gomoku_season_standings
  (season_id,points desc,wins desc,rating_current desc,updated_at asc);

create table if not exists public.gomoku_tournaments (
  id text primary key,
  name text not null,
  organizer_user_id uuid not null references auth.users(id) on delete cascade,
  organizer_username text not null,
  size smallint not null check (size in (4,8)),
  status text not null default 'registration'
    check (status in ('registration','active','completed','cancelled')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  champion_user_id uuid references auth.users(id) on delete set null,
  champion_username text,
  constraint gomoku_tournaments_id_check check (id ~ '^CUP-[A-Z0-9]{8,16}$'),
  constraint gomoku_tournaments_name_check check (char_length(name) between 3 and 48)
);

create index if not exists gomoku_tournaments_status_idx
  on public.gomoku_tournaments (status,created_at desc);

create table if not exists public.gomoku_tournament_entries (
  tournament_id text not null references public.gomoku_tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  seed smallint,
  joined_at timestamptz not null default now(),
  eliminated_at timestamptz,
  primary key (tournament_id,user_id),
  unique (tournament_id,username)
);

create index if not exists gomoku_tournament_entries_seed_idx
  on public.gomoku_tournament_entries (tournament_id,seed);

create table if not exists public.gomoku_tournament_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.gomoku_tournaments(id) on delete cascade,
  round smallint not null check (round between 1 and 8),
  slot smallint not null check (slot between 1 and 64),
  player1_user_id uuid references auth.users(id) on delete cascade,
  player1_username text,
  player2_user_id uuid references auth.users(id) on delete cascade,
  player2_username text,
  room_id text unique references public.gomoku_rooms(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','ready','active','completed')),
  winner_user_id uuid references auth.users(id) on delete set null,
  winner_username text,
  result_reason text,
  replay_count smallint not null default 0 check (replay_count between 0 and 20),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id,round,slot),
  constraint gomoku_tournament_match_distinct_players check (
    player1_user_id is null or player2_user_id is null or player1_user_id <> player2_user_id
  )
);

create index if not exists gomoku_tournament_matches_status_idx
  on public.gomoku_tournament_matches (tournament_id,status,round,slot);

alter table public.gomoku_seasons enable row level security;
alter table public.gomoku_season_standings enable row level security;
alter table public.gomoku_tournaments enable row level security;
alter table public.gomoku_tournament_entries enable row level security;
alter table public.gomoku_tournament_matches enable row level security;

revoke all on table public.gomoku_seasons from public, anon, authenticated;
revoke all on table public.gomoku_season_standings from public, anon, authenticated;
revoke all on table public.gomoku_tournaments from public, anon, authenticated;
revoke all on table public.gomoku_tournament_entries from public, anon, authenticated;
revoke all on table public.gomoku_tournament_matches from public, anon, authenticated;

grant select,insert,update,delete on table public.gomoku_seasons to service_role;
grant select,insert,update,delete on table public.gomoku_season_standings to service_role;
grant select,insert,update,delete on table public.gomoku_tournaments to service_role;
grant select,insert,update,delete on table public.gomoku_tournament_entries to service_role;
grant select,insert,update,delete on table public.gomoku_tournament_matches to service_role;

create or replace function public.gomoku_record_season_rating_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_black_username text;
  v_white_username text;
  v_black_points integer;
  v_white_points integer;
begin
  select s.id into v_season_id
  from public.gomoku_seasons s
  where s.status='active'
    and new.created_at >= s.starts_at
    and new.created_at < s.ends_at
  order by s.starts_at desc
  limit 1;

  if v_season_id is null then return new; end if;

  select lp.username into v_black_username
  from public.leaderboard_profiles lp
  where lp.user_id=new.black_user_id;
  select lp.username into v_white_username
  from public.leaderboard_profiles lp
  where lp.user_id=new.white_user_id;

  v_black_username := coalesce(v_black_username,'Player');
  v_white_username := coalesce(v_white_username,'Player');
  v_black_points := case new.winner_color when 1 then 3 when 0 then 1 else 0 end;
  v_white_points := case new.winner_color when 2 then 3 when 0 then 1 else 0 end;

  insert into public.gomoku_season_standings(
    season_id,user_id,username,games,wins,draws,losses,points,
    rating_start,rating_current,rating_delta,last_played_at,updated_at
  ) values (
    v_season_id,new.black_user_id,v_black_username,1,
    case when new.winner_color=1 then 1 else 0 end,
    case when new.winner_color=0 then 1 else 0 end,
    case when new.winner_color=2 then 1 else 0 end,
    v_black_points,new.black_before,new.black_after,new.black_after-new.black_before,
    new.created_at,now()
  )
  on conflict (season_id,user_id) do update set
    username=excluded.username,
    games=public.gomoku_season_standings.games+1,
    wins=public.gomoku_season_standings.wins+excluded.wins,
    draws=public.gomoku_season_standings.draws+excluded.draws,
    losses=public.gomoku_season_standings.losses+excluded.losses,
    points=public.gomoku_season_standings.points+excluded.points,
    rating_current=excluded.rating_current,
    rating_delta=excluded.rating_current-public.gomoku_season_standings.rating_start,
    last_played_at=excluded.last_played_at,
    updated_at=now();

  insert into public.gomoku_season_standings(
    season_id,user_id,username,games,wins,draws,losses,points,
    rating_start,rating_current,rating_delta,last_played_at,updated_at
  ) values (
    v_season_id,new.white_user_id,v_white_username,1,
    case when new.winner_color=2 then 1 else 0 end,
    case when new.winner_color=0 then 1 else 0 end,
    case when new.winner_color=1 then 1 else 0 end,
    v_white_points,new.white_before,new.white_after,new.white_after-new.white_before,
    new.created_at,now()
  )
  on conflict (season_id,user_id) do update set
    username=excluded.username,
    games=public.gomoku_season_standings.games+1,
    wins=public.gomoku_season_standings.wins+excluded.wins,
    draws=public.gomoku_season_standings.draws+excluded.draws,
    losses=public.gomoku_season_standings.losses+excluded.losses,
    points=public.gomoku_season_standings.points+excluded.points,
    rating_current=excluded.rating_current,
    rating_delta=excluded.rating_current-public.gomoku_season_standings.rating_start,
    last_played_at=excluded.last_played_at,
    updated_at=now();

  return new;
end;
$$;

revoke all on function public.gomoku_record_season_rating_event() from public,anon,authenticated;

drop trigger if exists gomoku_season_rating_event_trigger on public.gomoku_rating_events;
create trigger gomoku_season_rating_event_trigger
after insert on public.gomoku_rating_events
for each row execute function public.gomoku_record_season_rating_event();

create or replace function public.gomoku_create_tournament(
  p_user_id uuid,
  p_username text,
  p_name text,
  p_size integer default 8
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id text;
  v_name text;
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'A public player username is required';
  end if;
  if p_size not in (4,8) then raise exception 'Tournament size must be 4 or 8'; end if;
  v_name := btrim(coalesce(p_name,''));
  if char_length(v_name) < 3 or char_length(v_name) > 48 then
    raise exception 'Tournament name must be 3-48 characters';
  end if;

  v_id := 'CUP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  insert into public.gomoku_tournaments(id,name,organizer_user_id,organizer_username,size)
  values(v_id,v_name,p_user_id,p_username,p_size);
  insert into public.gomoku_tournament_entries(tournament_id,user_id,username)
  values(v_id,p_user_id,p_username);

  return jsonb_build_object('id',v_id,'status','registration','size',p_size,'joined',1);
end;
$$;

revoke all on function public.gomoku_create_tournament(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.gomoku_create_tournament(uuid,text,text,integer) to service_role;

create or replace function public.gomoku_join_tournament(
  p_tournament_id text,
  p_user_id uuid,
  p_username text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_t public.gomoku_tournaments%rowtype;
  v_count integer;
  v_slot integer;
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'A public player username is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_tournament_id,''),0));
  select * into v_t from public.gomoku_tournaments where id=p_tournament_id for update;
  if v_t.id is null then raise exception 'Tournament not found'; end if;
  if v_t.status <> 'registration' then raise exception 'Tournament registration is closed'; end if;

  insert into public.gomoku_tournament_entries(tournament_id,user_id,username)
  values(v_t.id,p_user_id,p_username)
  on conflict (tournament_id,user_id) do update set username=excluded.username;

  select count(*) into v_count from public.gomoku_tournament_entries where tournament_id=v_t.id;
  if v_count > v_t.size then
    raise exception 'Tournament is full';
  end if;

  if v_count = v_t.size then
    with ranked as (
      select e.user_id,
             row_number() over (
               order by coalesce(r.rating,1500) desc,e.joined_at,e.user_id
             )::smallint as seed
      from public.gomoku_tournament_entries e
      left join public.gomoku_ratings r on r.user_id=e.user_id
      where e.tournament_id=v_t.id
    )
    update public.gomoku_tournament_entries e
    set seed=ranked.seed
    from ranked
    where e.tournament_id=v_t.id and e.user_id=ranked.user_id;

    for v_slot in 1..(v_t.size/2) loop
      insert into public.gomoku_tournament_matches(
        tournament_id,round,slot,
        player1_user_id,player1_username,
        player2_user_id,player2_username,status
      )
      select v_t.id,1,v_slot,
             a.user_id,a.username,b.user_id,b.username,'ready'
      from public.gomoku_tournament_entries a
      join public.gomoku_tournament_entries b
        on b.tournament_id=a.tournament_id
       and b.seed=(v_t.size+1-v_slot)
      where a.tournament_id=v_t.id and a.seed=v_slot
      on conflict (tournament_id,round,slot) do nothing;
    end loop;

    update public.gomoku_tournaments
    set status='active',started_at=now()
    where id=v_t.id;

    return jsonb_build_object('id',v_t.id,'status','active','size',v_t.size,'joined',v_count,'started',true);
  end if;

  return jsonb_build_object('id',v_t.id,'status','registration','size',v_t.size,'joined',v_count,'started',false);
end;
$$;

revoke all on function public.gomoku_join_tournament(text,uuid,text) from public,anon,authenticated;
grant execute on function public.gomoku_join_tournament(text,uuid,text) to service_role;

create or replace function public.gomoku_leave_tournament(
  p_tournament_id text,
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_t public.gomoku_tournaments%rowtype;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_tournament_id,''),0));
  select * into v_t from public.gomoku_tournaments where id=p_tournament_id for update;
  if v_t.id is null then raise exception 'Tournament not found'; end if;
  if v_t.status <> 'registration' then raise exception 'Tournament registration is closed'; end if;
  if v_t.organizer_user_id=p_user_id then raise exception 'The organizer cannot leave their own tournament'; end if;
  delete from public.gomoku_tournament_entries where tournament_id=v_t.id and user_id=p_user_id;
  select count(*) into v_count from public.gomoku_tournament_entries where tournament_id=v_t.id;
  return jsonb_build_object('id',v_t.id,'status',v_t.status,'joined',v_count,'left',true);
end;
$$;

revoke all on function public.gomoku_leave_tournament(text,uuid) from public,anon,authenticated;
grant execute on function public.gomoku_leave_tournament(text,uuid) to service_role;

create or replace function public.gomoku_advance_tournament_match(
  p_room_id text,
  p_winner_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_m public.gomoku_tournament_matches%rowtype;
  v_t public.gomoku_tournaments%rowtype;
  v_total_rounds integer;
  v_next_round integer;
  v_next_slot integer;
  v_next_id uuid;
  v_winner_name text;
  v_loser uuid;
  v_ready boolean := false;
begin
  select * into v_m
  from public.gomoku_tournament_matches
  where room_id=p_room_id
  for update;

  if v_m.id is null then return jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); end if;
  select * into v_t from public.gomoku_tournaments where id=v_m.tournament_id for update;

  if v_m.status='completed' then
    return jsonb_build_object('ok',true,'alreadyComplete',true,'tournamentId',v_m.tournament_id);
  end if;

  if p_winner_user_id is null then
    update public.gomoku_tournament_matches
    set room_id=null,status='ready',replay_count=replay_count+1,result_reason=coalesce(p_reason,'draw-replay')
    where id=v_m.id;
    return jsonb_build_object('ok',true,'replay',true,'tournamentId',v_m.tournament_id,'matchId',v_m.id);
  end if;

  if p_winner_user_id=v_m.player1_user_id then
    v_winner_name:=v_m.player1_username; v_loser:=v_m.player2_user_id;
  elsif p_winner_user_id=v_m.player2_user_id then
    v_winner_name:=v_m.player2_username; v_loser:=v_m.player1_user_id;
  else
    raise exception 'Winner is not a participant in this tournament match';
  end if;

  update public.gomoku_tournament_matches
  set status='completed',winner_user_id=p_winner_user_id,winner_username=v_winner_name,
      result_reason=coalesce(p_reason,'win'),completed_at=now()
  where id=v_m.id;

  update public.gomoku_tournament_entries
  set eliminated_at=coalesce(eliminated_at,now())
  where tournament_id=v_m.tournament_id and user_id=v_loser;

  v_total_rounds := case v_t.size when 4 then 2 when 8 then 3 else 3 end;
  if v_m.round >= v_total_rounds then
    update public.gomoku_tournaments
    set status='completed',completed_at=now(),
        champion_user_id=p_winner_user_id,champion_username=v_winner_name
    where id=v_m.tournament_id;
    return jsonb_build_object('ok',true,'completed',true,'tournamentId',v_m.tournament_id,'champion',v_winner_name);
  end if;

  v_next_round:=v_m.round+1;
  v_next_slot:=((v_m.slot+1)/2)::integer;

  if mod(v_m.slot,2)=1 then
    insert into public.gomoku_tournament_matches(
      tournament_id,round,slot,player1_user_id,player1_username,status
    ) values (
      v_m.tournament_id,v_next_round,v_next_slot,p_winner_user_id,v_winner_name,'pending'
    )
    on conflict (tournament_id,round,slot) do update set
      player1_user_id=excluded.player1_user_id,
      player1_username=excluded.player1_username
    returning id into v_next_id;
  else
    insert into public.gomoku_tournament_matches(
      tournament_id,round,slot,player2_user_id,player2_username,status
    ) values (
      v_m.tournament_id,v_next_round,v_next_slot,p_winner_user_id,v_winner_name,'pending'
    )
    on conflict (tournament_id,round,slot) do update set
      player2_user_id=excluded.player2_user_id,
      player2_username=excluded.player2_username
    returning id into v_next_id;
  end if;

  update public.gomoku_tournament_matches
  set status='ready'
  where id=v_next_id and player1_user_id is not null and player2_user_id is not null;

  select status='ready' into v_ready from public.gomoku_tournament_matches where id=v_next_id;
  return jsonb_build_object(
    'ok',true,'completed',false,'tournamentId',v_m.tournament_id,
    'nextMatchId',v_next_id,'nextReady',coalesce(v_ready,false)
  );
end;
$$;

revoke all on function public.gomoku_advance_tournament_match(text,uuid,text) from public,anon,authenticated;
grant execute on function public.gomoku_advance_tournament_match(text,uuid,text) to service_role;

insert into public.gomoku_seasons(code,name,status,starts_at,ends_at)
values('2026-q4','2026 Season 4','active','2026-10-01 00:00:00+00','2027-01-01 00:00:00+00')
on conflict (code) do update set
  name=excluded.name,
  status=case when public.gomoku_seasons.status='completed' then public.gomoku_seasons.status else excluded.status end,
  starts_at=excluded.starts_at,
  ends_at=excluded.ends_at;

comment on table public.gomoku_seasons is 'Official Gomoku ranked seasons. Access is mediated by gomoku-room.';
comment on table public.gomoku_season_standings is 'Server-owned seasonal standings derived from ranked rating events.';
comment on table public.gomoku_tournaments is 'Server-owned online single-elimination Renju tournaments.';
comment on table public.gomoku_tournament_entries is 'Tournament registrations and seeds; clients cannot write directly.';
comment on table public.gomoku_tournament_matches is 'Tournament bracket matches and authoritative room bindings.';
