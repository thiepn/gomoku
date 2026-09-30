-- P7 — Ranked Rating, Leaderboards & Matchmaking

alter table public.gomoku_matches
  add column if not exists match_mode text not null default 'casual',
  add column if not exists rated boolean not null default false,
  add column if not exists black_rating_before integer,
  add column if not exists black_rating_after integer,
  add column if not exists white_rating_before integer,
  add column if not exists white_rating_after integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.gomoku_matches'::regclass
      and conname='gomoku_matches_mode_check'
  ) then
    alter table public.gomoku_matches
      add constraint gomoku_matches_mode_check
      check (match_mode in ('casual','ranked'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.gomoku_matches'::regclass
      and conname='gomoku_matches_rated_identity_check'
  ) then
    alter table public.gomoku_matches
      add constraint gomoku_matches_rated_identity_check
      check (
        not rated
        or (
          match_mode='ranked'
          and black_user_id is not null
          and white_user_id is not null
          and black_user_id <> white_user_id
        )
      );
  end if;
end $$;

create table if not exists public.gomoku_ratings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating integer not null default 1500 check (rating >= 100 and rating <= 5000),
  peak_rating integer not null default 1500 check (peak_rating >= 100 and peak_rating <= 5000),
  games integer not null default 0 check (games >= 0),
  wins integer not null default 0 check (wins >= 0),
  draws integer not null default 0 check (draws >= 0),
  losses integer not null default 0 check (losses >= 0),
  last_played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gomoku_ratings_record_check check (games = wins + draws + losses)
);

create index if not exists gomoku_ratings_leaderboard_idx
  on public.gomoku_ratings (rating desc, games desc, updated_at asc)
  where games > 0;

create table if not exists public.gomoku_rating_events (
  room_id text not null,
  game_version bigint not null,
  black_user_id uuid not null references auth.users(id) on delete cascade,
  white_user_id uuid not null references auth.users(id) on delete cascade,
  winner_color smallint not null check (winner_color in (0,1,2)),
  k_factor integer not null check (k_factor between 1 and 100),
  black_before integer not null,
  black_after integer not null,
  black_delta integer not null,
  white_before integer not null,
  white_after integer not null,
  white_delta integer not null,
  created_at timestamptz not null default now(),
  primary key (room_id, game_version),
  constraint gomoku_rating_events_distinct_players check (black_user_id <> white_user_id)
);

create index if not exists gomoku_rating_events_black_idx
  on public.gomoku_rating_events (black_user_id, created_at desc);
create index if not exists gomoku_rating_events_white_idx
  on public.gomoku_rating_events (white_user_id, created_at desc);

create table if not exists public.gomoku_matchmaking_queue (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  rating_snapshot integer not null,
  history_hash text,
  queued_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  constraint gomoku_matchmaking_username_check check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

create index if not exists gomoku_matchmaking_queue_search_idx
  on public.gomoku_matchmaking_queue (rating_snapshot, queued_at);

create table if not exists public.gomoku_ranked_active (
  user_id uuid primary key references auth.users(id) on delete cascade,
  room_id text not null references public.gomoku_rooms(id) on delete cascade,
  opponent_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint gomoku_ranked_active_distinct_players check (user_id <> opponent_user_id)
);

create index if not exists gomoku_ranked_active_room_idx
  on public.gomoku_ranked_active (room_id);

alter table public.gomoku_ratings enable row level security;
alter table public.gomoku_rating_events enable row level security;
alter table public.gomoku_matchmaking_queue enable row level security;
alter table public.gomoku_ranked_active enable row level security;

revoke all on table public.gomoku_ratings from public, anon, authenticated;
revoke all on table public.gomoku_rating_events from public, anon, authenticated;
revoke all on table public.gomoku_matchmaking_queue from public, anon, authenticated;
revoke all on table public.gomoku_ranked_active from public, anon, authenticated;

grant select, insert, update, delete on table public.gomoku_ratings to service_role;
grant select, insert, update, delete on table public.gomoku_rating_events to service_role;
grant select, insert, update, delete on table public.gomoku_matchmaking_queue to service_role;
grant select, insert, update, delete on table public.gomoku_ranked_active to service_role;

create or replace function public.gomoku_try_matchmaking(
  p_user_id uuid,
  p_username text,
  p_history_hash text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_rating integer;
  v_queued_at timestamptz;
  v_wait_seconds integer;
  v_range integer;
  v_candidate public.gomoku_matchmaking_queue%rowtype;
  v_candidate_range integer;
  v_room_id text;
  v_flip boolean;
  v_black public.gomoku_matchmaking_queue%rowtype;
  v_white public.gomoku_matchmaking_queue%rowtype;
  v_state jsonb;
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'A public player username is required for ranked matchmaking';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  delete from public.gomoku_matchmaking_queue
  where last_seen < v_now - interval '45 seconds';

  delete from public.gomoku_ranked_active a
  where not exists (select 1 from public.gomoku_rooms r where r.id=a.room_id);

  select a.room_id into v_room_id
  from public.gomoku_ranked_active a
  where a.user_id=p_user_id;

  if v_room_id is not null then
    delete from public.gomoku_matchmaking_queue where user_id=p_user_id;
    select rating into v_rating from public.gomoku_ratings where user_id=p_user_id;
    return jsonb_build_object('status','matched','roomId',v_room_id,'rating',coalesce(v_rating,1500));
  end if;

  insert into public.gomoku_ratings(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select rating into v_rating from public.gomoku_ratings where user_id=p_user_id;

  insert into public.gomoku_matchmaking_queue
    (user_id,username,rating_snapshot,history_hash,queued_at,last_seen)
  values
    (p_user_id,p_username,v_rating,p_history_hash,v_now,v_now)
  on conflict (user_id) do update set
    username=excluded.username,
    rating_snapshot=excluded.rating_snapshot,
    history_hash=excluded.history_hash,
    last_seen=excluded.last_seen;

  select queued_at into v_queued_at
  from public.gomoku_matchmaking_queue
  where user_id=p_user_id
  for update;

  v_wait_seconds := greatest(0,floor(extract(epoch from (v_now-v_queued_at)))::integer);
  v_range := least(500,100 + (v_wait_seconds / 10) * 50);

  select q.* into v_candidate
  from public.gomoku_matchmaking_queue q
  where q.user_id<>p_user_id
    and q.last_seen >= v_now - interval '45 seconds'
    and abs(q.rating_snapshot-v_rating) <= greatest(
      v_range,
      least(500,100 + (greatest(0,floor(extract(epoch from (v_now-q.queued_at)))::integer) / 10) * 50)
    )
    and not exists (select 1 from public.gomoku_ranked_active a where a.user_id=q.user_id)
  order by abs(q.rating_snapshot-v_rating), q.queued_at, q.user_id
  for update skip locked
  limit 1;

  if v_candidate.user_id is null then
    return jsonb_build_object(
      'status','queued','rating',v_rating,'waitSeconds',v_wait_seconds,
      'searchRange',v_range,'queuedAt',v_queued_at
    );
  end if;

  v_candidate_range := least(500,100 + (greatest(0,floor(extract(epoch from (v_now-v_candidate.queued_at)))::integer) / 10) * 50);
  v_room_id := 'RANK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  v_flip := random() < 0.5;

  if v_flip then
    select * into v_black from public.gomoku_matchmaking_queue where user_id=p_user_id;
    v_white := v_candidate;
  else
    v_black := v_candidate;
    select * into v_white from public.gomoku_matchmaking_queue where user_id=p_user_id;
  end if;

  v_state := jsonb_build_object(
    'version',7,'mode','ranked','ranked',true,'round',1,'gameVersion',1,
    'roundStartedAt',v_now,'completedMatch',null,'rule','renju-practice',
    'players',jsonb_build_array(
      jsonb_build_object('seat',1,'name',v_black.username,'color',1,'joinedAt',v_now,'historyHash',coalesce(v_black.history_hash,''),'userId',v_black.user_id,'profileUsername',v_black.username),
      jsonb_build_object('seat',2,'name',v_white.username,'color',2,'joinedAt',v_now,'historyHash',coalesce(v_white.history_hash,''),'userId',v_white.user_id,'profileUsername',v_white.username)
    ),
    'game',jsonb_build_object('moves',jsonb_build_array(),'result',null,'terminal',null),
    'drawOffer',null,'drawNotice',null,'rematch',jsonb_build_array(),'rematchNotice',null,
    'undoRequest',null,'undoNotice',null,'lifecycle',jsonb_build_object('type','matched','at',v_now),
    'chat',jsonb_build_array(),'recentCommands',jsonb_build_array(),'actionGuard',jsonb_build_object()
  );

  insert into public.gomoku_rooms
    (id,created_at,updated_at,expires_at,revision,host_token_hash,guest_token_hash,password_salt,password_hash,state)
  values
    (v_room_id,v_now,v_now,v_now+interval '24 hours',0,null,null,null,null,v_state);

  insert into public.gomoku_ranked_active(user_id,room_id,opponent_user_id,created_at)
  values
    (v_black.user_id,v_room_id,v_white.user_id,v_now),
    (v_white.user_id,v_room_id,v_black.user_id,v_now);

  delete from public.gomoku_matchmaking_queue where user_id in (v_black.user_id,v_white.user_id);

  return jsonb_build_object(
    'status','matched','roomId',v_room_id,'rating',v_rating,
    'opponent',jsonb_build_object('username',v_candidate.username,'rating',v_candidate.rating_snapshot),
    'searchRange',greatest(v_range,v_candidate_range)
  );
end;
$$;

revoke all on function public.gomoku_try_matchmaking(uuid,text,text) from public, anon, authenticated;
grant execute on function public.gomoku_try_matchmaking(uuid,text,text) to service_role;

create or replace function public.gomoku_cancel_matchmaking(p_user_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare v_deleted integer;
begin
  delete from public.gomoku_matchmaking_queue where user_id=p_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.gomoku_cancel_matchmaking(uuid) from public, anon, authenticated;
grant execute on function public.gomoku_cancel_matchmaking(uuid) to service_role;

create or replace function public.gomoku_apply_ranked_result()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_black_rating integer; v_white_rating integer;
  v_black_games integer; v_white_games integer;
  v_expected_black numeric; v_score_black numeric;
  v_k integer; v_delta integer;
  v_black_after integer; v_white_after integer;
begin
  if new.rated is not true or new.match_mode <> 'ranked' then return new; end if;
  if new.black_user_id is null or new.white_user_id is null or new.black_user_id=new.white_user_id then
    raise exception 'Ranked result requires two distinct verified players';
  end if;
  if exists (select 1 from public.gomoku_rating_events where room_id=new.room_id and game_version=new.game_version) then
    return new;
  end if;

  insert into public.gomoku_ratings(user_id)
  values (new.black_user_id),(new.white_user_id)
  on conflict (user_id) do nothing;

  perform 1 from public.gomoku_ratings
  where user_id in (new.black_user_id,new.white_user_id)
  order by user_id for update;

  select rating,games into v_black_rating,v_black_games from public.gomoku_ratings where user_id=new.black_user_id;
  select rating,games into v_white_rating,v_white_games from public.gomoku_ratings where user_id=new.white_user_id;

  v_k := case when least(v_black_games,v_white_games) < 10 then 40 when least(v_black_games,v_white_games) < 30 then 32 else 24 end;
  v_expected_black := 1.0 / (1.0 + power(10.0,(v_white_rating-v_black_rating)/400.0));
  v_score_black := case new.winner_color when 1 then 1.0 when 2 then 0.0 else 0.5 end;
  v_delta := round(v_k * (v_score_black-v_expected_black))::integer;
  v_black_after := greatest(100,v_black_rating+v_delta);
  v_white_after := greatest(100,v_white_rating-v_delta);

  update public.gomoku_ratings
  set rating=v_black_after,peak_rating=greatest(peak_rating,v_black_after),games=games+1,
      wins=wins+case when new.winner_color=1 then 1 else 0 end,
      draws=draws+case when new.winner_color=0 then 1 else 0 end,
      losses=losses+case when new.winner_color=2 then 1 else 0 end,
      last_played_at=new.completed_at,updated_at=now()
  where user_id=new.black_user_id;

  update public.gomoku_ratings
  set rating=v_white_after,peak_rating=greatest(peak_rating,v_white_after),games=games+1,
      wins=wins+case when new.winner_color=2 then 1 else 0 end,
      draws=draws+case when new.winner_color=0 then 1 else 0 end,
      losses=losses+case when new.winner_color=1 then 1 else 0 end,
      last_played_at=new.completed_at,updated_at=now()
  where user_id=new.white_user_id;

  insert into public.gomoku_rating_events(
    room_id,game_version,black_user_id,white_user_id,winner_color,k_factor,
    black_before,black_after,black_delta,white_before,white_after,white_delta
  ) values (
    new.room_id,new.game_version,new.black_user_id,new.white_user_id,new.winner_color,v_k,
    v_black_rating,v_black_after,v_black_after-v_black_rating,
    v_white_rating,v_white_after,v_white_after-v_white_rating
  );

  update public.gomoku_matches
  set black_rating_before=v_black_rating,black_rating_after=v_black_after,
      white_rating_before=v_white_rating,white_rating_after=v_white_after
  where room_id=new.room_id and game_version=new.game_version;

  delete from public.gomoku_ranked_active where user_id in (new.black_user_id,new.white_user_id);
  return new;
end;
$$;

revoke all on function public.gomoku_apply_ranked_result() from public, anon, authenticated;

drop trigger if exists gomoku_ranked_result_trigger on public.gomoku_matches;
create trigger gomoku_ranked_result_trigger
after insert on public.gomoku_matches
for each row
when (new.rated = true)
execute function public.gomoku_apply_ranked_result();

comment on table public.gomoku_ratings is 'Server-owned persistent Elo-style ranked record for verified Gomoku players.';
comment on table public.gomoku_matchmaking_queue is 'Short-lived server-owned ranked queue. Clients access it only through gomoku-room.';
comment on table public.gomoku_ranked_active is 'One active ranked room assignment per verified player.';
