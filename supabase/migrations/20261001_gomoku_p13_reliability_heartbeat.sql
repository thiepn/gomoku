-- P13 health heartbeat: remove public health RPC dependency on pg_cron catalog privileges.

create table if not exists public.gomoku_reliability_heartbeat (
  id smallint primary key default 1,
  last_tick_at timestamptz not null default now(),
  last_tick_status text not null default 'initializing' check (last_tick_status in ('initializing','succeeded')),
  last_tick_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(last_tick_summary)='object'),
  updated_at timestamptz not null default now(),
  constraint gomoku_reliability_heartbeat_singleton check (id=1)
);

alter table public.gomoku_reliability_heartbeat enable row level security;
revoke all on table public.gomoku_reliability_heartbeat from public,anon,authenticated;
grant select,insert,update,delete on table public.gomoku_reliability_heartbeat to service_role;

insert into public.gomoku_reliability_heartbeat(id,last_tick_status,last_tick_summary)
values(1,'initializing','{}'::jsonb)
on conflict(id) do nothing;

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
  v_result jsonb;
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
  on conflict(room_id,game_version) do update set payload=excluded.payload,updated_at=now();
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

  v_result:=jsonb_build_object(
    'reconciled',v_reconciled,
    'outbox',v_outbox,
    'cleanedRankedAssignments',v_cleaned_active,
    'cleanedQueueEntries',v_cleaned_queue,
    'at',now()
  );

  insert into public.gomoku_reliability_heartbeat(id,last_tick_at,last_tick_status,last_tick_summary,updated_at)
  values(1,now(),'succeeded',v_result,now())
  on conflict(id) do update set
    last_tick_at=excluded.last_tick_at,
    last_tick_status=excluded.last_tick_status,
    last_tick_summary=excluded.last_tick_summary,
    updated_at=now();

  return v_result;
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
  v_tick_age integer:=0;
  v_status text:='healthy';
begin
  select count(*)::integer,
         count(*) filter(where state->>'mode' in ('ranked','tournament','challenge'))::integer
  into v_active_rooms,v_competitive_rooms
  from public.gomoku_rooms where expires_at>now();

  select count(*)::integer into v_queue
  from public.gomoku_matchmaking_queue
  where last_seen>=now()-interval '90 seconds';

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

  select last_tick_at,last_tick_status
  into v_last_tick,v_last_tick_status
  from public.gomoku_reliability_heartbeat
  where id=1;

  v_tick_age:=case when v_last_tick is null then 999999 else greatest(0,extract(epoch from (now()-v_last_tick))::integer) end;

  if v_pending>=10 or v_oldest>=600 or v_errors_15m>=10 or v_tick_age>=300 then
    v_status:='critical';
  elsif (v_pending>0 and v_oldest>=90) or v_retrying>0 or v_errors_15m>0 or v_warnings_15m>=5 or v_tick_age>=150 or v_last_tick_status<>'succeeded' then
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
    'recoveryTick',jsonb_build_object(
      'lastAt',v_last_tick,'status',coalesce(v_last_tick_status,'missing'),'ageSeconds',v_tick_age
    ),
    'generatedAt',now()
  );
end $$;
revoke all on function public.gomoku_reliability_snapshot() from public,anon,authenticated;
grant execute on function public.gomoku_reliability_snapshot() to service_role;

select public.gomoku_reliability_tick();

comment on table public.gomoku_reliability_heartbeat is
  'P13 service-readable singleton heartbeat written by the recovery cron; avoids exposing pg_cron catalog privileges to the Edge Function role.';
