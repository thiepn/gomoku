-- P9 — Competitive Operations, Spectating & Event Polish
-- Adds lifecycle operations, check-in/forfeit handling, event journaling and automatic season rollover.

alter table public.gomoku_seasons
  add column if not exists completed_at timestamptz,
  add column if not exists champion_user_id uuid references auth.users(id) on delete set null,
  add column if not exists champion_username text,
  add column if not exists participant_count integer not null default 0 check (participant_count >= 0);

create index if not exists gomoku_seasons_champion_idx
  on public.gomoku_seasons (champion_user_id)
  where champion_user_id is not null;

alter table public.gomoku_tournaments
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

alter table public.gomoku_tournament_matches
  drop constraint if exists gomoku_tournament_matches_status_check;

alter table public.gomoku_tournament_matches
  add constraint gomoku_tournament_matches_status_check
  check (status in ('pending','ready','active','completed','cancelled'));

alter table public.gomoku_tournament_matches
  add column if not exists player1_checked_in_at timestamptz,
  add column if not exists player2_checked_in_at timestamptz,
  add column if not exists ready_deadline timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists last_activity_at timestamptz,
  add column if not exists forfeit_loser_user_id uuid references auth.users(id) on delete set null;

create index if not exists gomoku_tournament_matches_deadline_idx
  on public.gomoku_tournament_matches (ready_deadline)
  where status='active' and started_at is null;

create index if not exists gomoku_tournament_matches_forfeit_loser_idx
  on public.gomoku_tournament_matches (forfeit_loser_user_id)
  where forfeit_loser_user_id is not null;

create table if not exists public.gomoku_tournament_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.gomoku_tournaments(id) on delete cascade,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_-]{1,39}$'),
  round smallint,
  slot smallint,
  match_id uuid references public.gomoku_tournament_matches(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_username text,
  subject_user_id uuid references auth.users(id) on delete set null,
  subject_username text,
  message text,
  created_at timestamptz not null default now(),
  constraint gomoku_tournament_events_message_check
    check (message is null or char_length(message) <= 180)
);

create index if not exists gomoku_tournament_events_timeline_idx
  on public.gomoku_tournament_events (tournament_id,created_at desc);

create index if not exists gomoku_tournament_events_match_idx
  on public.gomoku_tournament_events (match_id,created_at desc)
  where match_id is not null;

create index if not exists gomoku_tournament_events_actor_idx
  on public.gomoku_tournament_events (actor_user_id)
  where actor_user_id is not null;

create index if not exists gomoku_tournament_events_subject_idx
  on public.gomoku_tournament_events (subject_user_id)
  where subject_user_id is not null;

alter table public.gomoku_tournament_events enable row level security;
revoke all on table public.gomoku_tournament_events from public, anon, authenticated;
grant select,insert,update,delete on table public.gomoku_tournament_events to service_role;

create or replace function public.gomoku_tournament_event(
  p_tournament_id text,
  p_event_type text,
  p_match_id uuid default null,
  p_round integer default null,
  p_slot integer default null,
  p_actor_user_id uuid default null,
  p_actor_username text default null,
  p_subject_user_id uuid default null,
  p_subject_username text default null,
  p_message text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_tournament_id is null or p_event_type is null then return null; end if;
  insert into public.gomoku_tournament_events(
    tournament_id,event_type,match_id,round,slot,
    actor_user_id,actor_username,subject_user_id,subject_username,message
  ) values (
    p_tournament_id,left(p_event_type,40),p_match_id,p_round,p_slot,
    p_actor_user_id,left(coalesce(p_actor_username,''),20),
    p_subject_user_id,left(coalesce(p_subject_username,''),20),
    nullif(left(coalesce(p_message,''),180),'')
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.gomoku_tournament_event(text,text,uuid,integer,integer,uuid,text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_tournament_event(text,text,uuid,integer,integer,uuid,text,uuid,text,text)
  to service_role;

create or replace function public.gomoku_ensure_current_season(p_at timestamptz default now())
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old public.gomoku_seasons%rowtype;
  v_champion public.gomoku_season_standings%rowtype;
  v_current public.gomoku_seasons%rowtype;
  v_qstart timestamptz;
  v_qend timestamptz;
  v_year integer;
  v_quarter integer;
  v_code text;
  v_name text;
  v_count integer;
begin
  for v_old in
    select * from public.gomoku_seasons
    where status='active' and ends_at <= p_at
    order by ends_at
    for update
  loop
    select * into v_champion
    from public.gomoku_season_standings
    where season_id=v_old.id
    order by points desc,wins desc,rating_current desc,updated_at asc
    limit 1;

    select count(*) into v_count
    from public.gomoku_season_standings
    where season_id=v_old.id;

    update public.gomoku_seasons
    set status='completed',
        completed_at=coalesce(completed_at,p_at),
        champion_user_id=v_champion.user_id,
        champion_username=v_champion.username,
        participant_count=v_count
    where id=v_old.id;
  end loop;

  update public.gomoku_seasons
  set status='upcoming'
  where status='active' and starts_at > p_at;

  select * into v_current
  from public.gomoku_seasons
  where status='active' and starts_at <= p_at and ends_at > p_at
  order by starts_at desc
  limit 1;

  if v_current.id is not null then
    return jsonb_build_object(
      'id',v_current.id,'code',v_current.code,'name',v_current.name,'status',v_current.status,
      'startsAt',v_current.starts_at,'endsAt',v_current.ends_at
    );
  end if;

  v_qstart := date_trunc('quarter',p_at);
  v_qend := v_qstart + interval '3 months';
  v_year := extract(year from v_qstart)::integer;
  v_quarter := extract(quarter from v_qstart)::integer;
  v_code := v_year::text || '-q' || v_quarter::text;
  v_name := v_year::text || ' Season ' || v_quarter::text;

  insert into public.gomoku_seasons(code,name,status,starts_at,ends_at)
  values(v_code,v_name,'active',v_qstart,v_qend)
  on conflict (code) do update set
    name=excluded.name,
    status=case when public.gomoku_seasons.status='completed' then 'completed' else 'active' end,
    starts_at=excluded.starts_at,
    ends_at=excluded.ends_at
  returning * into v_current;

  if v_current.status <> 'active' then return null; end if;

  return jsonb_build_object(
    'id',v_current.id,'code',v_current.code,'name',v_current.name,'status',v_current.status,
    'startsAt',v_current.starts_at,'endsAt',v_current.ends_at
  );
end;
$$;

revoke all on function public.gomoku_ensure_current_season(timestamptz) from public,anon,authenticated;
grant execute on function public.gomoku_ensure_current_season(timestamptz) to service_role;

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
  perform public.gomoku_ensure_current_season(new.created_at);

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
  insert into public.gomoku_tournaments(id,name,organizer_user_id,organizer_username,size,updated_at)
  values(v_id,v_name,p_user_id,p_username,p_size,now());
  insert into public.gomoku_tournament_entries(tournament_id,user_id,username)
  values(v_id,p_user_id,p_username);

  perform public.gomoku_tournament_event(
    v_id,'created',null,null,null,p_user_id,p_username,p_user_id,p_username,
    'Tournament created'
  );

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
  v_already boolean;
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'A public player username is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_tournament_id,''),0));
  select * into v_t from public.gomoku_tournaments where id=p_tournament_id for update;
  if v_t.id is null then raise exception 'Tournament not found'; end if;
  if v_t.status <> 'registration' then raise exception 'Tournament registration is closed'; end if;

  select exists(
    select 1 from public.gomoku_tournament_entries
    where tournament_id=v_t.id and user_id=p_user_id
  ) into v_already;

  insert into public.gomoku_tournament_entries(tournament_id,user_id,username)
  values(v_t.id,p_user_id,p_username)
  on conflict (tournament_id,user_id) do update set username=excluded.username;

  if not v_already then
    perform public.gomoku_tournament_event(
      v_t.id,'joined',null,null,null,p_user_id,p_username,p_user_id,p_username,
      'Player joined'
    );
  end if;

  select count(*) into v_count from public.gomoku_tournament_entries where tournament_id=v_t.id;
  if v_count > v_t.size then raise exception 'Tournament is full'; end if;

  update public.gomoku_tournaments set updated_at=now() where id=v_t.id;

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
    set status='active',started_at=now(),updated_at=now()
    where id=v_t.id;

    perform public.gomoku_tournament_event(
      v_t.id,'started',null,null,null,null,null,null,null,
      'Bracket seeded and tournament started'
    );

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
  v_username text;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_tournament_id,''),0));
  select * into v_t from public.gomoku_tournaments where id=p_tournament_id for update;
  if v_t.id is null then raise exception 'Tournament not found'; end if;
  if v_t.status <> 'registration' then raise exception 'Tournament registration is closed'; end if;
  if v_t.organizer_user_id=p_user_id then raise exception 'The organizer cannot leave their own tournament'; end if;

  delete from public.gomoku_tournament_entries
  where tournament_id=v_t.id and user_id=p_user_id
  returning username into v_username;

  if v_username is not null then
    perform public.gomoku_tournament_event(
      v_t.id,'left',null,null,null,p_user_id,v_username,p_user_id,v_username,'Player left'
    );
  end if;

  update public.gomoku_tournaments set updated_at=now() where id=v_t.id;
  select count(*) into v_count from public.gomoku_tournament_entries where tournament_id=v_t.id;
  return jsonb_build_object('id',v_t.id,'status',v_t.status,'joined',v_count,'left',v_username is not null);
end;
$$;

revoke all on function public.gomoku_leave_tournament(text,uuid) from public,anon,authenticated;
grant execute on function public.gomoku_leave_tournament(text,uuid) to service_role;

create or replace function public.gomoku_checkin_tournament_match(
  p_match_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_m public.gomoku_tournament_matches%rowtype;
  v_t public.gomoku_tournaments%rowtype;
  v_username text;
  v_new boolean := false;
begin
  select * into v_m from public.gomoku_tournament_matches where id=p_match_id for update;
  if v_m.id is null then raise exception 'Tournament match not found'; end if;
  select * into v_t from public.gomoku_tournaments where id=v_m.tournament_id;
  if v_t.status <> 'active' or v_m.status <> 'active' then
    raise exception 'Tournament match is not active';
  end if;

  if p_user_id=v_m.player1_user_id then
    v_username:=v_m.player1_username;
    if v_m.player1_checked_in_at is null then
      update public.gomoku_tournament_matches
      set player1_checked_in_at=now(),
          ready_deadline=coalesce(ready_deadline,now()+interval '10 minutes'),
          last_activity_at=now()
      where id=v_m.id;
      v_new:=true;
    end if;
  elsif p_user_id=v_m.player2_user_id then
    v_username:=v_m.player2_username;
    if v_m.player2_checked_in_at is null then
      update public.gomoku_tournament_matches
      set player2_checked_in_at=now(),
          ready_deadline=coalesce(ready_deadline,now()+interval '10 minutes'),
          last_activity_at=now()
      where id=v_m.id;
      v_new:=true;
    end if;
  else
    raise exception 'Player is not assigned to this match';
  end if;

  if v_new then
    perform public.gomoku_tournament_event(
      v_m.tournament_id,'check_in',v_m.id,v_m.round,v_m.slot,
      p_user_id,v_username,p_user_id,v_username,'Player checked in'
    );
  end if;

  select * into v_m from public.gomoku_tournament_matches where id=p_match_id;
  return jsonb_build_object(
    'matchId',v_m.id,
    'checkedIn',true,
    'bothCheckedIn',v_m.player1_checked_in_at is not null and v_m.player2_checked_in_at is not null,
    'readyDeadline',v_m.ready_deadline
  );
end;
$$;

revoke all on function public.gomoku_checkin_tournament_match(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gomoku_checkin_tournament_match(uuid,uuid) to service_role;

create or replace function public.gomoku_mark_tournament_match_started(p_room_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_m public.gomoku_tournament_matches%rowtype;
  v_first boolean := false;
begin
  select * into v_m
  from public.gomoku_tournament_matches
  where room_id=p_room_id and status='active'
  for update;

  if v_m.id is null then return jsonb_build_object('ok',false,'code','MATCH_NOT_FOUND'); end if;

  if v_m.started_at is null then
    update public.gomoku_tournament_matches
    set started_at=now(),last_activity_at=now()
    where id=v_m.id;
    v_first:=true;
    perform public.gomoku_tournament_event(
      v_m.tournament_id,'match_started',v_m.id,v_m.round,v_m.slot,
      null,null,null,null,'First move played'
    );
  else
    update public.gomoku_tournament_matches set last_activity_at=now() where id=v_m.id;
  end if;

  return jsonb_build_object('ok',true,'firstMove',v_first,'matchId',v_m.id);
end;
$$;

revoke all on function public.gomoku_mark_tournament_match_started(text) from public,anon,authenticated;
grant execute on function public.gomoku_mark_tournament_match_started(text) to service_role;

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
  v_loser_name text;
  v_ready boolean := false;
  v_reason text := left(coalesce(p_reason,'win'),80);
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
  if v_t.status <> 'active' then
    return jsonb_build_object('ok',false,'code','TOURNAMENT_NOT_ACTIVE','tournamentId',v_m.tournament_id);
  end if;

  if p_winner_user_id is null then
    update public.gomoku_tournament_matches
    set room_id=null,status='ready',replay_count=replay_count+1,
        result_reason=coalesce(nullif(v_reason,''),'draw-replay'),
        player1_checked_in_at=null,player2_checked_in_at=null,
        ready_deadline=null,started_at=null,last_activity_at=now()
    where id=v_m.id;

    perform public.gomoku_tournament_event(
      v_m.tournament_id,'replay',v_m.id,v_m.round,v_m.slot,
      null,null,null,null,'Drawn match queued for replay'
    );
    update public.gomoku_tournaments set updated_at=now() where id=v_m.tournament_id;

    return jsonb_build_object('ok',true,'replay',true,'tournamentId',v_m.tournament_id,'matchId',v_m.id);
  end if;

  if p_winner_user_id=v_m.player1_user_id then
    v_winner_name:=v_m.player1_username; v_loser:=v_m.player2_user_id; v_loser_name:=v_m.player2_username;
  elsif p_winner_user_id=v_m.player2_user_id then
    v_winner_name:=v_m.player2_username; v_loser:=v_m.player1_user_id; v_loser_name:=v_m.player1_username;
  else
    raise exception 'Winner is not a participant in this tournament match';
  end if;

  update public.gomoku_tournament_matches
  set status='completed',winner_user_id=p_winner_user_id,winner_username=v_winner_name,
      forfeit_loser_user_id=case when v_reason like 'forfeit%' then v_loser else forfeit_loser_user_id end,
      result_reason=v_reason,completed_at=now(),last_activity_at=now()
  where id=v_m.id;

  update public.gomoku_tournament_entries
  set eliminated_at=coalesce(eliminated_at,now())
  where tournament_id=v_m.tournament_id and user_id=v_loser;

  perform public.gomoku_tournament_event(
    v_m.tournament_id,
    case when v_reason like 'forfeit%' then 'forfeit' else 'match_completed' end,
    v_m.id,v_m.round,v_m.slot,
    null,null,p_winner_user_id,v_winner_name,
    case when v_reason like 'forfeit%' then 'Match awarded by forfeit' else 'Match completed' end
  );

  v_total_rounds := case v_t.size when 4 then 2 when 8 then 3 else 3 end;
  if v_m.round >= v_total_rounds then
    update public.gomoku_tournaments
    set status='completed',completed_at=now(),updated_at=now(),
        champion_user_id=p_winner_user_id,champion_username=v_winner_name
    where id=v_m.tournament_id;

    perform public.gomoku_tournament_event(
      v_m.tournament_id,'champion',v_m.id,v_m.round,v_m.slot,
      null,null,p_winner_user_id,v_winner_name,'Tournament completed'
    );

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
  update public.gomoku_tournaments set updated_at=now() where id=v_m.tournament_id;

  if v_ready then
    perform public.gomoku_tournament_event(
      v_m.tournament_id,'next_match_ready',v_next_id,v_next_round,v_next_slot,
      null,null,null,null,'Next bracket match is ready'
    );
  end if;

  return jsonb_build_object(
    'ok',true,'completed',false,'tournamentId',v_m.tournament_id,
    'nextMatchId',v_next_id,'nextReady',coalesce(v_ready,false)
  );
end;
$$;

revoke all on function public.gomoku_advance_tournament_match(text,uuid,text) from public,anon,authenticated;
grant execute on function public.gomoku_advance_tournament_match(text,uuid,text) to service_role;

create or replace function public.gomoku_organizer_tournament_action(
  p_tournament_id text,
  p_user_id uuid,
  p_action text,
  p_match_id uuid default null,
  p_target_user_id uuid default null,
  p_text text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_t public.gomoku_tournaments%rowtype;
  v_m public.gomoku_tournament_matches%rowtype;
  v_target_name text;
  v_room_id text;
  v_name text;
  v_result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_tournament_id,''),0));
  select * into v_t from public.gomoku_tournaments where id=p_tournament_id for update;
  if v_t.id is null then raise exception 'Tournament not found'; end if;
  if v_t.organizer_user_id <> p_user_id then raise exception 'Organizer permission required'; end if;

  if p_action='rename' then
    if v_t.status <> 'registration' then raise exception 'Only registration tournaments can be renamed'; end if;
    v_name:=btrim(regexp_replace(coalesce(p_text,''),'\s+',' ','g'));
    if char_length(v_name)<3 or char_length(v_name)>48 then raise exception 'Tournament name must be 3-48 characters'; end if;
    update public.gomoku_tournaments set name=v_name,updated_at=now() where id=v_t.id;
    perform public.gomoku_tournament_event(v_t.id,'renamed',null,null,null,p_user_id,v_t.organizer_username,null,null,'Tournament renamed');
    return jsonb_build_object('ok',true,'action','rename','name',v_name);

  elsif p_action='remove_player' then
    if v_t.status <> 'registration' then raise exception 'Players can only be removed during registration'; end if;
    if p_target_user_id is null or p_target_user_id=v_t.organizer_user_id then raise exception 'Invalid player removal'; end if;
    delete from public.gomoku_tournament_entries
    where tournament_id=v_t.id and user_id=p_target_user_id
    returning username into v_target_name;
    if v_target_name is null then raise exception 'Player is not registered'; end if;
    update public.gomoku_tournaments set updated_at=now() where id=v_t.id;
    perform public.gomoku_tournament_event(v_t.id,'removed',null,null,null,p_user_id,v_t.organizer_username,p_target_user_id,v_target_name,'Player removed by organizer');
    return jsonb_build_object('ok',true,'action','remove_player','username',v_target_name);

  elsif p_action='cancel' then
    if v_t.status in ('completed','cancelled') then raise exception 'Tournament is already closed'; end if;
    update public.gomoku_tournaments
    set status='cancelled',cancelled_at=now(),updated_at=now(),
        cancel_reason=nullif(left(btrim(coalesce(p_text,'')),180),'')
    where id=v_t.id;
    update public.gomoku_tournament_matches
    set status='cancelled'
    where tournament_id=v_t.id and status<>'completed';
    delete from public.gomoku_rooms
    where id in (
      select room_id from public.gomoku_tournament_matches
      where tournament_id=v_t.id and room_id is not null
    );
    perform public.gomoku_tournament_event(v_t.id,'cancelled',null,null,null,p_user_id,v_t.organizer_username,null,null,'Tournament cancelled');
    return jsonb_build_object('ok',true,'action','cancel');

  elsif p_action='extend_deadline' then
    if v_t.status <> 'active' or p_match_id is null then raise exception 'Active match required'; end if;
    select * into v_m from public.gomoku_tournament_matches
    where id=p_match_id and tournament_id=v_t.id for update;
    if v_m.id is null or v_m.status<>'active' or v_m.started_at is not null then
      raise exception 'Match is not awaiting check-in';
    end if;
    update public.gomoku_tournament_matches
    set ready_deadline=greatest(coalesce(ready_deadline,now()),now())+interval '10 minutes',
        last_activity_at=now()
    where id=v_m.id
    returning * into v_m;
    perform public.gomoku_tournament_event(v_t.id,'deadline_extended',v_m.id,v_m.round,v_m.slot,p_user_id,v_t.organizer_username,null,null,'Check-in deadline extended');
    return jsonb_build_object('ok',true,'action','extend_deadline','readyDeadline',v_m.ready_deadline);

  elsif p_action='award_forfeit' then
    if v_t.status <> 'active' or p_match_id is null or p_target_user_id is null then
      raise exception 'Active match and winner are required';
    end if;
    select * into v_m from public.gomoku_tournament_matches
    where id=p_match_id and tournament_id=v_t.id for update;
    if v_m.id is null or v_m.status<>'active' or v_m.started_at is not null then
      raise exception 'Match is not eligible for an organizer forfeit';
    end if;
    if p_target_user_id<>v_m.player1_user_id and p_target_user_id<>v_m.player2_user_id then
      raise exception 'Winner is not assigned to this match';
    end if;
    v_room_id:=v_m.room_id;
    v_result:=public.gomoku_advance_tournament_match(v_room_id,p_target_user_id,'forfeit-organizer');
    if v_room_id is not null then delete from public.gomoku_rooms where id=v_room_id; end if;
    perform public.gomoku_tournament_event(v_t.id,'organizer_ruling',v_m.id,v_m.round,v_m.slot,p_user_id,v_t.organizer_username,p_target_user_id,null,'Organizer awarded a forfeit');
    return v_result || jsonb_build_object('action','award_forfeit');

  else
    raise exception 'Unsupported organizer action';
  end if;
end;
$$;

revoke all on function public.gomoku_organizer_tournament_action(text,uuid,text,uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_organizer_tournament_action(text,uuid,text,uuid,uuid,text)
  to service_role;

create or replace function public.gomoku_sweep_tournament_deadlines(p_tournament_id text default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_m public.gomoku_tournament_matches%rowtype;
  v_winner uuid;
  v_room_id text;
  v_awarded integer := 0;
  v_needs_action integer := 0;
begin
  for v_m in
    select m.*
    from public.gomoku_tournament_matches m
    join public.gomoku_tournaments t on t.id=m.tournament_id
    where t.status='active'
      and m.status='active'
      and m.started_at is null
      and m.ready_deadline is not null
      and m.ready_deadline <= now()
      and (p_tournament_id is null or m.tournament_id=p_tournament_id)
    order by m.ready_deadline
    for update of m skip locked
  loop
    if (v_m.player1_checked_in_at is not null) <> (v_m.player2_checked_in_at is not null) then
      v_winner := case when v_m.player1_checked_in_at is not null then v_m.player1_user_id else v_m.player2_user_id end;
      v_room_id:=v_m.room_id;
      perform public.gomoku_advance_tournament_match(v_m.room_id,v_winner,'forfeit-no-show');
      if v_room_id is not null then delete from public.gomoku_rooms where id=v_room_id; end if;
      v_awarded:=v_awarded+1;
    elsif v_m.player1_checked_in_at is null and v_m.player2_checked_in_at is null then
      if not exists(
        select 1 from public.gomoku_tournament_events e
        where e.match_id=v_m.id and e.event_type='deadline_missed'
      ) then
        perform public.gomoku_tournament_event(v_m.tournament_id,'deadline_missed',v_m.id,v_m.round,v_m.slot,null,null,null,null,'Neither player checked in before the deadline');
      end if;
      v_needs_action:=v_needs_action+1;
    end if;
  end loop;

  return jsonb_build_object('awarded',v_awarded,'needsOrganizerAction',v_needs_action);
end;
$$;

revoke all on function public.gomoku_sweep_tournament_deadlines(text) from public,anon,authenticated;
grant execute on function public.gomoku_sweep_tournament_deadlines(text) to service_role;

create or replace function public.gomoku_competition_tick()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_season jsonb;
  v_sweep jsonb;
begin
  v_season:=public.gomoku_ensure_current_season(now());
  v_sweep:=public.gomoku_sweep_tournament_deadlines(null);
  return jsonb_build_object('season',v_season,'tournaments',v_sweep,'ranAt',now());
end;
$$;

revoke all on function public.gomoku_competition_tick() from public,anon,authenticated;
grant execute on function public.gomoku_competition_tick() to service_role;

do $$
declare v_job bigint;
begin
  for v_job in select jobid from cron.job where jobname='gomoku-p9-competition-tick'
  loop
    perform cron.unschedule(v_job);
  end loop;
  perform cron.schedule(
    'gomoku-p9-competition-tick',
    '* * * * *',
    'select public.gomoku_competition_tick();'
  );
end $$;

comment on table public.gomoku_tournament_events is
  'Server-owned public-safe tournament event journal. Clients read sanitized events only through gomoku-room.';
comment on function public.gomoku_competition_tick() is
  'P9 minute-level competition maintenance: season rollover and tournament check-in deadline enforcement.';
