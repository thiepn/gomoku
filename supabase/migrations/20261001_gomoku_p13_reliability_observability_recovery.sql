-- P13 — Reliability, Observability & Competitive Recovery
-- Durable match-result outbox, reconciliation, internal operational events, and sanitized health snapshots.

create table if not exists public.gomoku_match_persistence_outbox (
  room_id text not null,
  game_version bigint not null,
  payload jsonb not null,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  persisted_at timestamptz,
  primary key(room_id,game_version),
  constraint gomoku_match_persistence_outbox_game_check check (game_version>=1),
  constraint gomoku_match_persistence_outbox_attempts_check check (attempts>=0),
  constraint gomoku_match_persistence_outbox_payload_check check (jsonb_typeof(payload)='object')
);
create index if not exists gomoku_match_persistence_outbox_pending_idx
  on public.gomoku_match_persistence_outbox(next_attempt_at,captured_at)
  where persisted_at is null;

create table if not exists public.gomoku_runtime_events (
  id bigserial primary key,
  severity text not null check (severity in ('info','warning','error')),
  component text not null,
  event_type text not null,
  request_id text,
  room_id text,
  game_version bigint,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now(),
  constraint gomoku_runtime_events_component_len check (char_length(component) between 1 and 64),
  constraint gomoku_runtime_events_event_len check (char_length(event_type) between 1 and 96),
  constraint gomoku_runtime_events_request_len check (request_id is null or char_length(request_id)<=96),
  constraint gomoku_runtime_events_game_check check (game_version is null or game_version>=1)
);
create index if not exists gomoku_runtime_events_recent_idx
  on public.gomoku_runtime_events(created_at desc);
create index if not exists gomoku_runtime_events_component_idx
  on public.gomoku_runtime_events(component,severity,created_at desc);
create index if not exists gomoku_runtime_events_room_idx
  on public.gomoku_runtime_events(room_id,game_version,created_at desc)
  where room_id is not null;

alter table public.gomoku_match_persistence_outbox enable row level security;
alter table public.gomoku_runtime_events enable row level security;
revoke all on table public.gomoku_match_persistence_outbox from public,anon,authenticated;
revoke all on table public.gomoku_runtime_events from public,anon,authenticated;
grant select,insert,update,delete on table public.gomoku_match_persistence_outbox to service_role;
grant select,insert,update,delete on table public.gomoku_runtime_events to service_role;
grant usage,select on sequence public.gomoku_runtime_events_id_seq to service_role;

create or replace function public.gomoku_capture_completed_match_outbox()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_payload jsonb;
  v_game_version bigint;
  v_exists boolean;
begin
  v_payload:=new.state->'completedMatch';
  if v_payload is null or jsonb_typeof(v_payload)<>'object' then return new; end if;
  v_game_version:=greatest(1,coalesce((v_payload->>'game_version')::bigint,(new.state->>'gameVersion')::bigint,1));
  select exists(
    select 1 from public.gomoku_matches
    where room_id=new.id and game_version=v_game_version
  ) into v_exists;

  insert into public.gomoku_match_persistence_outbox(
    room_id,game_version,payload,persisted_at,next_attempt_at,updated_at
  ) values(
    new.id,v_game_version,v_payload,
    case when v_exists then now() else null end,
    now(),now()
  )
  on conflict(room_id,game_version) do update set
    payload=excluded.payload,
    persisted_at=case
      when public.gomoku_match_persistence_outbox.persisted_at is not null then public.gomoku_match_persistence_outbox.persisted_at
      when v_exists then now()
      else null
    end,
    next_attempt_at=case
      when public.gomoku_match_persistence_outbox.persisted_at is null then least(public.gomoku_match_persistence_outbox.next_attempt_at,now())
      else public.gomoku_match_persistence_outbox.next_attempt_at
    end,
    updated_at=now();
  return new;
end $$;
revoke all on function public.gomoku_capture_completed_match_outbox() from public,anon,authenticated;

drop trigger if exists gomoku_p13_capture_completed_match on public.gomoku_rooms;
create trigger gomoku_p13_capture_completed_match
after insert or update of state on public.gomoku_rooms
for each row execute function public.gomoku_capture_completed_match_outbox();

create or replace function public.gomoku_record_runtime_event(
  p_severity text,
  p_component text,
  p_event_type text,
  p_request_id text default null,
  p_room_id text default null,
  p_game_version bigint default null,
  p_details jsonb default '{}'::jsonb
) returns void
language plpgsql
security invoker
set search_path=''
as $$
begin
  if p_severity not in ('info','warning','error') then raise exception 'Invalid runtime-event severity'; end if;
  if char_length(coalesce(p_component,''))<1 or char_length(p_component)>64 then raise exception 'Invalid runtime-event component'; end if;
  if char_length(coalesce(p_event_type,''))<1 or char_length(p_event_type)>96 then raise exception 'Invalid runtime-event type'; end if;
  insert into public.gomoku_runtime_events(severity,component,event_type,request_id,room_id,game_version,details)
  values(
    p_severity,left(p_component,64),left(p_event_type,96),nullif(left(coalesce(p_request_id,''),96),''),
    nullif(left(coalesce(p_room_id,''),32),''),p_game_version,
    case when jsonb_typeof(coalesce(p_details,'{}'::jsonb))='object' then coalesce(p_details,'{}'::jsonb) else '{}'::jsonb end
  );
end $$;
revoke all on function public.gomoku_record_runtime_event(text,text,text,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.gomoku_record_runtime_event(text,text,text,text,text,bigint,jsonb) to service_role;

create or replace function public.gomoku_process_match_outbox(p_limit integer default 50)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  r public.gomoku_match_persistence_outbox%rowtype;
  p jsonb;
  v_hashes text[];
  v_processed integer:=0;
  v_failed integer:=0;
  v_already integer:=0;
  v_backoff_seconds integer;
begin
  p_limit:=greatest(1,least(coalesce(p_limit,50),200));

  for r in
    select * from public.gomoku_match_persistence_outbox
    where persisted_at is null and next_attempt_at<=now()
    order by captured_at,room_id,game_version
    for update skip locked
    limit p_limit
  loop
    begin
      if exists(select 1 from public.gomoku_matches where room_id=r.room_id and game_version=r.game_version) then
        update public.gomoku_match_persistence_outbox
        set persisted_at=now(),last_error=null,updated_at=now()
        where room_id=r.room_id and game_version=r.game_version;
        v_already:=v_already+1;
        continue;
      end if;

      p:=r.payload;
      if jsonb_typeof(p)<>'object' then raise exception 'Outbox payload is not an object'; end if;
      v_hashes:=coalesce(array(select jsonb_array_elements_text(coalesce(p->'history_hashes','[]'::jsonb))),array[]::text[]);

      insert into public.gomoku_matches(
        room_id,game_version,round,rule,started_at,completed_at,winner_color,result_reason,
        move_count,moves,players,history_hashes,black_user_id,white_user_id,match_mode,rated
      ) values(
        r.room_id,
        r.game_version,
        greatest(1,coalesce((p->>'round')::bigint,1)),
        'renju-practice',
        nullif(p->>'started_at','')::timestamptz,
        coalesce(nullif(p->>'completed_at','')::timestamptz,now()),
        coalesce((p->>'winner_color')::smallint,0),
        coalesce(nullif(p->>'result_reason',''),'full'),
        greatest(0,least(225,coalesce((p->>'move_count')::smallint,0))),
        coalesce(p->'moves','[]'::jsonb),
        coalesce(p->'players','[]'::jsonb),
        v_hashes,
        nullif(p->>'black_user_id','')::uuid,
        nullif(p->>'white_user_id','')::uuid,
        case when p->>'match_mode' in ('ranked','tournament') then p->>'match_mode' else 'casual' end,
        coalesce((p->>'rated')::boolean,false)
      )
      on conflict(room_id,game_version) do nothing;

      update public.gomoku_match_persistence_outbox
      set persisted_at=now(),last_error=null,updated_at=now()
      where room_id=r.room_id and game_version=r.game_version;
      v_processed:=v_processed+1;
    exception when others then
      v_failed:=v_failed+1;
      v_backoff_seconds:=least(3600,15*power(2,least(r.attempts,8))::integer);
      update public.gomoku_match_persistence_outbox
      set attempts=attempts+1,
          last_error=left(sqlerrm,500),
          next_attempt_at=now()+make_interval(secs=>v_backoff_seconds),
          updated_at=now()
      where room_id=r.room_id and game_version=r.game_version;
      perform public.gomoku_record_runtime_event(
        'error','match_persistence','outbox_retry',null,r.room_id,r.game_version,
        jsonb_build_object('attempt',r.attempts+1,'retryInSeconds',v_backoff_seconds,'error',left(sqlerrm,300))
      );
    end;
  end loop;

  return jsonb_build_object('processed',v_processed,'alreadyPersisted',v_already,'failed',v_failed,'at',now());
end $$;
revoke all on function public.gomoku_process_match_outbox(integer) from public,anon,authenticated;
grant execute on function public.gomoku_process_match_outbox(integer) to service_role;

create or replace function public.gomoku_reliability_tick()
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_reconciled integer:=0;
  v_cleaned_active integer:=0;
  v_cleaned_queue integer:=0;
  v_outbox jsonb;
begin
  insert into public.gomoku_match_persistence_outbox(room_id,game_version,payload,persisted_at,next_attempt_at,updated_at)
  select
    r.id,
    greatest(1,coalesce((r.state->'completedMatch'->>'game_version')::bigint,(r.state->>'gameVersion')::bigint,1)),
    r.state->'completedMatch',
    case when exists(
      select 1 from public.gomoku_matches m
      where m.room_id=r.id
        and m.game_version=greatest(1,coalesce((r.state->'completedMatch'->>'game_version')::bigint,(r.state->>'gameVersion')::bigint,1))
    ) then now() else null end,
    now(),now()
  from public.gomoku_rooms r
  where jsonb_typeof(r.state->'completedMatch')='object'
  on conflict(room_id,game_version) do update set
    payload=excluded.payload,
    updated_at=now();
  get diagnostics v_reconciled=row_count;

  v_outbox:=public.gomoku_process_match_outbox(100);

  delete from public.gomoku_ranked_active a
  where not exists(
    select 1 from public.gomoku_rooms r
    where r.id=a.room_id and r.expires_at>now()
  );
  get diagnostics v_cleaned_active=row_count;

  delete from public.gomoku_matchmaking_queue where last_seen<now()-interval '90 seconds';
  get diagnostics v_cleaned_queue=row_count;

  delete from public.gomoku_room_player_presence where last_seen<now()-interval '24 hours';
  delete from public.gomoku_room_spectators where last_seen<now()-interval '24 hours';
  delete from public.gomoku_runtime_events where created_at<now()-interval '30 days';
  delete from public.gomoku_match_persistence_outbox where persisted_at is not null and persisted_at<now()-interval '14 days';

  return jsonb_build_object(
    'reconciled',v_reconciled,
    'outbox',v_outbox,
    'cleanedRankedAssignments',v_cleaned_active,
    'cleanedQueueEntries',v_cleaned_queue,
    'at',now()
  );
end $$;
revoke all on function public.gomoku_reliability_tick() from public,anon,authenticated;
grant execute on function public.gomoku_reliability_tick() to service_role;

create or replace function public.gomoku_reliability_snapshot()
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_active_rooms integer:=0;
  v_competitive_rooms integer:=0;
  v_queue integer:=0;
  v_ranked_active integer:=0;
  v_pending integer:=0;
  v_retrying integer:=0;
  v_oldest integer:=0;
  v_errors_15m integer:=0;
  v_warnings_15m integer:=0;
  v_last_tick timestamptz;
  v_last_tick_status text;
  v_status text:='healthy';
begin
  select count(*)::integer,
         count(*) filter(where state->>'mode' in ('ranked','tournament','challenge'))::integer
  into v_active_rooms,v_competitive_rooms
  from public.gomoku_rooms where expires_at>now();

  select count(*)::integer into v_queue from public.gomoku_matchmaking_queue where last_seen>=now()-interval '90 seconds';
  select count(*)::integer into v_ranked_active from public.gomoku_ranked_active;
  select count(*)::integer,
         count(*) filter(where attempts>0)::integer,
         coalesce(max(extract(epoch from (now()-captured_at)))::integer,0)
  into v_pending,v_retrying,v_oldest
  from public.gomoku_match_persistence_outbox
  where persisted_at is null;

  select count(*) filter(where severity='error')::integer,
         count(*) filter(where severity='warning')::integer
  into v_errors_15m,v_warnings_15m
  from public.gomoku_runtime_events
  where created_at>=now()-interval '15 minutes';

  select d.end_time,d.status into v_last_tick,v_last_tick_status
  from cron.job_run_details d
  join cron.job j on j.jobid=d.jobid
  where j.jobname='gomoku-p13-reliability-tick'
  order by d.start_time desc
  limit 1;

  if v_pending>=10 or v_oldest>=600 or v_errors_15m>=10 or v_last_tick_status='failed' then
    v_status:='critical';
  elsif (v_pending>0 and v_oldest>=90) or v_retrying>0 or v_errors_15m>0 or v_warnings_15m>=5 then
    v_status:='degraded';
  end if;

  return jsonb_build_object(
    'status',v_status,
    'activeRooms',v_active_rooms,
    'competitiveRooms',v_competitive_rooms,
    'rankedQueue',v_queue,
    'rankedAssignments',v_ranked_active,
    'persistence',jsonb_build_object(
      'pending',v_pending,'retrying',v_retrying,'oldestPendingSeconds',v_oldest
    ),
    'events15m',jsonb_build_object('errors',v_errors_15m,'warnings',v_warnings_15m),
    'recoveryTick',jsonb_build_object('lastAt',v_last_tick,'status',v_last_tick_status),
    'generatedAt',now()
  );
end $$;
revoke all on function public.gomoku_reliability_snapshot() from public,anon,authenticated;
grant execute on function public.gomoku_reliability_snapshot() to service_role;

insert into public.gomoku_match_persistence_outbox(room_id,game_version,payload,persisted_at,next_attempt_at,updated_at)
select
  r.id,
  greatest(1,coalesce((r.state->'completedMatch'->>'game_version')::bigint,(r.state->>'gameVersion')::bigint,1)),
  r.state->'completedMatch',
  case when exists(
    select 1 from public.gomoku_matches m
    where m.room_id=r.id
      and m.game_version=greatest(1,coalesce((r.state->'completedMatch'->>'game_version')::bigint,(r.state->>'gameVersion')::bigint,1))
  ) then now() else null end,
  now(),now()
from public.gomoku_rooms r
where jsonb_typeof(r.state->'completedMatch')='object'
on conflict(room_id,game_version) do update set payload=excluded.payload,updated_at=now();

do $$
declare v_job bigint;
begin
  for v_job in select jobid from cron.job where jobname='gomoku-p13-reliability-tick'
  loop
    perform cron.unschedule(v_job);
  end loop;
  perform cron.schedule(
    'gomoku-p13-reliability-tick',
    '* * * * *',
    'select public.gomoku_reliability_tick();'
  );
end $$;

comment on table public.gomoku_match_persistence_outbox is
  'P13 durable recovery outbox: completed room state is captured transactionally and retried until gomoku_matches persistence succeeds.';
comment on table public.gomoku_runtime_events is
  'P13 internal sanitized operational events for reliability diagnosis; never exposed directly to clients.';
comment on function public.gomoku_reliability_snapshot() is
  'P13 sanitized aggregate health snapshot with no player identities or private room content.';
