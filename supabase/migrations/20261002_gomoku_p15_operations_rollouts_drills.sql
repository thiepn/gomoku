-- P15 — Competitive Operations Console, Controlled Rollouts & Incident Drill Certification
-- Adds deployment reconciliation, staged rollout governance, and non-destructive
-- incident drill evidence on top of P14's operator control plane.

create table if not exists public.gomoku_deployment_observations (
  id bigint generated always as identity primary key,
  release_id uuid references public.gomoku_release_registry(id) on delete set null,
  environment text not null default 'production'
    check (environment in ('production','staging')),
  git_sha text not null check (git_sha ~ '^[0-9a-f]{40}$'),
  edge_function_version integer
    check (edge_function_version is null or edge_function_version >= 1),
  edge_bundle_sha256 text
    check (edge_bundle_sha256 is null or edge_bundle_sha256 ~ '^[0-9a-f]{64}$'),
  frontend_sha text
    check (frontend_sha is null or frontend_sha ~ '^[0-9a-f]{40}$'),
  source text not null default 'operator'
    check (source in ('operator','github_action','system_certification','deploy_api')),
  notes text,
  observed_by uuid references auth.users(id) on delete set null,
  observed_at timestamptz not null default now(),
  constraint gomoku_deployment_observations_notes_check
    check (notes is null or char_length(notes) <= 800)
);

create index if not exists gomoku_deployment_observations_time_idx
  on public.gomoku_deployment_observations (environment, observed_at desc);
create index if not exists gomoku_deployment_observations_release_idx
  on public.gomoku_deployment_observations (release_id, observed_at desc)
  where release_id is not null;
create index if not exists gomoku_deployment_observations_git_idx
  on public.gomoku_deployment_observations (git_sha, observed_at desc);

create table if not exists public.gomoku_rollouts (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.gomoku_release_registry(id) on delete restrict,
  environment text not null default 'production'
    check (environment in ('production','staging')),
  status text not null default 'planned'
    check (status in ('planned','running','paused','completed','rolled_back')),
  stage text not null default 'observe'
    check (stage in ('observe','limited','broad','full')),
  reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  last_actor_user_id uuid not null references auth.users(id) on delete restrict,
  last_deployment_observation_id bigint references public.gomoku_deployment_observations(id) on delete set null,
  started_at timestamptz,
  stage_started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gomoku_rollouts_reason_check
    check (char_length(reason) between 3 and 800)
);

create unique index if not exists gomoku_rollouts_one_open_production_idx
  on public.gomoku_rollouts ((1))
  where environment='production' and status in ('planned','running','paused');
create index if not exists gomoku_rollouts_release_idx
  on public.gomoku_rollouts (release_id, created_at desc);
create index if not exists gomoku_rollouts_updated_idx
  on public.gomoku_rollouts (updated_at desc);

create table if not exists public.gomoku_incident_drill_runs (
  id uuid primary key default gen_random_uuid(),
  scenario text not null
    check (scenario in ('ranked_outage','persistence_degradation','bad_release','full')),
  mode text not null
    check (mode in ('structural','operator')),
  status text not null
    check (status in ('passed','failed')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null
    check (actor_role in ('operator','incident_commander','release_manager','admin','system')),
  health_status text,
  checks jsonb not null default '{}'::jsonb
    check (jsonb_typeof(checks)='object'),
  operational_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(operational_snapshot)='object'),
  summary text not null,
  request_id text,
  created_at timestamptz not null default now(),
  constraint gomoku_incident_drill_health_check
    check (health_status is null or health_status in ('healthy','degraded','critical','maintenance','unknown')),
  constraint gomoku_incident_drill_summary_check
    check (char_length(summary) between 3 and 1000),
  constraint gomoku_incident_drill_request_check
    check (request_id is null or char_length(request_id) <= 96)
);

create index if not exists gomoku_incident_drill_runs_created_idx
  on public.gomoku_incident_drill_runs (created_at desc);

alter table public.gomoku_deployment_observations enable row level security;
alter table public.gomoku_rollouts enable row level security;
alter table public.gomoku_incident_drill_runs enable row level security;

revoke all on table public.gomoku_deployment_observations from public,anon,authenticated,service_role;
revoke all on table public.gomoku_rollouts from public,anon,authenticated,service_role;
revoke all on table public.gomoku_incident_drill_runs from public,anon,authenticated,service_role;

grant select,insert on table public.gomoku_deployment_observations to service_role;
grant select,insert,update on table public.gomoku_rollouts to service_role;
grant select,insert on table public.gomoku_incident_drill_runs to service_role;

revoke all on sequence public.gomoku_deployment_observations_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.gomoku_deployment_observations_id_seq to service_role;

create or replace function public.gomoku_p15_reconciliation()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_rollout public.gomoku_rollouts%rowtype;
  v_release public.gomoku_release_registry%rowtype;
  v_observation public.gomoku_deployment_observations%rowtype;
  v_state text;
begin
  select * into v_rollout
  from public.gomoku_rollouts
  where environment='production'
    and status in ('planned','running','paused')
  order by created_at desc
  limit 1;

  if v_rollout.id is not null then
    select * into v_release
    from public.gomoku_release_registry
    where id=v_rollout.release_id;
  else
    select * into v_release
    from public.gomoku_release_registry
    where status='active'
    limit 1;
  end if;

  select * into v_observation
  from public.gomoku_deployment_observations
  where environment='production'
  order by observed_at desc
  limit 1;

  v_state:=case
    when v_release.id is null and v_observation.id is null then 'untracked'
    when v_release.id is null then 'deployment_unregistered'
    when v_observation.id is null then 'deployment_unobserved'
    when v_observation.git_sha=v_release.git_sha then 'matched'
    else 'mismatch'
  end;

  return jsonb_build_object(
    'state',v_state,
    'expectedReleaseId',v_release.id,
    'expectedVersion',v_release.version,
    'expectedGitSha',v_release.git_sha,
    'observedDeploymentId',v_observation.id,
    'observedGitSha',v_observation.git_sha,
    'edgeFunctionVersion',v_observation.edge_function_version,
    'edgeBundleSha256',v_observation.edge_bundle_sha256,
    'frontendSha',v_observation.frontend_sha,
    'observedAt',v_observation.observed_at,
    'rolloutId',v_rollout.id,
    'rolloutStatus',v_rollout.status,
    'rolloutStage',v_rollout.stage
  );
end
$$;

revoke all on function public.gomoku_p15_reconciliation() from public,anon,authenticated;
grant execute on function public.gomoku_p15_reconciliation() to service_role;

create or replace function public.gomoku_public_operational_status()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  c public.gomoku_competitive_control%rowtype;
  i public.gomoku_incidents%rowtype;
  r public.gomoku_release_registry%rowtype;
  ro public.gomoku_rollouts%rowtype;
  d public.gomoku_incident_drill_runs%rowtype;
begin
  select * into c from public.gomoku_competitive_control where id=1;

  if c.id is null then
    return jsonb_build_object(
      'serviceMode','normal',
      'rankedEnabled',true,
      'tournamentsEnabled',true,
      'challengesEnabled',true,
      'roomCreationEnabled',true,
      'banner',null,
      'incident',null,
      'release',null,
      'rollout',null,
      'certification',null,
      'updatedAt',null
    );
  end if;

  if c.active_incident_id is not null then
    select * into i from public.gomoku_incidents where id=c.active_incident_id;
  end if;

  select * into r
  from public.gomoku_release_registry
  where status='active'
  limit 1;

  select * into ro
  from public.gomoku_rollouts
  where environment='production'
    and status in ('planned','running','paused')
  order by created_at desc
  limit 1;

  select * into d
  from public.gomoku_incident_drill_runs
  where scenario='full' and status='passed'
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'serviceMode',c.service_mode,
    'rankedEnabled',c.ranked_enabled,
    'tournamentsEnabled',c.tournaments_enabled,
    'challengesEnabled',c.challenges_enabled,
    'roomCreationEnabled',c.room_creation_enabled,
    'banner',c.public_banner,
    'incident',case when i.id is null then null else jsonb_build_object(
      'id',i.id,
      'severity',i.severity,
      'status',i.status,
      'title',i.title,
      'startedAt',i.started_at,
      'updatedAt',i.updated_at
    ) end,
    'release',case when r.id is null then null else jsonb_build_object(
      'id',r.id,
      'version',r.version,
      'gitSha',r.git_sha,
      'activatedAt',r.activated_at
    ) end,
    'rollout',case when ro.id is null then null else jsonb_build_object(
      'id',ro.id,
      'status',ro.status,
      'stage',ro.stage,
      'startedAt',ro.started_at,
      'stageStartedAt',ro.stage_started_at,
      'updatedAt',ro.updated_at
    ) end,
    'certification',case when d.id is null then null else jsonb_build_object(
      'scenario',d.scenario,
      'status',d.status,
      'mode',d.mode,
      'certifiedAt',d.created_at
    ) end,
    'updatedAt',c.updated_at
  );
end
$$;

revoke all on function public.gomoku_public_operational_status() from public,anon,authenticated;
grant execute on function public.gomoku_public_operational_status() to service_role;

create or replace function public.gomoku_admin_overview(p_actor_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_role text;
  v_incidents jsonb;
  v_releases jsonb;
  v_audit jsonb;
  v_rollouts jsonb;
  v_deployments jsonb;
  v_drills jsonb;
begin
  v_role:=public.gomoku_admin_assert_operator(p_actor_user_id,null);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc),'[]'::jsonb)
  into v_incidents
  from (
    select id,severity,status,title,summary,commander_user_id,started_at,acknowledged_at,resolved_at,updated_at
    from public.gomoku_incidents
    order by started_at desc
    limit 20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_releases
  from (
    select id,version,git_sha,status,source_ref,previous_release_id,created_at,approved_at,activated_at,rolled_back_at,updated_at
    from public.gomoku_release_registry
    order by created_at desc
    limit 20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_audit
  from (
    select id,actor_user_id,actor_role,action,target_type,target_id,reason,request_id,created_at
    from public.gomoku_admin_audit_log
    order by created_at desc
    limit 80
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_rollouts
  from (
    select ro.id,ro.release_id,rr.version as release_version,rr.git_sha,ro.environment,
           ro.status,ro.stage,ro.reason,ro.last_deployment_observation_id,
           ro.started_at,ro.stage_started_at,ro.paused_at,ro.completed_at,
           ro.rolled_back_at,ro.created_at,ro.updated_at
    from public.gomoku_rollouts ro
    join public.gomoku_release_registry rr on rr.id=ro.release_id
    order by ro.created_at desc
    limit 20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.observed_at desc),'[]'::jsonb)
  into v_deployments
  from (
    select o.id,o.release_id,rr.version as release_version,o.environment,o.git_sha,
           o.edge_function_version,o.edge_bundle_sha256,o.frontend_sha,o.source,
           o.notes,o.observed_at
    from public.gomoku_deployment_observations o
    left join public.gomoku_release_registry rr on rr.id=o.release_id
    order by o.observed_at desc
    limit 30
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_drills
  from (
    select id,scenario,mode,status,actor_role,health_status,checks,summary,request_id,created_at
    from public.gomoku_incident_drill_runs
    order by created_at desc
    limit 30
  ) x;

  return jsonb_build_object(
    'operatorRole',v_role,
    'operations',public.gomoku_public_operational_status(),
    'reconciliation',public.gomoku_p15_reconciliation(),
    'incidents',v_incidents,
    'releases',v_releases,
    'rollouts',v_rollouts,
    'deployments',v_deployments,
    'drills',v_drills,
    'audit',v_audit,
    'generatedAt',now()
  );
end
$$;

revoke all on function public.gomoku_admin_overview(uuid) from public,anon,authenticated;
grant execute on function public.gomoku_admin_overview(uuid) to service_role;

create or replace function public.gomoku_admin_record_deployment(
  p_actor_user_id uuid,
  p_git_sha text,
  p_edge_function_version integer default null,
  p_edge_bundle_sha256 text default null,
  p_frontend_sha text default null,
  p_notes text default null,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_role text;
  v_release_id uuid;
  v public.gomoku_deployment_observations%rowtype;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['release_manager','admin']::text[]
  );

  if lower(coalesce(p_git_sha,'')) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid deployment git sha';
  end if;
  if p_edge_bundle_sha256 is not null and lower(p_edge_bundle_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid Edge bundle sha256';
  end if;
  if p_frontend_sha is not null and lower(p_frontend_sha) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid frontend sha';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'Deployment observations require a reason';
  end if;

  select id into v_release_id
  from public.gomoku_release_registry
  where git_sha=lower(p_git_sha)
  limit 1;

  insert into public.gomoku_deployment_observations(
    release_id,environment,git_sha,edge_function_version,edge_bundle_sha256,
    frontend_sha,source,notes,observed_by,observed_at
  ) values (
    v_release_id,'production',lower(p_git_sha),p_edge_function_version,
    case when p_edge_bundle_sha256 is null then null else lower(p_edge_bundle_sha256) end,
    case when p_frontend_sha is null then null else lower(p_frontend_sha) end,
    'operator',nullif(left(btrim(coalesce(p_notes,'')),800),''),
    p_actor_user_id,now()
  )
  returning * into v;

  perform public.gomoku_admin_audit(
    p_actor_user_id,v_role,'deployment.observed','deployment',v.id::text,
    p_reason,null,to_jsonb(v),p_request_id
  );

  return jsonb_build_object(
    'deployment',to_jsonb(v),
    'reconciliation',public.gomoku_p15_reconciliation()
  );
end
$$;

revoke all on function public.gomoku_admin_record_deployment(uuid,text,integer,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_record_deployment(uuid,text,integer,text,text,text,text,text)
  to service_role;

create or replace function public.gomoku_p15_system_record_deployment(
  p_git_sha text,
  p_edge_function_version integer default null,
  p_edge_bundle_sha256 text default null,
  p_frontend_sha text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_release_id uuid;
  v public.gomoku_deployment_observations%rowtype;
begin
  if lower(coalesce(p_git_sha,'')) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid deployment git sha';
  end if;
  if p_edge_bundle_sha256 is not null and lower(p_edge_bundle_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid Edge bundle sha256';
  end if;
  if p_frontend_sha is not null and lower(p_frontend_sha) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid frontend sha';
  end if;

  select id into v_release_id
  from public.gomoku_release_registry
  where git_sha=lower(p_git_sha)
  limit 1;

  insert into public.gomoku_deployment_observations(
    release_id,environment,git_sha,edge_function_version,edge_bundle_sha256,
    frontend_sha,source,notes,observed_by,observed_at
  ) values (
    v_release_id,'production',lower(p_git_sha),p_edge_function_version,
    case when p_edge_bundle_sha256 is null then null else lower(p_edge_bundle_sha256) end,
    case when p_frontend_sha is null then null else lower(p_frontend_sha) end,
    'system_certification',nullif(left(btrim(coalesce(p_notes,'')),800),''),
    null,now()
  )
  returning * into v;

  return jsonb_build_object(
    'deployment',to_jsonb(v),
    'reconciliation',public.gomoku_p15_reconciliation()
  );
end
$$;

revoke all on function public.gomoku_p15_system_record_deployment(text,integer,text,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p15_system_record_deployment(text,integer,text,text,text)
  to service_role;

create or replace function public.gomoku_admin_create_rollout(
  p_actor_user_id uuid,
  p_release_id uuid,
  p_reason text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_role text;
  v_release public.gomoku_release_registry%rowtype;
  v public.gomoku_rollouts%rowtype;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['release_manager','admin']::text[]
  );

  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'Rollout creation requires a reason';
  end if;

  select * into v_release
  from public.gomoku_release_registry
  where id=p_release_id;

  if v_release.id is null then
    raise exception 'Release not found';
  end if;
  if v_release.status not in ('approved','active') then
    raise exception 'Only approved or active releases can enter rollout validation';
  end if;
  if exists(
    select 1 from public.gomoku_rollouts
    where environment='production' and status in ('planned','running','paused')
  ) then
    raise exception 'Another production rollout is already open';
  end if;

  insert into public.gomoku_rollouts(
    release_id,environment,status,stage,reason,created_by,last_actor_user_id,created_at,updated_at
  ) values (
    v_release.id,'production','planned','observe',left(btrim(p_reason),800),
    p_actor_user_id,p_actor_user_id,now(),now()
  )
  returning * into v;

  perform public.gomoku_admin_audit(
    p_actor_user_id,v_role,'rollout.created','rollout',v.id::text,
    p_reason,null,to_jsonb(v),p_request_id
  );

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_admin_create_rollout(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_create_rollout(uuid,uuid,text,text)
  to service_role;

create or replace function public.gomoku_admin_transition_rollout(
  p_actor_user_id uuid,
  p_rollout_id uuid,
  p_action text,
  p_health_status text,
  p_target_release_id uuid default null,
  p_reason text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_role text;
  v_before public.gomoku_rollouts%rowtype;
  v_after public.gomoku_rollouts%rowtype;
  v_release public.gomoku_release_registry%rowtype;
  v_observation public.gomoku_deployment_observations%rowtype;
  v_active_release public.gomoku_release_registry%rowtype;
  v_next_stage text;
  v_min_minutes integer;
  v_age_minutes numeric;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['release_manager','admin']::text[]
  );

  if p_action not in ('start','advance','pause','resume','complete','rollback') then
    raise exception 'Invalid rollout transition';
  end if;
  if p_health_status not in ('healthy','degraded','critical','maintenance','unknown') then
    raise exception 'Invalid health status';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'Rollout transitions require a reason';
  end if;

  select * into v_before
  from public.gomoku_rollouts
  where id=p_rollout_id
  for update;

  if v_before.id is null then
    raise exception 'Rollout not found';
  end if;

  select * into v_release
  from public.gomoku_release_registry
  where id=v_before.release_id;

  select * into v_observation
  from public.gomoku_deployment_observations
  where environment=v_before.environment
    and git_sha=v_release.git_sha
  order by observed_at desc
  limit 1;

  if p_action in ('start','advance','resume','complete') then
    if p_health_status <> 'healthy' then
      raise exception 'Rollout progression requires healthy service status';
    end if;
    if v_observation.id is null then
      raise exception 'No matching deployment observation exists for this release';
    end if;
    if v_observation.observed_at < now()-interval '2 hours' then
      raise exception 'The matching deployment observation is stale; record the current deployment first';
    end if;
  end if;

  if p_action='start' then
    if v_before.status <> 'planned' then
      raise exception 'Only planned rollouts can start';
    end if;
    update public.gomoku_rollouts
    set status='running',stage='observe',started_at=now(),stage_started_at=now(),
        paused_at=null,last_actor_user_id=p_actor_user_id,
        last_deployment_observation_id=v_observation.id,updated_at=now()
    where id=p_rollout_id
    returning * into v_after;

  elsif p_action='advance' then
    if v_before.status <> 'running' then
      raise exception 'Only running rollouts can advance';
    end if;

    v_next_stage:=case v_before.stage
      when 'observe' then 'limited'
      when 'limited' then 'broad'
      when 'broad' then 'full'
      else null
    end;

    if v_next_stage is null then
      raise exception 'Full validation is already reached; complete the rollout instead';
    end if;

    v_min_minutes:=case v_before.stage
      when 'observe' then 2
      when 'limited' then 5
      when 'broad' then 10
      else 0
    end;

    v_age_minutes:=extract(epoch from (now()-coalesce(v_before.stage_started_at,v_before.updated_at)))/60.0;
    if v_age_minutes < v_min_minutes then
      raise exception 'Minimum validation dwell time has not elapsed for the current stage';
    end if;

    update public.gomoku_rollouts
    set stage=v_next_stage,stage_started_at=now(),last_actor_user_id=p_actor_user_id,
        last_deployment_observation_id=v_observation.id,updated_at=now()
    where id=p_rollout_id
    returning * into v_after;

  elsif p_action='pause' then
    if v_before.status <> 'running' then
      raise exception 'Only running rollouts can be paused';
    end if;

    update public.gomoku_rollouts
    set status='paused',paused_at=now(),last_actor_user_id=p_actor_user_id,updated_at=now()
    where id=p_rollout_id
    returning * into v_after;

  elsif p_action='resume' then
    if v_before.status <> 'paused' then
      raise exception 'Only paused rollouts can resume';
    end if;

    update public.gomoku_rollouts
    set status='running',paused_at=null,stage_started_at=now(),
        last_actor_user_id=p_actor_user_id,
        last_deployment_observation_id=v_observation.id,updated_at=now()
    where id=p_rollout_id
    returning * into v_after;

  elsif p_action='complete' then
    if v_before.status <> 'running' or v_before.stage <> 'full' then
      raise exception 'Rollout must be running at full validation before completion';
    end if;

    v_age_minutes:=extract(epoch from (now()-coalesce(v_before.stage_started_at,v_before.updated_at)))/60.0;
    if v_age_minutes < 15 then
      raise exception 'Full validation requires at least 15 minutes before completion';
    end if;

    if v_release.status='approved' then
      perform public.gomoku_admin_transition_release(
        p_actor_user_id,v_release.id,'activate',null,
        'Rollout completed: '||left(btrim(p_reason),760),p_request_id
      );
    end if;

    update public.gomoku_rollouts
    set status='completed',completed_at=now(),last_actor_user_id=p_actor_user_id,
        last_deployment_observation_id=v_observation.id,updated_at=now()
    where id=p_rollout_id
    returning * into v_after;

  else
    if v_before.status not in ('planned','running','paused') then
      raise exception 'Only open rollouts can be rolled back';
    end if;

    select * into v_active_release
    from public.gomoku_release_registry
    where status='active'
    limit 1;

    if v_active_release.id=v_release.id then
      if p_target_release_id is null then
        raise exception 'Rollback of the active release requires a target release';
      end if;
      perform public.gomoku_admin_transition_release(
        p_actor_user_id,v_release.id,'rollback',p_target_release_id,
        'Rollout rollback: '||left(btrim(p_reason),760),p_request_id
      );
    end if;

    update public.gomoku_rollouts
    set status='rolled_back',rolled_back_at=now(),last_actor_user_id=p_actor_user_id,updated_at=now()
    where id=p_rollout_id
    returning * into v_after;
  end if;

  perform public.gomoku_admin_audit(
    p_actor_user_id,v_role,'rollout.'||p_action,'rollout',p_rollout_id::text,
    p_reason,to_jsonb(v_before),to_jsonb(v_after),p_request_id
  );

  return jsonb_build_object(
    'rollout',to_jsonb(v_after),
    'reconciliation',public.gomoku_p15_reconciliation()
  );
end
$$;

revoke all on function public.gomoku_admin_transition_rollout(uuid,uuid,text,text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_transition_rollout(uuid,uuid,text,text,uuid,text,text)
  to service_role;

create or replace function public.gomoku_p15_drill_checks(p_scenario text)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_controls boolean;
  v_control_preserves_rooms boolean;
  v_outbox boolean;
  v_heartbeat boolean;
  v_recovery_rpc boolean;
  v_release_rpc boolean;
  v_rollout_rpc boolean;
  v_deployments boolean;
  v_private_tables boolean;
  v_private_rpcs boolean;
  v_audit_append_only boolean;
  v_audit_sequence_private boolean;
begin
  if p_scenario not in ('ranked_outage','persistence_degradation','bad_release','full') then
    raise exception 'Invalid drill scenario';
  end if;

  v_controls:=to_regclass('public.gomoku_competitive_control') is not null
    and exists(select 1 from public.gomoku_competitive_control where id=1);

  v_control_preserves_rooms:=position(
    'gomoku_rooms' in lower(pg_get_functiondef(
      'public.gomoku_admin_set_controls(uuid,text,boolean,boolean,boolean,boolean,text,boolean,text,text)'::regprocedure
    ))
  )=0;

  v_outbox:=to_regclass('public.gomoku_match_persistence_outbox') is not null;
  v_heartbeat:=to_regclass('public.gomoku_reliability_heartbeat') is not null;
  v_recovery_rpc:=to_regprocedure('public.gomoku_reliability_snapshot()') is not null;
  v_release_rpc:=to_regprocedure('public.gomoku_admin_transition_release(uuid,uuid,text,uuid,text,text)') is not null;
  v_rollout_rpc:=to_regprocedure('public.gomoku_admin_transition_rollout(uuid,uuid,text,text,uuid,text,text)') is not null;
  v_deployments:=to_regclass('public.gomoku_deployment_observations') is not null;

  v_private_tables:=
    not has_table_privilege('anon','public.gomoku_deployment_observations','SELECT')
    and not has_table_privilege('authenticated','public.gomoku_deployment_observations','SELECT')
    and not has_table_privilege('anon','public.gomoku_rollouts','SELECT')
    and not has_table_privilege('authenticated','public.gomoku_rollouts','SELECT')
    and not has_table_privilege('anon','public.gomoku_incident_drill_runs','SELECT')
    and not has_table_privilege('authenticated','public.gomoku_incident_drill_runs','SELECT');

  v_private_rpcs:=
    not has_function_privilege('anon','public.gomoku_admin_record_deployment(uuid,text,integer,text,text,text,text,text)','EXECUTE')
    and not has_function_privilege('authenticated','public.gomoku_admin_record_deployment(uuid,text,integer,text,text,text,text,text)','EXECUTE')
    and not has_function_privilege('anon','public.gomoku_admin_create_rollout(uuid,uuid,text,text)','EXECUTE')
    and not has_function_privilege('authenticated','public.gomoku_admin_create_rollout(uuid,uuid,text,text)','EXECUTE')
    and not has_function_privilege('anon','public.gomoku_admin_transition_rollout(uuid,uuid,text,text,uuid,text,text)','EXECUTE')
    and not has_function_privilege('authenticated','public.gomoku_admin_transition_rollout(uuid,uuid,text,text,uuid,text,text)','EXECUTE');

  v_audit_append_only:=
    has_table_privilege('service_role','public.gomoku_admin_audit_log','SELECT')
    and has_table_privilege('service_role','public.gomoku_admin_audit_log','INSERT')
    and not has_table_privilege('service_role','public.gomoku_admin_audit_log','UPDATE')
    and not has_table_privilege('service_role','public.gomoku_admin_audit_log','DELETE')
    and not has_table_privilege('service_role','public.gomoku_admin_audit_log','TRUNCATE');

  v_audit_sequence_private:=
    not has_sequence_privilege('anon','public.gomoku_admin_audit_log_id_seq','USAGE')
    and not has_sequence_privilege('authenticated','public.gomoku_admin_audit_log_id_seq','USAGE')
    and has_sequence_privilege('service_role','public.gomoku_admin_audit_log_id_seq','USAGE');

  return case p_scenario
    when 'ranked_outage' then jsonb_build_object(
      'controlPlanePresent',v_controls,
      'newEntryControlsPreserveActiveRooms',v_control_preserves_rooms,
      'adminSurfacesPrivate',v_private_tables and v_private_rpcs,
      'auditAppendOnly',v_audit_append_only and v_audit_sequence_private
    )
    when 'persistence_degradation' then jsonb_build_object(
      'durableOutboxPresent',v_outbox,
      'recoveryHeartbeatPresent',v_heartbeat,
      'reliabilitySnapshotPresent',v_recovery_rpc,
      'newEntryControlsPreserveActiveRooms',v_control_preserves_rooms,
      'auditAppendOnly',v_audit_append_only and v_audit_sequence_private
    )
    when 'bad_release' then jsonb_build_object(
      'releaseRollbackContractPresent',v_release_rpc,
      'rolloutRollbackContractPresent',v_rollout_rpc,
      'deploymentReconciliationPresent',v_deployments,
      'adminSurfacesPrivate',v_private_tables and v_private_rpcs,
      'auditAppendOnly',v_audit_append_only and v_audit_sequence_private
    )
    else jsonb_build_object(
      'controlPlanePresent',v_controls,
      'newEntryControlsPreserveActiveRooms',v_control_preserves_rooms,
      'durableOutboxPresent',v_outbox,
      'recoveryHeartbeatPresent',v_heartbeat,
      'reliabilitySnapshotPresent',v_recovery_rpc,
      'releaseRollbackContractPresent',v_release_rpc,
      'rolloutRollbackContractPresent',v_rollout_rpc,
      'deploymentReconciliationPresent',v_deployments,
      'adminSurfacesPrivate',v_private_tables and v_private_rpcs,
      'auditAppendOnly',v_audit_append_only and v_audit_sequence_private
    )
  end;
end
$$;

revoke all on function public.gomoku_p15_drill_checks(text) from public,anon,authenticated;
grant execute on function public.gomoku_p15_drill_checks(text) to service_role;

create or replace function public.gomoku_p15_write_drill(
  p_scenario text,
  p_mode text,
  p_actor_user_id uuid,
  p_actor_role text,
  p_health_status text,
  p_checks jsonb,
  p_operational_snapshot jsonb,
  p_request_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_pass boolean;
  v public.gomoku_incident_drill_runs%rowtype;
begin
  select coalesce(bool_and(value::text='true'),false)
  into v_pass
  from jsonb_each(p_checks);

  insert into public.gomoku_incident_drill_runs(
    scenario,mode,status,actor_user_id,actor_role,health_status,checks,
    operational_snapshot,summary,request_id,created_at
  ) values (
    p_scenario,p_mode,case when v_pass then 'passed' else 'failed' end,
    p_actor_user_id,p_actor_role,p_health_status,p_checks,
    coalesce(p_operational_snapshot,'{}'::jsonb),
    case when v_pass
      then 'All non-destructive incident drill checks passed.'
      else 'One or more incident drill checks failed.'
    end,
    p_request_id,now()
  )
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_p15_write_drill(text,text,uuid,text,text,jsonb,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p15_write_drill(text,text,uuid,text,text,jsonb,jsonb,text)
  to service_role;

create or replace function public.gomoku_admin_run_incident_drill(
  p_actor_user_id uuid,
  p_scenario text,
  p_health_status text,
  p_operational_snapshot jsonb,
  p_request_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_role text;
  v_checks jsonb;
  v_result jsonb;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['operator','incident_commander','release_manager','admin']::text[]
  );

  if p_scenario not in ('ranked_outage','persistence_degradation','bad_release','full') then
    raise exception 'Invalid drill scenario';
  end if;
  if p_health_status not in ('healthy','degraded','critical','maintenance','unknown') then
    raise exception 'Invalid health status';
  end if;

  v_checks:=public.gomoku_p15_drill_checks(p_scenario);
  v_result:=public.gomoku_p15_write_drill(
    p_scenario,'operator',p_actor_user_id,v_role,p_health_status,
    v_checks,coalesce(p_operational_snapshot,'{}'::jsonb),p_request_id
  );

  perform public.gomoku_admin_audit(
    p_actor_user_id,v_role,'incident_drill.executed','incident_drill',
    v_result->>'id','Non-destructive P15 incident drill',
    null,v_result,p_request_id
  );

  return v_result;
end
$$;

revoke all on function public.gomoku_admin_run_incident_drill(uuid,text,text,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_run_incident_drill(uuid,text,text,jsonb,text)
  to service_role;

create or replace function public.gomoku_p15_structural_certification(
  p_scenario text default 'full'
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_checks jsonb;
begin
  v_checks:=public.gomoku_p15_drill_checks(p_scenario);
  return public.gomoku_p15_write_drill(
    p_scenario,'structural',null,'system','unknown',v_checks,
    public.gomoku_public_operational_status(),null
  );
end
$$;

revoke all on function public.gomoku_p15_structural_certification(text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p15_structural_certification(text)
  to service_role;

comment on table public.gomoku_deployment_observations is
  'P15 append-only observations of deployed production artifacts. Observations reconcile governance records with what operators actually deployed.';
comment on table public.gomoku_rollouts is
  'P15 staged validation ledger. Stages are governance checkpoints, not weighted Edge Function traffic routing.';
comment on table public.gomoku_incident_drill_runs is
  'P15 append-only non-destructive incident drill evidence and structural certification results.';
comment on function public.gomoku_p15_reconciliation() is
  'P15 compares the current governed release/rollout with the latest observed production artifact.';
comment on function public.gomoku_p15_structural_certification(text) is
  'P15 service-only non-destructive certification of incident controls, recovery, rollback contracts and privilege boundaries.';
