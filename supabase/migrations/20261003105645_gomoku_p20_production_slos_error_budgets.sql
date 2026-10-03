-- P20 — Production SLOs, Alerting & Error-Budget Governance
-- Extends P13 reliability telemetry into durable minute-level SLO evidence without per-request write amplification.

create table if not exists public.gomoku_slo_samples (
  sample_minute timestamptz primary key,
  reliability_status text not null check (reliability_status in ('healthy','degraded','critical')),
  service_good boolean not null,
  persistence_good boolean not null,
  recovery_good boolean not null,
  runtime_good boolean not null,
  pending_persistence integer not null default 0 check (pending_persistence>=0),
  oldest_pending_seconds integer not null default 0 check (oldest_pending_seconds>=0),
  recovery_age_seconds integer not null default 0 check (recovery_age_seconds>=0),
  runtime_errors_minute integer not null default 0 check (runtime_errors_minute>=0),
  runtime_warnings_minute integer not null default 0 check (runtime_warnings_minute>=0),
  captured_at timestamptz not null default now()
);

create index if not exists gomoku_slo_samples_captured_idx
  on public.gomoku_slo_samples (sample_minute desc);

create table if not exists public.gomoku_slo_alert_state (
  indicator text primary key check (
    indicator in ('service_availability','persistence_freshness','recovery_freshness','runtime_clean_minutes')
  ),
  state text not null default 'ok' check (state in ('ok','warning','critical')),
  consecutive_bad integer not null default 0 check (consecutive_bad>=0),
  opened_at timestamptz,
  last_breach_at timestamptz,
  last_recovered_at timestamptz,
  last_emitted_at timestamptz,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  updated_at timestamptz not null default now()
);

alter table public.gomoku_slo_samples enable row level security;
alter table public.gomoku_slo_alert_state enable row level security;

revoke all on table public.gomoku_slo_samples from public,anon,authenticated,service_role;
revoke all on table public.gomoku_slo_alert_state from public,anon,authenticated,service_role;
grant select,insert,update,delete on table public.gomoku_slo_samples to service_role;
grant select,insert,update,delete on table public.gomoku_slo_alert_state to service_role;

create or replace function public.gomoku_p20_slo_definitions()
returns jsonb
language sql
immutable
security invoker
set search_path=''
as $$
  select jsonb_build_object(
    'service_availability',jsonb_build_object(
      'objective',0.999,'description','Minute is good when the service is not critical and the recovery heartbeat is fresh.'
    ),
    'persistence_freshness',jsonb_build_object(
      'objective',0.999,'description','Minute is good when no completed-match persistence item is at least 60 seconds old.'
    ),
    'recovery_freshness',jsonb_build_object(
      'objective',0.999,'description','Minute is good when the recovery heartbeat succeeded within 150 seconds.'
    ),
    'runtime_clean_minutes',jsonb_build_object(
      'objective',0.990,'description','Minute is good when no application-runtime error event was recorded.'
    ),
    'windows',jsonb_build_array('1h','24h','7d'),
    'fastBurnWarning',6.0,
    'fastBurnCritical',14.4,
    'minimumSamples',jsonb_build_object('1h',15,'24h',60,'7d',180)
  )
$$;

revoke all on function public.gomoku_p20_slo_definitions() from public,anon,authenticated;
grant execute on function public.gomoku_p20_slo_definitions() to service_role;

create or replace function public.gomoku_p20_update_alert(
  p_indicator text,
  p_good boolean,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v public.gomoku_slo_alert_state%rowtype;
  v_new_state text;
  v_bad integer;
  v_emit boolean:=false;
begin
  if p_indicator not in ('service_availability','persistence_freshness','recovery_freshness','runtime_clean_minutes') then
    raise exception 'Invalid SLO indicator';
  end if;

  insert into public.gomoku_slo_alert_state(indicator)
  values(p_indicator)
  on conflict(indicator) do nothing;

  select * into v
  from public.gomoku_slo_alert_state
  where indicator=p_indicator
  for update;

  v_bad:=case when p_good then 0 else v.consecutive_bad+1 end;
  v_new_state:=case
    when p_good then 'ok'
    when v_bad>=5 then 'critical'
    when v_bad>=2 then 'warning'
    else 'ok'
  end;

  v_emit:=v_new_state<>v.state
    or (
      v_new_state='critical'
      and (v.last_emitted_at is null or v.last_emitted_at<now()-interval '30 minutes')
    );

  update public.gomoku_slo_alert_state
  set state=v_new_state,
      consecutive_bad=v_bad,
      opened_at=case
        when v_new_state in ('warning','critical') and v.state='ok' then now()
        when v_new_state='ok' then null
        else v.opened_at
      end,
      last_breach_at=case when not p_good then now() else v.last_breach_at end,
      last_recovered_at=case when p_good and v.state<>'ok' then now() else v.last_recovered_at end,
      last_emitted_at=case when v_emit then now() else v.last_emitted_at end,
      details=case when jsonb_typeof(coalesce(p_details,'{}'::jsonb))='object' then coalesce(p_details,'{}'::jsonb) else '{}'::jsonb end,
      updated_at=now()
  where indicator=p_indicator
  returning * into v;

  if v_emit then
    perform public.gomoku_record_runtime_event(
      case when v_new_state='critical' then 'error' when v_new_state='warning' then 'warning' else 'info' end,
      'slo',
      case when v_new_state='ok' then 'alert_resolved' else 'alert_'||v_new_state end,
      null,null,null,
      jsonb_build_object(
        'indicator',p_indicator,
        'state',v_new_state,
        'consecutiveBad',v_bad
      )
    );
  end if;

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_p20_update_alert(text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.gomoku_p20_update_alert(text,boolean,jsonb) to service_role;

create or replace function public.gomoku_p20_capture_slo_sample()
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_minute timestamptz:=date_trunc('minute',now());
  v_snapshot jsonb;
  v_status text;
  v_pending integer;
  v_oldest integer;
  v_recovery_age integer;
  v_recovery_status text;
  v_errors integer:=0;
  v_warnings integer:=0;
  v_service_good boolean;
  v_persistence_good boolean;
  v_recovery_good boolean;
  v_runtime_good boolean;
  v_new boolean:=false;
begin
  v_snapshot:=public.gomoku_reliability_snapshot();
  v_status:=coalesce(v_snapshot->>'status','critical');
  v_pending:=greatest(0,coalesce((v_snapshot#>>'{persistence,pending}')::integer,0));
  v_oldest:=greatest(0,coalesce((v_snapshot#>>'{persistence,oldestPendingSeconds}')::integer,0));
  v_recovery_age:=greatest(0,coalesce((v_snapshot#>>'{recoveryTick,ageSeconds}')::integer,999999));
  v_recovery_status:=coalesce(v_snapshot#>>'{recoveryTick,status}','missing');

  select
    count(*) filter(where severity='error')::integer,
    count(*) filter(where severity='warning')::integer
  into v_errors,v_warnings
  from public.gomoku_runtime_events
  where created_at>=v_minute
    and component not in (
      'production_certification','preview_certification','release_admission',
      'release_governance','incident_drill','governance','incident','slo'
    );

  v_service_good:=v_status<>'critical' and v_recovery_age<150;
  v_persistence_good:=v_oldest<60;
  v_recovery_good:=v_recovery_status='succeeded' and v_recovery_age<150;
  v_runtime_good:=v_errors=0;

  v_new:=not exists(
    select 1 from public.gomoku_slo_samples where sample_minute=v_minute
  );

  insert into public.gomoku_slo_samples(
    sample_minute,reliability_status,service_good,persistence_good,recovery_good,runtime_good,
    pending_persistence,oldest_pending_seconds,recovery_age_seconds,
    runtime_errors_minute,runtime_warnings_minute,captured_at
  ) values (
    v_minute,v_status,v_service_good,v_persistence_good,v_recovery_good,v_runtime_good,
    v_pending,v_oldest,v_recovery_age,v_errors,v_warnings,now()
  )
  on conflict(sample_minute) do update set
    reliability_status=excluded.reliability_status,
    service_good=excluded.service_good,
    persistence_good=excluded.persistence_good,
    recovery_good=excluded.recovery_good,
    runtime_good=excluded.runtime_good,
    pending_persistence=excluded.pending_persistence,
    oldest_pending_seconds=excluded.oldest_pending_seconds,
    recovery_age_seconds=excluded.recovery_age_seconds,
    runtime_errors_minute=excluded.runtime_errors_minute,
    runtime_warnings_minute=excluded.runtime_warnings_minute,
    captured_at=now();

  if v_new then
    perform public.gomoku_p20_update_alert(
      'service_availability',v_service_good,
      jsonb_build_object('reliabilityStatus',v_status,'recoveryAgeSeconds',v_recovery_age)
    );
    perform public.gomoku_p20_update_alert(
      'persistence_freshness',v_persistence_good,
      jsonb_build_object('pending',v_pending,'oldestPendingSeconds',v_oldest)
    );
    perform public.gomoku_p20_update_alert(
      'recovery_freshness',v_recovery_good,
      jsonb_build_object('status',v_recovery_status,'ageSeconds',v_recovery_age)
    );
    perform public.gomoku_p20_update_alert(
      'runtime_clean_minutes',v_runtime_good,
      jsonb_build_object('errors',v_errors,'warnings',v_warnings)
    );
  end if;

  delete from public.gomoku_slo_samples
  where sample_minute<now()-interval '30 days';

  return jsonb_build_object(
    'sampleMinute',v_minute,
    'newSample',v_new,
    'serviceGood',v_service_good,
    'persistenceGood',v_persistence_good,
    'recoveryGood',v_recovery_good,
    'runtimeGood',v_runtime_good,
    'reliability',v_snapshot
  );
end
$$;

revoke all on function public.gomoku_p20_capture_slo_sample() from public,anon,authenticated;
grant execute on function public.gomoku_p20_capture_slo_sample() to service_role;

create or replace function public.gomoku_p20_slo_snapshot()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_windows jsonb:='{}'::jsonb;
  v_alerts jsonb:='[]'::jsonb;
  v_status text:='healthy';
  v_fast_burn numeric:=0;
  v_budget_exhausted boolean:=false;
begin
  with defs(indicator,objective) as (
    values
      ('service_availability'::text,0.999::numeric),
      ('persistence_freshness'::text,0.999::numeric),
      ('recovery_freshness'::text,0.999::numeric),
      ('runtime_clean_minutes'::text,0.990::numeric)
  ),
  windows(window_key,since_at,min_samples) as (
    values
      ('1h'::text,now()-interval '1 hour',15),
      ('24h'::text,now()-interval '24 hours',60),
      ('7d'::text,now()-interval '7 days',180)
  ),
  expanded as (
    select
      w.window_key,w.min_samples,d.indicator,d.objective,s.sample_minute,
      case d.indicator
        when 'service_availability' then s.service_good
        when 'persistence_freshness' then s.persistence_good
        when 'recovery_freshness' then s.recovery_good
        else s.runtime_good
      end as good
    from windows w
    cross join defs d
    left join public.gomoku_slo_samples s on s.sample_minute>=w.since_at
  ),
  stats as (
    select
      window_key,min_samples,indicator,objective,
      count(sample_minute)::integer as samples,
      count(sample_minute) filter(where good)::integer as good_samples,
      count(sample_minute) filter(where good=false)::integer as bad_samples
    from expanded
    group by window_key,min_samples,indicator,objective
  ),
  encoded as (
    select
      window_key,
      jsonb_object_agg(
        indicator,
        jsonb_build_object(
          'objective',objective,
          'samples',samples,
          'minimumSamples',min_samples,
          'sufficientData',samples>=min_samples,
          'goodMinutes',good_samples,
          'badMinutes',bad_samples,
          'sliPct',case when samples=0 then null else round(100.0*good_samples/samples,4) end,
          'burnRate',case
            when samples=0 then null
            else round((bad_samples::numeric/samples)/(1-objective),3)
          end,
          'budgetRemainingPct',case
            when samples=0 then null
            else round(100.0*(1-((bad_samples::numeric/samples)/(1-objective))),2)
          end
        )
        order by indicator
      ) as indicators
    from stats
    group by window_key
  )
  select coalesce(jsonb_object_agg(window_key,indicators),'{}'::jsonb)
  into v_windows
  from encoded;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.indicator),'[]'::jsonb)
  into v_alerts
  from public.gomoku_slo_alert_state a;

  with defs(indicator,objective) as (
    values
      ('service_availability'::text,0.999::numeric),
      ('persistence_freshness'::text,0.999::numeric),
      ('recovery_freshness'::text,0.999::numeric),
      ('runtime_clean_minutes'::text,0.990::numeric)
  ),
  x as (
    select d.indicator,d.objective,
      count(s.sample_minute)::integer as samples,
      count(s.sample_minute) filter(
        where case d.indicator
          when 'service_availability' then s.service_good
          when 'persistence_freshness' then s.persistence_good
          when 'recovery_freshness' then s.recovery_good
          else s.runtime_good
        end=false
      )::integer as bad
    from defs d
    left join public.gomoku_slo_samples s on s.sample_minute>=now()-interval '1 hour'
    group by d.indicator,d.objective
  )
  select coalesce(max(case when samples>=15 then (bad::numeric/nullif(samples,0))/(1-objective) else 0 end),0)
  into v_fast_burn
  from x;

  with defs(indicator,objective) as (
    values
      ('service_availability'::text,0.999::numeric),
      ('persistence_freshness'::text,0.999::numeric),
      ('recovery_freshness'::text,0.999::numeric),
      ('runtime_clean_minutes'::text,0.990::numeric)
  ),
  x as (
    select d.indicator,d.objective,
      count(s.sample_minute)::integer as samples,
      count(s.sample_minute) filter(
        where case d.indicator
          when 'service_availability' then s.service_good
          when 'persistence_freshness' then s.persistence_good
          when 'recovery_freshness' then s.recovery_good
          else s.runtime_good
        end
      )::integer as good
    from defs d
    left join public.gomoku_slo_samples s on s.sample_minute>=now()-interval '24 hours'
    group by d.indicator,d.objective
  )
  select coalesce(bool_or(samples>=60 and good::numeric/nullif(samples,0)<objective),false)
  into v_budget_exhausted
  from x;

  if exists(select 1 from public.gomoku_slo_alert_state where state='critical')
     or v_fast_burn>=14.4
     or v_budget_exhausted then
    v_status:='critical';
  elsif exists(select 1 from public.gomoku_slo_alert_state where state='warning')
     or v_fast_burn>=6.0 then
    v_status:='warning';
  end if;

  return jsonb_build_object(
    'status',v_status,
    'definitions',public.gomoku_p20_slo_definitions(),
    'windows',v_windows,
    'alerts',v_alerts,
    'fastBurn1h',round(v_fast_burn,3),
    'budgetExhausted24h',v_budget_exhausted,
    'generatedAt',now()
  );
end
$$;

revoke all on function public.gomoku_p20_slo_snapshot() from public,anon,authenticated;
grant execute on function public.gomoku_p20_slo_snapshot() to service_role;

create or replace function public.gomoku_p20_release_guard()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_reliability jsonb;
  v_slo jsonb;
  v_status text:='healthy';
  v_reason text:='SLOs are within the production release guard.';
begin
  v_reliability:=public.gomoku_reliability_snapshot();
  v_slo:=public.gomoku_p20_slo_snapshot();

  if coalesce(v_reliability->>'status','critical')='critical' then
    v_status:='frozen';
    v_reason:='Current reliability state is critical.';
  elsif coalesce(v_slo->>'status','critical')='critical' then
    v_status:='frozen';
    v_reason:='SLO burn rate, error budget, or sustained alert state is critical.';
  elsif coalesce(v_slo->>'status','warning')='warning' then
    v_status:='warning';
    v_reason:='SLO warning is active; release remains permitted but requires operator attention.';
  end if;

  return jsonb_build_object(
    'allowed',v_status<>'frozen',
    'status',v_status,
    'reason',v_reason,
    'reliabilityStatus',v_reliability->>'status',
    'sloStatus',v_slo->>'status',
    'fastBurn1h',v_slo->'fastBurn1h',
    'budgetExhausted24h',v_slo->'budgetExhausted24h',
    'generatedAt',now()
  );
end
$$;

revoke all on function public.gomoku_p20_release_guard() from public,anon,authenticated;
grant execute on function public.gomoku_p20_release_guard() to service_role;

create or replace function public.gomoku_p20_public_status()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_slo jsonb:=public.gomoku_p20_slo_snapshot();
  v_guard jsonb:=public.gomoku_p20_release_guard();
begin
  return jsonb_build_object(
    'status',v_slo->>'status',
    'releaseGuard',v_guard,
    'windows',v_slo->'windows',
    'generatedAt',now()
  );
end
$$;

revoke all on function public.gomoku_p20_public_status() from public,anon,authenticated;
grant execute on function public.gomoku_p20_public_status() to service_role;

create or replace function public.gomoku_p20_admin_summary(p_actor_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_role text;
  v_slo jsonb;
  v_guard jsonb;
  v_samples jsonb;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['operator','incident_commander','release_manager','admin']::text[]
  );
  v_slo:=public.gomoku_p20_slo_snapshot();
  v_guard:=public.gomoku_p20_release_guard();

  select coalesce(jsonb_agg(to_jsonb(x) order by x.sample_minute desc),'[]'::jsonb)
  into v_samples
  from (
    select sample_minute,reliability_status,service_good,persistence_good,recovery_good,runtime_good,
           pending_persistence,oldest_pending_seconds,recovery_age_seconds,
           runtime_errors_minute,runtime_warnings_minute
    from public.gomoku_slo_samples
    order by sample_minute desc
    limit 60
  ) x;

  return jsonb_build_object(
    'operatorRole',v_role,
    'slo',v_slo,
    'releaseGuard',v_guard,
    'recentSamples',v_samples,
    'generatedAt',now()
  );
end
$$;

revoke all on function public.gomoku_p20_admin_summary(uuid) from public,anon,authenticated;
grant execute on function public.gomoku_p20_admin_summary(uuid) to service_role;

do $$
declare v_job bigint;
begin
  for v_job in select jobid from cron.job where jobname='gomoku-p20-slo-sample'
  loop
    perform cron.unschedule(v_job);
  end loop;

  perform cron.schedule(
    'gomoku-p20-slo-sample',
    '* * * * *',
    'select public.gomoku_p20_capture_slo_sample();'
  );
end
$$;

select public.gomoku_p20_capture_slo_sample();

comment on table public.gomoku_slo_samples is
  'P20 minute-level sanitized SLO evidence. It intentionally avoids per-request telemetry writes.';
comment on table public.gomoku_slo_alert_state is
  'P20 deduplicated SLO alert state with warning/critical escalation and a 30-minute critical reminder cooldown.';
comment on function public.gomoku_p20_release_guard() is
  'P20 release guard: freezes production certification when current reliability or SLO/error-budget state is critical.';
