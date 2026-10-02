-- P17 corrective hardening — keep release-control failures out of runtime health.
--
-- Production certification is a control-plane check. A failed certification is
-- still retained in gomoku_runtime_events, but it must not count as an
-- application runtime error inside the health signal that certification itself
-- consumes. Otherwise retries create their own critical health condition.

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
  v_cert_errors_15m integer:=0;
  v_cert_warnings_15m integer:=0;
  v_last_tick timestamptz;
  v_last_tick_status text;
  v_tick_age integer:=0;
  v_status text:='healthy';
begin
  select count(*)::integer,
         count(*) filter(where state->>'mode' in ('ranked','tournament','challenge'))::integer
  into v_active_rooms,v_competitive_rooms
  from public.gomoku_rooms
  where expires_at>now();

  select count(*)::integer
  into v_queue
  from public.gomoku_matchmaking_queue
  where last_seen>=now()-interval '90 seconds';

  select count(*)::integer
  into v_ranked_active
  from public.gomoku_ranked_active;

  select count(*)::integer,
         count(*) filter(where attempts>0)::integer,
         coalesce(max(extract(epoch from (now()-captured_at)))::integer,0)
  into v_pending,v_retrying,v_oldest
  from public.gomoku_match_persistence_outbox
  where persisted_at is null;

  select
    count(*) filter(
      where severity='error'
        and component is distinct from 'production_certification'
    )::integer,
    count(*) filter(
      where severity='warning'
        and component is distinct from 'production_certification'
    )::integer,
    count(*) filter(
      where severity='error'
        and component='production_certification'
    )::integer,
    count(*) filter(
      where severity='warning'
        and component='production_certification'
    )::integer
  into v_errors_15m,v_warnings_15m,v_cert_errors_15m,v_cert_warnings_15m
  from public.gomoku_runtime_events
  where created_at>=now()-interval '15 minutes';

  select last_tick_at,last_tick_status
  into v_last_tick,v_last_tick_status
  from public.gomoku_reliability_heartbeat
  where id=1;

  v_tick_age:=case
    when v_last_tick is null then 999999
    else greatest(0,extract(epoch from (now()-v_last_tick))::integer)
  end;

  if v_pending>=10
     or v_oldest>=600
     or v_errors_15m>=10
     or v_tick_age>=300 then
    v_status:='critical';
  elsif (v_pending>0 and v_oldest>=90)
     or v_retrying>0
     or v_errors_15m>0
     or v_warnings_15m>=5
     or v_tick_age>=150
     or v_last_tick_status<>'succeeded' then
    v_status:='degraded';
  end if;

  return jsonb_build_object(
    'status',v_status,
    'activeRooms',v_active_rooms,
    'competitiveRooms',v_competitive_rooms,
    'rankedQueue',v_queue,
    'rankedAssignments',v_ranked_active,
    'persistence',jsonb_build_object(
      'pending',v_pending,
      'retrying',v_retrying,
      'oldestPendingSeconds',v_oldest
    ),
    'events15m',jsonb_build_object(
      'errors',v_errors_15m,
      'warnings',v_warnings_15m
    ),
    'releaseControl15m',jsonb_build_object(
      'certificationErrors',v_cert_errors_15m,
      'certificationWarnings',v_cert_warnings_15m
    ),
    'recoveryTick',jsonb_build_object(
      'lastAt',v_last_tick,
      'status',coalesce(v_last_tick_status,'missing'),
      'ageSeconds',v_tick_age
    ),
    'generatedAt',now()
  );
end
$$;

comment on function public.gomoku_reliability_snapshot() is
  'P17 health snapshot: application health excludes production-certification feedback events while retaining separate release-control telemetry.';
