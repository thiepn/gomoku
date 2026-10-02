-- P16 — Automated Release Admission, Deployment Orchestration & Continuous Production Certification
-- Keeps qualification, deployment, and production certification as separate evidence states.
-- GitHub Actions authenticates to the Edge control plane with short-lived OIDC tokens.

create table if not exists public.gomoku_release_evidence (
  id bigint generated always as identity primary key,
  git_sha text not null check (git_sha ~ '^[0-9a-f]{40}$'),
  check_name text not null check (check_name ~ '^[a-z0-9_.-]{2,64}$'),
  status text not null check (status in ('passed','failed')),
  source text not null default 'github_actions'
    check (source in ('github_actions','system_certification')),
  workflow_run_id text not null,
  workflow_attempt integer not null default 1 check (workflow_attempt >= 1),
  workflow_sha text check (workflow_sha is null or workflow_sha ~ '^[0-9a-f]{40}$'),
  workflow_ref text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  recorded_at timestamptz not null default now(),
  constraint gomoku_release_evidence_run_check
    check (char_length(workflow_run_id) between 1 and 96),
  constraint gomoku_release_evidence_ref_check
    check (workflow_ref is null or char_length(workflow_ref) <= 300)
);

create index if not exists gomoku_release_evidence_sha_check_idx
  on public.gomoku_release_evidence (git_sha,check_name,recorded_at desc);
create index if not exists gomoku_release_evidence_run_idx
  on public.gomoku_release_evidence (workflow_run_id,recorded_at desc);

create table if not exists public.gomoku_release_admissions (
  id uuid primary key default gen_random_uuid(),
  git_sha text not null check (git_sha ~ '^[0-9a-f]{40}$'),
  decision text not null check (decision in ('admitted','rejected')),
  policy_version text not null default 'p16.v1',
  required_checks jsonb not null check (jsonb_typeof(required_checks)='array'),
  evidence_snapshot jsonb not null check (jsonb_typeof(evidence_snapshot)='object'),
  workflow_run_id text not null,
  workflow_attempt integer not null default 1 check (workflow_attempt >= 1),
  workflow_sha text check (workflow_sha is null or workflow_sha ~ '^[0-9a-f]{40}$'),
  workflow_ref text,
  created_at timestamptz not null default now(),
  constraint gomoku_release_admissions_run_check
    check (char_length(workflow_run_id) between 1 and 96),
  constraint gomoku_release_admissions_ref_check
    check (workflow_ref is null or char_length(workflow_ref) <= 300),
  constraint gomoku_release_admissions_run_unique
    unique (git_sha,workflow_run_id,workflow_attempt)
);

create index if not exists gomoku_release_admissions_sha_idx
  on public.gomoku_release_admissions (git_sha,created_at desc);
create index if not exists gomoku_release_admissions_decision_idx
  on public.gomoku_release_admissions (decision,created_at desc);

create table if not exists public.gomoku_orchestration_events (
  id uuid primary key default gen_random_uuid(),
  git_sha text not null check (git_sha ~ '^[0-9a-f]{40}$'),
  stage text not null
    check (stage in ('qualification','schema','edge','pages','deployment','certification')),
  status text not null
    check (status in ('started','passed','blocked','failed','deployed','certified','superseded')),
  source_run_id text not null,
  workflow_sha text check (workflow_sha is null or workflow_sha ~ '^[0-9a-f]{40}$'),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now(),
  constraint gomoku_orchestration_events_run_check
    check (char_length(source_run_id) between 1 and 96)
);

create index if not exists gomoku_orchestration_events_sha_idx
  on public.gomoku_orchestration_events (git_sha,created_at desc);
create index if not exists gomoku_orchestration_events_stage_idx
  on public.gomoku_orchestration_events (stage,status,created_at desc);

create table if not exists public.gomoku_production_certifications (
  id uuid primary key default gen_random_uuid(),
  git_sha text not null check (git_sha ~ '^[0-9a-f]{40}$'),
  status text not null check (status in ('passed','failed')),
  policy_version text not null default 'p16.v1',
  health_status text not null
    check (health_status in ('healthy','degraded','critical','maintenance','unknown')),
  admission_id uuid references public.gomoku_release_admissions(id) on delete set null,
  deployment_observation_id bigint references public.gomoku_deployment_observations(id) on delete set null,
  checks jsonb not null check (jsonb_typeof(checks)='object'),
  operational_snapshot jsonb not null check (jsonb_typeof(operational_snapshot)='object'),
  reliability_snapshot jsonb not null check (jsonb_typeof(reliability_snapshot)='object'),
  source_run_id text not null,
  workflow_sha text check (workflow_sha is null or workflow_sha ~ '^[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  constraint gomoku_production_certifications_run_check
    check (char_length(source_run_id) between 1 and 96)
);

create index if not exists gomoku_production_certifications_sha_idx
  on public.gomoku_production_certifications (git_sha,created_at desc);
create index if not exists gomoku_production_certifications_status_idx
  on public.gomoku_production_certifications (status,created_at desc);

create table if not exists public.gomoku_automation_oidc_jti (
  jti text primary key,
  repository text not null,
  workflow_ref text not null,
  run_id text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now(),
  constraint gomoku_automation_oidc_jti_jti_check check (char_length(jti) between 8 and 200),
  constraint gomoku_automation_oidc_jti_repo_check check (char_length(repository) between 3 and 200),
  constraint gomoku_automation_oidc_jti_ref_check check (char_length(workflow_ref) between 3 and 300),
  constraint gomoku_automation_oidc_jti_run_check check (char_length(run_id) between 1 and 96)
);

create index if not exists gomoku_automation_oidc_jti_expires_idx
  on public.gomoku_automation_oidc_jti (expires_at);

alter table public.gomoku_release_evidence enable row level security;
alter table public.gomoku_release_admissions enable row level security;
alter table public.gomoku_orchestration_events enable row level security;
alter table public.gomoku_production_certifications enable row level security;
alter table public.gomoku_automation_oidc_jti enable row level security;

revoke all on table public.gomoku_release_evidence from public,anon,authenticated,service_role;
revoke all on table public.gomoku_release_admissions from public,anon,authenticated,service_role;
revoke all on table public.gomoku_orchestration_events from public,anon,authenticated,service_role;
revoke all on table public.gomoku_production_certifications from public,anon,authenticated,service_role;
revoke all on table public.gomoku_automation_oidc_jti from public,anon,authenticated,service_role;

grant select,insert on table public.gomoku_release_evidence to service_role;
grant select,insert on table public.gomoku_release_admissions to service_role;
grant select,insert on table public.gomoku_orchestration_events to service_role;
grant select,insert on table public.gomoku_production_certifications to service_role;
grant select,insert on table public.gomoku_automation_oidc_jti to service_role;

revoke all on sequence public.gomoku_release_evidence_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.gomoku_release_evidence_id_seq to service_role;

create or replace function public.gomoku_p16_required_checks()
returns text[]
language sql
immutable
security invoker
set search_path=''
as $$
  select array[
    'p16_contract',
    'p15_operations',
    'p14_governance',
    'p13_reliability',
    'ranked',
    'lifecycle',
    'history',
    'profiles',
    'integrity'
  ]::text[];
$$;

revoke all on function public.gomoku_p16_required_checks() from public,anon,authenticated;
grant execute on function public.gomoku_p16_required_checks() to service_role;

create or replace function public.gomoku_p16_consume_oidc_jti(
  p_jti text,
  p_repository text,
  p_workflow_ref text,
  p_run_id text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_count integer;
begin
  if char_length(btrim(coalesce(p_jti,''))) < 8 then
    raise exception 'Invalid OIDC token id';
  end if;
  if p_repository <> 'thiepn/gomoku' then
    raise exception 'Untrusted OIDC repository';
  end if;
  if p_workflow_ref not like 'thiepn/gomoku/.github/workflows/p16-release-control.yml@refs/heads/main' then
    raise exception 'Untrusted OIDC workflow';
  end if;
  if p_expires_at <= now()-interval '1 minute' or p_expires_at > now()+interval '15 minutes' then
    raise exception 'Invalid OIDC expiry';
  end if;

  insert into public.gomoku_automation_oidc_jti(jti,repository,workflow_ref,run_id,expires_at,consumed_at)
  values (
    left(btrim(p_jti),200),
    p_repository,
    left(p_workflow_ref,300),
    left(btrim(p_run_id),96),
    p_expires_at,
    now()
  )
  on conflict (jti) do nothing;

  get diagnostics v_count = row_count;
  return v_count=1;
end
$$;

revoke all on function public.gomoku_p16_consume_oidc_jti(text,text,text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.gomoku_p16_consume_oidc_jti(text,text,text,text,timestamptz)
  to service_role;

create or replace function public.gomoku_p16_latest_admission(p_git_sha text)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v public.gomoku_release_admissions%rowtype;
begin
  if lower(coalesce(p_git_sha,'')) !~ '^[0-9a-f]{40}$' then
    return null;
  end if;

  select * into v
  from public.gomoku_release_admissions
  where git_sha=lower(p_git_sha)
  order by created_at desc
  limit 1;

  if v.id is null then return null; end if;

  return jsonb_build_object(
    'id',v.id,
    'gitSha',v.git_sha,
    'decision',v.decision,
    'policyVersion',v.policy_version,
    'requiredChecks',v.required_checks,
    'evidence',v.evidence_snapshot,
    'workflowRunId',v.workflow_run_id,
    'workflowAttempt',v.workflow_attempt,
    'workflowSha',v.workflow_sha,
    'workflowRef',v.workflow_ref,
    'createdAt',v.created_at
  );
end
$$;

revoke all on function public.gomoku_p16_latest_admission(text) from public,anon,authenticated;
grant execute on function public.gomoku_p16_latest_admission(text) to service_role;

create or replace function public.gomoku_p16_record_qualification(
  p_git_sha text,
  p_checks jsonb,
  p_workflow_run_id text,
  p_workflow_attempt integer,
  p_workflow_sha text,
  p_workflow_ref text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_git_sha text:=lower(coalesce(p_git_sha,''));
  v_required text[]:=public.gomoku_p16_required_checks();
  v_check text;
  v_item jsonb;
  v_status text;
  v_snapshot jsonb:='{}'::jsonb;
  v_required_json jsonb;
  v_all_passed boolean:=true;
  v_existing public.gomoku_release_admissions%rowtype;
  v_admission public.gomoku_release_admissions%rowtype;
begin
  if v_git_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid qualification git sha';
  end if;
  if jsonb_typeof(p_checks) <> 'object' then
    raise exception 'Qualification checks must be an object';
  end if;
  if char_length(btrim(coalesce(p_workflow_run_id,''))) < 1 then
    raise exception 'Workflow run id is required';
  end if;
  if coalesce(p_workflow_attempt,0) < 1 then
    raise exception 'Workflow attempt must be positive';
  end if;
  if p_workflow_sha is not null and lower(p_workflow_sha) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid workflow sha';
  end if;

  select * into v_existing
  from public.gomoku_release_admissions
  where git_sha=v_git_sha
    and workflow_run_id=p_workflow_run_id
    and workflow_attempt=p_workflow_attempt
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'admission',to_jsonb(v_existing),
      'idempotent',true
    );
  end if;

  foreach v_check in array v_required loop
    v_item:=coalesce(p_checks->v_check,'{}'::jsonb);
    v_status:=case lower(coalesce(v_item->>'status',''))
      when 'passed' then 'passed'
      else 'failed'
    end;

    if v_status <> 'passed' then
      v_all_passed:=false;
    end if;

    insert into public.gomoku_release_evidence(
      git_sha,check_name,status,source,workflow_run_id,workflow_attempt,
      workflow_sha,workflow_ref,details,recorded_at
    ) values (
      v_git_sha,v_check,v_status,'github_actions',
      left(btrim(p_workflow_run_id),96),p_workflow_attempt,
      case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
      nullif(left(btrim(coalesce(p_workflow_ref,'')),300),''),
      case when jsonb_typeof(v_item)='object' then v_item else '{}'::jsonb end,
      now()
    );

    v_snapshot:=v_snapshot||jsonb_build_object(
      v_check,
      jsonb_build_object(
        'status',v_status,
        'details',case when jsonb_typeof(v_item)='object' then v_item else '{}'::jsonb end
      )
    );
  end loop;

  select jsonb_agg(x) into v_required_json
  from unnest(v_required) x;

  insert into public.gomoku_release_admissions(
    git_sha,decision,policy_version,required_checks,evidence_snapshot,
    workflow_run_id,workflow_attempt,workflow_sha,workflow_ref,created_at
  ) values (
    v_git_sha,
    case when v_all_passed then 'admitted' else 'rejected' end,
    'p16.v1',
    coalesce(v_required_json,'[]'::jsonb),
    v_snapshot,
    left(btrim(p_workflow_run_id),96),
    p_workflow_attempt,
    case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
    nullif(left(btrim(coalesce(p_workflow_ref,'')),300),''),
    now()
  )
  returning * into v_admission;

  insert into public.gomoku_orchestration_events(
    git_sha,stage,status,source_run_id,workflow_sha,details,created_at
  ) values (
    v_git_sha,'qualification',
    case when v_all_passed then 'passed' else 'failed' end,
    left(btrim(p_workflow_run_id),96),
    case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
    jsonb_build_object('admissionId',v_admission.id,'decision',v_admission.decision),
    now()
  );

  return jsonb_build_object(
    'admission',to_jsonb(v_admission),
    'idempotent',false
  );
end
$$;

revoke all on function public.gomoku_p16_record_qualification(text,jsonb,text,integer,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p16_record_qualification(text,jsonb,text,integer,text,text)
  to service_role;

create or replace function public.gomoku_p16_record_orchestration(
  p_git_sha text,
  p_stage text,
  p_status text,
  p_source_run_id text,
  p_workflow_sha text default null,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v public.gomoku_orchestration_events%rowtype;
begin
  if lower(coalesce(p_git_sha,'')) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid orchestration git sha';
  end if;
  if p_stage not in ('qualification','schema','edge','pages','deployment','certification') then
    raise exception 'Invalid orchestration stage';
  end if;
  if p_status not in ('started','passed','blocked','failed','deployed','certified','superseded') then
    raise exception 'Invalid orchestration status';
  end if;
  if jsonb_typeof(coalesce(p_details,'{}'::jsonb)) <> 'object' then
    raise exception 'Orchestration details must be an object';
  end if;

  insert into public.gomoku_orchestration_events(
    git_sha,stage,status,source_run_id,workflow_sha,details,created_at
  ) values (
    lower(p_git_sha),p_stage,p_status,left(btrim(p_source_run_id),96),
    case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
    coalesce(p_details,'{}'::jsonb),now()
  )
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_p16_record_orchestration(text,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.gomoku_p16_record_orchestration(text,text,text,text,text,jsonb)
  to service_role;

create or replace function public.gomoku_p16_record_deployment(
  p_git_sha text,
  p_edge_function_version integer,
  p_edge_bundle_sha256 text,
  p_frontend_sha text,
  p_source_run_id text,
  p_workflow_sha text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_git_sha text:=lower(coalesce(p_git_sha,''));
  v_admission public.gomoku_release_admissions%rowtype;
  v_release_id uuid;
  v_observation public.gomoku_deployment_observations%rowtype;
begin
  if v_git_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid deployment git sha';
  end if;

  select * into v_admission
  from public.gomoku_release_admissions
  where git_sha=v_git_sha
  order by created_at desc
  limit 1;

  if v_admission.id is null or v_admission.decision <> 'admitted' then
    raise exception 'Deployment observation requires an admitted release';
  end if;

  if p_edge_function_version is not null and p_edge_function_version < 1 then
    raise exception 'Invalid Edge Function version';
  end if;
  if p_edge_bundle_sha256 is not null and lower(p_edge_bundle_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid Edge bundle sha256';
  end if;
  if p_frontend_sha is not null and lower(p_frontend_sha) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid frontend sha';
  end if;

  select id into v_release_id
  from public.gomoku_release_registry
  where git_sha=v_git_sha
  limit 1;

  insert into public.gomoku_deployment_observations(
    release_id,environment,git_sha,edge_function_version,edge_bundle_sha256,
    frontend_sha,source,notes,observed_by,observed_at
  ) values (
    v_release_id,'production',v_git_sha,p_edge_function_version,
    case when p_edge_bundle_sha256 is null then null else lower(p_edge_bundle_sha256) end,
    case when p_frontend_sha is null then null else lower(p_frontend_sha) end,
    'github_action',
    nullif(left(btrim(coalesce(p_notes,'')),800),''),
    null,now()
  )
  returning * into v_observation;

  insert into public.gomoku_orchestration_events(
    git_sha,stage,status,source_run_id,workflow_sha,details,created_at
  ) values (
    v_git_sha,'deployment','deployed',left(btrim(p_source_run_id),96),
    case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
    jsonb_build_object(
      'deploymentObservationId',v_observation.id,
      'edgeFunctionVersion',v_observation.edge_function_version,
      'frontendSha',v_observation.frontend_sha
    ),
    now()
  );

  return jsonb_build_object(
    'deployment',to_jsonb(v_observation),
    'admission',public.gomoku_p16_latest_admission(v_git_sha),
    'reconciliation',public.gomoku_p15_reconciliation()
  );
end
$$;

revoke all on function public.gomoku_p16_record_deployment(text,integer,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p16_record_deployment(text,integer,text,text,text,text,text)
  to service_role;

create or replace function public.gomoku_p16_certify_production(
  p_build_git_sha text,
  p_source_run_id text,
  p_workflow_sha text default null
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_git_sha text:=lower(coalesce(p_build_git_sha,''));
  v_admission public.gomoku_release_admissions%rowtype;
  v_deployment public.gomoku_deployment_observations%rowtype;
  v_latest_deployment public.gomoku_deployment_observations%rowtype;
  v_operations jsonb;
  v_reliability jsonb;
  v_structural jsonb;
  v_health text;
  v_structural_pass boolean;
  v_checks jsonb;
  v_pass boolean;
  v_cert public.gomoku_production_certifications%rowtype;
begin
  if v_git_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'Runtime build is not traceable to an immutable Git SHA';
  end if;

  select * into v_admission
  from public.gomoku_release_admissions
  where git_sha=v_git_sha
  order by created_at desc
  limit 1;

  select * into v_deployment
  from public.gomoku_deployment_observations
  where environment='production' and git_sha=v_git_sha
  order by observed_at desc
  limit 1;

  select * into v_latest_deployment
  from public.gomoku_deployment_observations
  where environment='production'
  order by observed_at desc
  limit 1;

  v_operations:=public.gomoku_public_operational_status();
  v_reliability:=public.gomoku_reliability_snapshot();
  v_structural:=public.gomoku_p15_drill_checks('full');

  v_health:=case
    when coalesce(v_operations->>'serviceMode','normal')='maintenance' then 'maintenance'
    when coalesce(v_reliability->>'status','unknown') in ('healthy','degraded','critical') then v_reliability->>'status'
    else 'unknown'
  end;

  select coalesce(bool_and(value::text='true'),false)
  into v_structural_pass
  from jsonb_each(v_structural);

  v_checks:=jsonb_build_object(
    'buildTraceable',v_git_sha ~ '^[0-9a-f]{40}$',
    'latestAdmissionPassed',v_admission.id is not null and v_admission.decision='admitted',
    'matchingDeploymentObserved',v_deployment.id is not null,
    'latestDeploymentMatchesBuild',v_latest_deployment.id is not null and v_latest_deployment.git_sha=v_git_sha,
    'healthHealthy',v_health='healthy',
    'serviceModeNormal',coalesce(v_operations->>'serviceMode','normal')='normal',
    'noActiveIncident',v_operations->'incident' is null,
    'structuralControlsPassed',v_structural_pass
  );

  select coalesce(bool_and(value::text='true'),false)
  into v_pass
  from jsonb_each(v_checks);

  insert into public.gomoku_production_certifications(
    git_sha,status,policy_version,health_status,admission_id,deployment_observation_id,
    checks,operational_snapshot,reliability_snapshot,source_run_id,workflow_sha,created_at
  ) values (
    v_git_sha,case when v_pass then 'passed' else 'failed' end,'p16.v1',v_health,
    v_admission.id,v_deployment.id,v_checks,v_operations,v_reliability,
    left(btrim(p_source_run_id),96),
    case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
    now()
  )
  returning * into v_cert;

  insert into public.gomoku_orchestration_events(
    git_sha,stage,status,source_run_id,workflow_sha,details,created_at
  ) values (
    v_git_sha,'certification',case when v_pass then 'certified' else 'failed' end,
    left(btrim(p_source_run_id),96),
    case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
    jsonb_build_object('certificationId',v_cert.id,'checks',v_checks),
    now()
  );

  return jsonb_build_object(
    'certification',to_jsonb(v_cert),
    'structuralChecks',v_structural
  );
end
$$;

revoke all on function public.gomoku_p16_certify_production(text,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p16_certify_production(text,text,text)
  to service_role;

create or replace function public.gomoku_p16_public_status()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_cert public.gomoku_production_certifications%rowtype;
  v_deployment public.gomoku_deployment_observations%rowtype;
  v_admission public.gomoku_release_admissions%rowtype;
  v_drift text;
begin
  select * into v_cert
  from public.gomoku_production_certifications
  order by created_at desc
  limit 1;

  select * into v_deployment
  from public.gomoku_deployment_observations
  where environment='production'
  order by observed_at desc
  limit 1;

  if v_deployment.id is not null then
    select * into v_admission
    from public.gomoku_release_admissions
    where git_sha=v_deployment.git_sha
    order by created_at desc
    limit 1;
  end if;

  v_drift:=case
    when v_deployment.id is null then 'unobserved'
    when v_admission.id is null then 'unadmitted_deployment'
    when v_admission.decision <> 'admitted' then 'admission_revoked'
    when v_cert.id is null then 'uncertified'
    when v_cert.git_sha <> v_deployment.git_sha then 'certification_drift'
    when v_cert.status <> 'passed' then 'certification_failed'
    else 'aligned'
  end;

  return jsonb_build_object(
    'driftState',v_drift,
    'deployment',case when v_deployment.id is null then null else jsonb_build_object(
      'gitSha',v_deployment.git_sha,
      'edgeFunctionVersion',v_deployment.edge_function_version,
      'frontendSha',v_deployment.frontend_sha,
      'observedAt',v_deployment.observed_at
    ) end,
    'admission',case when v_admission.id is null then null else jsonb_build_object(
      'id',v_admission.id,
      'decision',v_admission.decision,
      'gitSha',v_admission.git_sha,
      'policyVersion',v_admission.policy_version,
      'createdAt',v_admission.created_at
    ) end,
    'certification',case when v_cert.id is null then null else jsonb_build_object(
      'id',v_cert.id,
      'status',v_cert.status,
      'gitSha',v_cert.git_sha,
      'healthStatus',v_cert.health_status,
      'policyVersion',v_cert.policy_version,
      'checks',v_cert.checks,
      'certifiedAt',v_cert.created_at
    ) end
  );
end
$$;

revoke all on function public.gomoku_p16_public_status() from public,anon,authenticated;
grant execute on function public.gomoku_p16_public_status() to service_role;

create or replace function public.gomoku_p16_admin_summary(p_actor_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_role text;
  v_admissions jsonb;
  v_certs jsonb;
  v_events jsonb;
begin
  v_role:=public.gomoku_admin_assert_operator(p_actor_user_id,null);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_admissions
  from (
    select id,git_sha,decision,policy_version,required_checks,evidence_snapshot,
           workflow_run_id,workflow_attempt,workflow_sha,created_at
    from public.gomoku_release_admissions
    order by created_at desc
    limit 20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_certs
  from (
    select id,git_sha,status,policy_version,health_status,admission_id,
           deployment_observation_id,checks,source_run_id,workflow_sha,created_at
    from public.gomoku_production_certifications
    order by created_at desc
    limit 20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_events
  from (
    select id,git_sha,stage,status,source_run_id,workflow_sha,details,created_at
    from public.gomoku_orchestration_events
    order by created_at desc
    limit 40
  ) x;

  return jsonb_build_object(
    'operatorRole',v_role,
    'publicStatus',public.gomoku_p16_public_status(),
    'admissions',v_admissions,
    'certifications',v_certs,
    'orchestration',v_events,
    'generatedAt',now()
  );
end
$$;

revoke all on function public.gomoku_p16_admin_summary(uuid) from public,anon,authenticated;
grant execute on function public.gomoku_p16_admin_summary(uuid) to service_role;

-- P16 admission gates are layered onto the P14 human release transition.
create or replace function public.gomoku_admin_transition_release(
  p_actor_user_id uuid,
  p_release_id uuid,
  p_action text,
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
  v_before public.gomoku_release_registry%rowtype;
  v_after public.gomoku_release_registry%rowtype;
  v_current public.gomoku_release_registry%rowtype;
  v_target public.gomoku_release_registry%rowtype;
  v_admission public.gomoku_release_admissions%rowtype;
  v_cert public.gomoku_production_certifications%rowtype;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['release_manager','admin']::text[]
  );

  if p_action not in ('approve','activate','rollback') then
    raise exception 'Invalid release transition';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'Release transitions require a reason';
  end if;

  select * into v_before
  from public.gomoku_release_registry
  where id=p_release_id
  for update;

  if v_before.id is null then
    raise exception 'Release not found';
  end if;

  if p_action='approve' then
    if v_before.status <> 'candidate' then
      raise exception 'Only candidate releases can be approved';
    end if;

    select * into v_admission
    from public.gomoku_release_admissions
    where git_sha=v_before.git_sha
    order by created_at desc
    limit 1;

    if v_admission.id is null or v_admission.decision <> 'admitted' then
      raise exception 'Release approval requires a passing P16 automated admission';
    end if;

    update public.gomoku_release_registry
    set status='approved',
        approved_by=p_actor_user_id,
        approved_at=now(),
        updated_at=now()
    where id=p_release_id
    returning * into v_after;

  elsif p_action='activate' then
    if v_before.status <> 'approved' then
      raise exception 'Only approved releases can be activated';
    end if;

    select * into v_cert
    from public.gomoku_production_certifications
    where git_sha=v_before.git_sha
    order by created_at desc
    limit 1;

    if v_cert.id is null or v_cert.status <> 'passed' then
      raise exception 'Release activation requires a passing P16 production certification';
    end if;

    select * into v_current
    from public.gomoku_release_registry
    where status='active'
    for update;

    if v_current.id is not null then
      update public.gomoku_release_registry
      set status='retired',updated_at=now()
      where id=v_current.id;
    end if;

    update public.gomoku_release_registry
    set status='active',
        previous_release_id=v_current.id,
        activated_by=p_actor_user_id,
        activated_at=now(),
        rolled_back_by=null,
        rolled_back_at=null,
        updated_at=now()
    where id=p_release_id
    returning * into v_after;

  else
    if v_before.status <> 'active' then
      raise exception 'Only the active release can be rolled back';
    end if;
    if p_target_release_id is null then
      raise exception 'Rollback requires a target release';
    end if;

    select * into v_target
    from public.gomoku_release_registry
    where id=p_target_release_id
    for update;

    if v_target.id is null then
      raise exception 'Rollback target release not found';
    end if;
    if v_target.status not in ('approved','retired','rolled_back') then
      raise exception 'Rollback target is not eligible for activation';
    end if;

    update public.gomoku_release_registry
    set status='rolled_back',
        rolled_back_by=p_actor_user_id,
        rolled_back_at=now(),
        updated_at=now()
    where id=p_release_id;

    update public.gomoku_release_registry
    set status='active',
        activated_by=p_actor_user_id,
        activated_at=now(),
        updated_at=now()
    where id=p_target_release_id
    returning * into v_after;
  end if;

  perform public.gomoku_admin_audit(
    p_actor_user_id,v_role,'release.'||p_action,'release',p_release_id::text,
    p_reason,to_jsonb(v_before),to_jsonb(v_after),p_request_id
  );

  return to_jsonb(v_after);
end
$$;

revoke all on function public.gomoku_admin_transition_release(uuid,uuid,text,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_transition_release(uuid,uuid,text,uuid,text,text)
  to service_role;

-- P16 also prevents rollout creation for a release that has not passed automated admission.
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
  v_admission public.gomoku_release_admissions%rowtype;
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

  select * into v_admission
  from public.gomoku_release_admissions
  where git_sha=v_release.git_sha
  order by created_at desc
  limit 1;

  if v_admission.id is null or v_admission.decision <> 'admitted' then
    raise exception 'Rollout creation requires a passing P16 automated admission';
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

comment on table public.gomoku_release_evidence is
  'P16 append-only CI evidence used to evaluate immutable release candidates.';
comment on table public.gomoku_release_admissions is
  'P16 append-only automated admission decisions. Admission qualifies a SHA; it does not deploy or activate it.';
comment on table public.gomoku_orchestration_events is
  'P16 append-only deployment orchestration ledger across qualification, schema, Edge, Pages, deployment, and certification stages.';
comment on table public.gomoku_production_certifications is
  'P16 append-only post-deploy production certification evidence for an exact runtime build SHA.';
comment on table public.gomoku_automation_oidc_jti is
  'P16 replay-prevention ledger for short-lived GitHub Actions OIDC identities.';
