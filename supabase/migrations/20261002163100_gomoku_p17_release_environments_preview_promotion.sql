-- P17 — Release Environments, Preview Certification & Safe Schema Promotion
-- Establishes environment identity, preview certification evidence, repository-schema
-- state, promotion authorization, and immutable promotion events.
--
-- P17 never assumes that the shared THIEPN Account Supabase migration ledger is
-- owned solely by this repository. Gomoku therefore tracks a repo-scoped schema
-- manifest in addition to Supabase's project-wide migration history.

create table if not exists public.gomoku_release_environments (
  id uuid primary key default gen_random_uuid(),
  environment text not null unique
    check (environment in ('preview','staging')),
  project_ref text not null
    check (project_ref ~ '^[a-z0-9]{20}$'),
  branch_id uuid,
  branch_name text,
  branch_status text not null
    check (branch_status in ('provisioning','ready','degraded','failed','paused','unknown')),
  required_for_promotion boolean not null default true,
  production_project_ref text not null default 'hycegznamzjhwinegaai'
    check (production_project_ref ~ '^[a-z0-9]{20}$'),
  source text not null default 'supabase_branch'
    check (source in ('supabase_branch','dedicated_project')),
  configured_by_run_id text,
  configured_at timestamptz not null default now(),
  last_rebased_at timestamptz,
  last_certified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint gomoku_release_environments_distinct_project
    check (project_ref <> production_project_ref),
  constraint gomoku_release_environments_branch_name_check
    check (branch_name is null or char_length(branch_name) between 1 and 120),
  constraint gomoku_release_environments_run_check
    check (configured_by_run_id is null or char_length(configured_by_run_id) between 1 and 96)
);

create table if not exists public.gomoku_repo_schema_state (
  id smallint primary key check (id=1),
  environment_label text not null
    check (environment_label in ('production','preview','staging','unconfigured')),
  schema_manifest_sha256 text,
  edge_manifest_sha256 text,
  release_manifest_sha256 text,
  source_git_sha text,
  migration_count integer not null default 0 check (migration_count >= 0),
  migration_head text,
  recorded_by_run_id text,
  recorded_at timestamptz not null default now(),
  constraint gomoku_repo_schema_state_schema_hash
    check (schema_manifest_sha256 is null or schema_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  constraint gomoku_repo_schema_state_edge_hash
    check (edge_manifest_sha256 is null or edge_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  constraint gomoku_repo_schema_state_release_hash
    check (release_manifest_sha256 is null or release_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  constraint gomoku_repo_schema_state_git_sha
    check (source_git_sha is null or source_git_sha ~ '^[0-9a-f]{40}$'),
  constraint gomoku_repo_schema_state_head
    check (migration_head is null or char_length(migration_head) <= 220),
  constraint gomoku_repo_schema_state_run
    check (recorded_by_run_id is null or char_length(recorded_by_run_id) <= 96)
);

insert into public.gomoku_repo_schema_state(
  id,environment_label,migration_count,recorded_at
) values (1,'unconfigured',0,now())
on conflict (id) do nothing;

create table if not exists public.gomoku_repo_migration_events (
  id bigint generated always as identity primary key,
  environment_label text not null
    check (environment_label in ('production','preview','staging')),
  source_git_sha text not null check (source_git_sha ~ '^[0-9a-f]{40}$'),
  migration_name text not null check (char_length(migration_name) between 1 and 220),
  migration_sha256 text not null check (migration_sha256 ~ '^[0-9a-f]{64}$'),
  release_manifest_sha256 text not null check (release_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  result text not null check (result in ('applied','verified','failed','baseline_attested')),
  source_run_id text not null check (char_length(source_run_id) between 1 and 96),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  created_at timestamptz not null default now()
);

create index if not exists gomoku_repo_migration_events_env_idx
  on public.gomoku_repo_migration_events(environment_label,created_at desc);
create index if not exists gomoku_repo_migration_events_sha_idx
  on public.gomoku_repo_migration_events(source_git_sha,created_at desc);

create table if not exists public.gomoku_preview_certifications (
  id uuid primary key default gen_random_uuid(),
  source_git_sha text not null check (source_git_sha ~ '^[0-9a-f]{40}$'),
  source_ref text,
  environment_id uuid references public.gomoku_release_environments(id) on delete set null,
  environment text not null check (environment in ('preview','staging')),
  project_ref text not null check (project_ref ~ '^[a-z0-9]{20}$'),
  branch_id uuid,
  branch_status text not null
    check (branch_status in ('ready','degraded','failed','paused','unknown')),
  schema_manifest_sha256 text not null check (schema_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  edge_manifest_sha256 text not null check (edge_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  release_manifest_sha256 text not null check (release_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  edge_build_sha text not null check (edge_build_sha ~ '^[0-9a-f]{40}$'),
  migration_count integer not null check (migration_count >= 0),
  migration_head text,
  checks jsonb not null check (jsonb_typeof(checks)='object'),
  status text not null check (status in ('passed','failed')),
  source_run_id text not null check (char_length(source_run_id) between 1 and 96),
  workflow_sha text check (workflow_sha is null or workflow_sha ~ '^[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  constraint gomoku_preview_certifications_source_ref
    check (source_ref is null or char_length(source_ref) <= 300),
  constraint gomoku_preview_certifications_head
    check (migration_head is null or char_length(migration_head) <= 220)
);

create index if not exists gomoku_preview_certifications_manifest_idx
  on public.gomoku_preview_certifications(release_manifest_sha256,created_at desc);
create index if not exists gomoku_preview_certifications_source_idx
  on public.gomoku_preview_certifications(source_git_sha,created_at desc);

create table if not exists public.gomoku_schema_promotion_authorizations (
  id uuid primary key default gen_random_uuid(),
  production_git_sha text not null check (production_git_sha ~ '^[0-9a-f]{40}$'),
  schema_manifest_sha256 text not null check (schema_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  edge_manifest_sha256 text not null check (edge_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  release_manifest_sha256 text not null check (release_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  preview_certification_id uuid references public.gomoku_preview_certifications(id) on delete restrict,
  decision text not null check (decision in ('authorized','rejected')),
  reason text,
  source_run_id text not null check (char_length(source_run_id) between 1 and 96),
  workflow_sha text check (workflow_sha is null or workflow_sha ~ '^[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint gomoku_schema_promotion_authorizations_reason
    check (reason is null or char_length(reason) <= 800),
  constraint gomoku_schema_promotion_authorizations_expiry
    check (expires_at > created_at)
);

create index if not exists gomoku_schema_promotion_authorizations_sha_idx
  on public.gomoku_schema_promotion_authorizations(production_git_sha,created_at desc);
create index if not exists gomoku_schema_promotion_authorizations_manifest_idx
  on public.gomoku_schema_promotion_authorizations(release_manifest_sha256,created_at desc);

create table if not exists public.gomoku_schema_promotion_events (
  id bigint generated always as identity primary key,
  authorization_id uuid references public.gomoku_schema_promotion_authorizations(id) on delete restrict,
  production_git_sha text not null check (production_git_sha ~ '^[0-9a-f]{40}$'),
  event_type text not null
    check (event_type in ('started','applied','verified','failed','rollback_rehearsed')),
  production_migration_head text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  source_run_id text not null check (char_length(source_run_id) between 1 and 96),
  workflow_sha text check (workflow_sha is null or workflow_sha ~ '^[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  constraint gomoku_schema_promotion_events_head
    check (production_migration_head is null or char_length(production_migration_head) <= 220)
);

create unique index if not exists gomoku_schema_promotion_started_once
  on public.gomoku_schema_promotion_events(authorization_id)
  where event_type='started';
create index if not exists gomoku_schema_promotion_events_sha_idx
  on public.gomoku_schema_promotion_events(production_git_sha,created_at desc);

alter table public.gomoku_release_environments enable row level security;
alter table public.gomoku_repo_schema_state enable row level security;
alter table public.gomoku_repo_migration_events enable row level security;
alter table public.gomoku_preview_certifications enable row level security;
alter table public.gomoku_schema_promotion_authorizations enable row level security;
alter table public.gomoku_schema_promotion_events enable row level security;

revoke all on table public.gomoku_release_environments from public,anon,authenticated,service_role;
revoke all on table public.gomoku_repo_schema_state from public,anon,authenticated,service_role;
revoke all on table public.gomoku_repo_migration_events from public,anon,authenticated,service_role;
revoke all on table public.gomoku_preview_certifications from public,anon,authenticated,service_role;
revoke all on table public.gomoku_schema_promotion_authorizations from public,anon,authenticated,service_role;
revoke all on table public.gomoku_schema_promotion_events from public,anon,authenticated,service_role;

grant select,insert,update on table public.gomoku_release_environments to service_role;
grant select,insert,update on table public.gomoku_repo_schema_state to service_role;
grant select,insert on table public.gomoku_repo_migration_events to service_role;
grant select,insert on table public.gomoku_preview_certifications to service_role;
grant select,insert on table public.gomoku_schema_promotion_authorizations to service_role;
grant select,insert on table public.gomoku_schema_promotion_events to service_role;

revoke all on sequence public.gomoku_repo_migration_events_id_seq
  from public,anon,authenticated,service_role;
revoke all on sequence public.gomoku_schema_promotion_events_id_seq
  from public,anon,authenticated,service_role;
grant usage,select on sequence public.gomoku_repo_migration_events_id_seq to service_role;
grant usage,select on sequence public.gomoku_schema_promotion_events_id_seq to service_role;

-- Extend the P16 OIDC replay ledger to the P17 main-branch release workflow
-- without broadening trust to arbitrary workflows or refs.
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
as $
declare
  v_count integer;
begin
  if char_length(btrim(coalesce(p_jti,''))) < 8 then
    raise exception 'Invalid OIDC token id';
  end if;
  if p_repository <> 'thiepn/gomoku' then
    raise exception 'Untrusted OIDC repository';
  end if;
  if p_workflow_ref not in (
    'thiepn/gomoku/.github/workflows/p16-release-control.yml@refs/heads/main',
    'thiepn/gomoku/.github/workflows/p17-preview-promotion.yml@refs/heads/main'
  ) then
    raise exception 'Untrusted OIDC workflow';
  end if;
  if p_expires_at <= now()-interval '1 minute' or p_expires_at > now()+interval '15 minutes' then
    raise exception 'Invalid OIDC expiry';
  end if;

  insert into public.gomoku_automation_oidc_jti(
    jti,repository,workflow_ref,run_id,expires_at,consumed_at
  ) values (
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
$;

revoke all on function public.gomoku_p16_consume_oidc_jti(text,text,text,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.gomoku_p16_consume_oidc_jti(text,text,text,text,timestamptz)
  to service_role;

create or replace function public.gomoku_p17_required_preview_checks()
returns text[]
language sql
immutable
security invoker
set search_path=''
as $$
  select array[
    'branchHealthy',
    'migrationReplayPassed',
    'migrationHistoryAligned',
    'schemaContractsPassed',
    'edgeBuildMatches',
    'edgeHealthHealthy',
    'runtimeIsPreview',
    'isolationConfirmed',
    'rollbackRehearsalPassed'
  ]::text[];
$$;

revoke all on function public.gomoku_p17_required_preview_checks()
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_required_preview_checks()
  to service_role;

create or replace function public.gomoku_p17_environment_probe()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_state public.gomoku_repo_schema_state%rowtype;
  v_structural jsonb;
  v_structural_pass boolean;
  v_private boolean;
begin
  select * into v_state from public.gomoku_repo_schema_state where id=1;

  v_structural:=public.gomoku_p15_drill_checks('full');
  select coalesce(bool_and(value::text='true'),false)
  into v_structural_pass
  from jsonb_each(v_structural);

  v_private:=
    not has_table_privilege('anon','public.gomoku_release_environments','SELECT')
    and not has_table_privilege('authenticated','public.gomoku_release_environments','SELECT')
    and not has_table_privilege('anon','public.gomoku_preview_certifications','SELECT')
    and not has_table_privilege('authenticated','public.gomoku_preview_certifications','SELECT')
    and not has_table_privilege('anon','public.gomoku_schema_promotion_authorizations','SELECT')
    and not has_table_privilege('authenticated','public.gomoku_schema_promotion_authorizations','SELECT');

  return jsonb_build_object(
    'schemaState',case when v_state.id is null then null else jsonb_build_object(
      'environmentLabel',v_state.environment_label,
      'schemaManifestSha256',v_state.schema_manifest_sha256,
      'edgeManifestSha256',v_state.edge_manifest_sha256,
      'releaseManifestSha256',v_state.release_manifest_sha256,
      'sourceGitSha',v_state.source_git_sha,
      'migrationCount',v_state.migration_count,
      'migrationHead',v_state.migration_head,
      'recordedAt',v_state.recorded_at
    ) end,
    'checks',jsonb_build_object(
      'p16ReleaseControlPresent',to_regclass('public.gomoku_release_admissions') is not null,
      'p15StructuralPassed',v_structural_pass,
      'p17TablesPresent',
        to_regclass('public.gomoku_release_environments') is not null
        and to_regclass('public.gomoku_preview_certifications') is not null
        and to_regclass('public.gomoku_schema_promotion_authorizations') is not null,
      'controlTablesPrivate',v_private
    ),
    'generatedAt',now()
  );
end
$$;

revoke all on function public.gomoku_p17_environment_probe()
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_environment_probe()
  to service_role;

create or replace function public.gomoku_p17_set_local_schema_state(
  p_environment_label text,
  p_schema_manifest_sha256 text,
  p_edge_manifest_sha256 text,
  p_release_manifest_sha256 text,
  p_source_git_sha text,
  p_migration_count integer,
  p_migration_head text,
  p_source_run_id text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v public.gomoku_repo_schema_state%rowtype;
begin
  if p_environment_label not in ('production','preview','staging') then
    raise exception 'Invalid environment label';
  end if;
  if lower(coalesce(p_schema_manifest_sha256,'')) !~ '^[0-9a-f]{64}$'
    or lower(coalesce(p_edge_manifest_sha256,'')) !~ '^[0-9a-f]{64}$'
    or lower(coalesce(p_release_manifest_sha256,'')) !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid release manifest hash';
  end if;
  if lower(coalesce(p_source_git_sha,'')) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid schema state Git SHA';
  end if;
  if coalesce(p_migration_count,-1) < 0 then
    raise exception 'Invalid migration count';
  end if;

  insert into public.gomoku_repo_schema_state(
    id,environment_label,schema_manifest_sha256,edge_manifest_sha256,
    release_manifest_sha256,source_git_sha,migration_count,migration_head,
    recorded_by_run_id,recorded_at
  ) values (
    1,p_environment_label,lower(p_schema_manifest_sha256),lower(p_edge_manifest_sha256),
    lower(p_release_manifest_sha256),lower(p_source_git_sha),p_migration_count,
    nullif(left(btrim(coalesce(p_migration_head,'')),220),''),
    nullif(left(btrim(coalesce(p_source_run_id,'')),96),''),
    now()
  )
  on conflict (id) do update set
    environment_label=excluded.environment_label,
    schema_manifest_sha256=excluded.schema_manifest_sha256,
    edge_manifest_sha256=excluded.edge_manifest_sha256,
    release_manifest_sha256=excluded.release_manifest_sha256,
    source_git_sha=excluded.source_git_sha,
    migration_count=excluded.migration_count,
    migration_head=excluded.migration_head,
    recorded_by_run_id=excluded.recorded_by_run_id,
    recorded_at=excluded.recorded_at
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_p17_set_local_schema_state(text,text,text,text,text,integer,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_set_local_schema_state(text,text,text,text,text,integer,text,text)
  to service_role;

create or replace function public.gomoku_p17_record_migration_event(
  p_environment_label text,
  p_source_git_sha text,
  p_migration_name text,
  p_migration_sha256 text,
  p_release_manifest_sha256 text,
  p_result text,
  p_source_run_id text,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v public.gomoku_repo_migration_events%rowtype;
begin
  if p_environment_label not in ('production','preview','staging') then
    raise exception 'Invalid migration environment';
  end if;
  if lower(coalesce(p_source_git_sha,'')) !~ '^[0-9a-f]{40}$'
    or lower(coalesce(p_migration_sha256,'')) !~ '^[0-9a-f]{64}$'
    or lower(coalesce(p_release_manifest_sha256,'')) !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid migration evidence hash';
  end if;
  if p_result not in ('applied','verified','failed','baseline_attested') then
    raise exception 'Invalid migration result';
  end if;
  if char_length(btrim(coalesce(p_migration_name,''))) < 1 then
    raise exception 'Migration name is required';
  end if;
  if jsonb_typeof(coalesce(p_details,'{}'::jsonb)) <> 'object' then
    raise exception 'Migration details must be an object';
  end if;

  insert into public.gomoku_repo_migration_events(
    environment_label,source_git_sha,migration_name,migration_sha256,
    release_manifest_sha256,result,source_run_id,details,created_at
  ) values (
    p_environment_label,lower(p_source_git_sha),left(btrim(p_migration_name),220),
    lower(p_migration_sha256),lower(p_release_manifest_sha256),p_result,
    left(btrim(p_source_run_id),96),coalesce(p_details,'{}'::jsonb),now()
  )
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_p17_record_migration_event(text,text,text,text,text,text,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_record_migration_event(text,text,text,text,text,text,text,jsonb)
  to service_role;

create or replace function public.gomoku_p17_record_environment(
  p_environment text,
  p_project_ref text,
  p_branch_id uuid,
  p_branch_name text,
  p_branch_status text,
  p_required_for_promotion boolean,
  p_source text,
  p_source_run_id text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v public.gomoku_release_environments%rowtype;
begin
  if p_environment not in ('preview','staging') then
    raise exception 'Invalid release environment';
  end if;
  if lower(coalesce(p_project_ref,'')) !~ '^[a-z0-9]{20}$'
    or lower(p_project_ref)='hycegznamzjhwinegaai' then
    raise exception 'Release environment must use a distinct Supabase project';
  end if;
  if p_branch_status not in ('provisioning','ready','degraded','failed','paused','unknown') then
    raise exception 'Invalid branch status';
  end if;
  if p_source not in ('supabase_branch','dedicated_project') then
    raise exception 'Invalid environment source';
  end if;

  insert into public.gomoku_release_environments(
    environment,project_ref,branch_id,branch_name,branch_status,
    required_for_promotion,production_project_ref,source,configured_by_run_id,
    configured_at,updated_at
  ) values (
    p_environment,lower(p_project_ref),p_branch_id,
    nullif(left(btrim(coalesce(p_branch_name,'')),120),''),
    p_branch_status,coalesce(p_required_for_promotion,true),
    'hycegznamzjhwinegaai',p_source,
    nullif(left(btrim(coalesce(p_source_run_id,'')),96),''),
    now(),now()
  )
  on conflict (environment) do update set
    project_ref=excluded.project_ref,
    branch_id=excluded.branch_id,
    branch_name=excluded.branch_name,
    branch_status=excluded.branch_status,
    required_for_promotion=excluded.required_for_promotion,
    source=excluded.source,
    configured_by_run_id=excluded.configured_by_run_id,
    updated_at=now()
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_p17_record_environment(text,text,uuid,text,text,boolean,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_record_environment(text,text,uuid,text,text,boolean,text,text)
  to service_role;

create or replace function public.gomoku_p17_record_preview_certification(
  p_source_git_sha text,
  p_source_ref text,
  p_environment text,
  p_project_ref text,
  p_branch_id uuid,
  p_branch_status text,
  p_schema_manifest_sha256 text,
  p_edge_manifest_sha256 text,
  p_release_manifest_sha256 text,
  p_edge_build_sha text,
  p_migration_count integer,
  p_migration_head text,
  p_checks jsonb,
  p_source_run_id text,
  p_workflow_sha text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_env public.gomoku_release_environments%rowtype;
  v_required text[]:=public.gomoku_p17_required_preview_checks();
  v_check text;
  v_all_passed boolean:=true;
  v public.gomoku_preview_certifications%rowtype;
begin
  if lower(coalesce(p_source_git_sha,'')) !~ '^[0-9a-f]{40}$'
    or lower(coalesce(p_edge_build_sha,'')) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid preview Git SHA';
  end if;
  if lower(coalesce(p_schema_manifest_sha256,'')) !~ '^[0-9a-f]{64}$'
    or lower(coalesce(p_edge_manifest_sha256,'')) !~ '^[0-9a-f]{64}$'
    or lower(coalesce(p_release_manifest_sha256,'')) !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid preview manifest hash';
  end if;
  if p_environment not in ('preview','staging') then
    raise exception 'Invalid preview environment';
  end if;
  if p_branch_status not in ('ready','degraded','failed','paused','unknown') then
    raise exception 'Invalid preview branch status';
  end if;
  if jsonb_typeof(p_checks) <> 'object' then
    raise exception 'Preview checks must be an object';
  end if;

  select * into v_env
  from public.gomoku_release_environments
  where environment=p_environment;

  if v_env.id is null then
    raise exception 'Release environment is not registered';
  end if;
  if v_env.project_ref <> lower(p_project_ref) then
    raise exception 'Preview project does not match the registered release environment';
  end if;
  if v_env.branch_id is distinct from p_branch_id then
    raise exception 'Preview branch identity does not match the registered release environment';
  end if;
  if lower(p_edge_build_sha) <> lower(p_source_git_sha) then
    raise exception 'Preview Edge build must match the certified source Git SHA';
  end if;

  foreach v_check in array v_required loop
    if coalesce((p_checks->>v_check)::boolean,false) is not true then
      v_all_passed:=false;
    end if;
  end loop;

  if p_branch_status <> 'ready' then
    v_all_passed:=false;
  end if;

  insert into public.gomoku_preview_certifications(
    source_git_sha,source_ref,environment_id,environment,project_ref,branch_id,
    branch_status,schema_manifest_sha256,edge_manifest_sha256,
    release_manifest_sha256,edge_build_sha,migration_count,migration_head,
    checks,status,source_run_id,workflow_sha,created_at
  ) values (
    lower(p_source_git_sha),nullif(left(btrim(coalesce(p_source_ref,'')),300),''),
    v_env.id,p_environment,lower(p_project_ref),p_branch_id,p_branch_status,
    lower(p_schema_manifest_sha256),lower(p_edge_manifest_sha256),
    lower(p_release_manifest_sha256),lower(p_edge_build_sha),greatest(0,p_migration_count),
    nullif(left(btrim(coalesce(p_migration_head,'')),220),''),
    p_checks,case when v_all_passed then 'passed' else 'failed' end,
    left(btrim(p_source_run_id),96),
    case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
    now()
  )
  returning * into v;

  if v.status='passed' then
    update public.gomoku_release_environments
    set branch_status='ready',last_certified_at=now(),updated_at=now()
    where id=v_env.id;
  end if;

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_p17_record_preview_certification(text,text,text,text,uuid,text,text,text,text,text,integer,text,jsonb,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_record_preview_certification(text,text,text,text,uuid,text,text,text,text,text,integer,text,jsonb,text,text)
  to service_role;

create or replace function public.gomoku_p17_authorize_schema_promotion(
  p_production_git_sha text,
  p_schema_manifest_sha256 text,
  p_edge_manifest_sha256 text,
  p_release_manifest_sha256 text,
  p_source_run_id text,
  p_workflow_sha text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_admission public.gomoku_release_admissions%rowtype;
  v_cert public.gomoku_preview_certifications%rowtype;
  v_env public.gomoku_release_environments%rowtype;
  v_decision text:='rejected';
  v_reason text;
  v public.gomoku_schema_promotion_authorizations%rowtype;
begin
  if lower(coalesce(p_production_git_sha,'')) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid production Git SHA';
  end if;
  if lower(coalesce(p_schema_manifest_sha256,'')) !~ '^[0-9a-f]{64}$'
    or lower(coalesce(p_edge_manifest_sha256,'')) !~ '^[0-9a-f]{64}$'
    or lower(coalesce(p_release_manifest_sha256,'')) !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid promotion manifest hash';
  end if;

  select * into v_admission
  from public.gomoku_release_admissions
  where git_sha=lower(p_production_git_sha)
  order by created_at desc
  limit 1;

  select * into v_env
  from public.gomoku_release_environments
  where required_for_promotion
  order by case environment when 'staging' then 0 else 1 end,updated_at desc
  limit 1;

  if v_env.id is null then
    v_reason:='No required release environment is configured';
  elsif v_env.branch_status <> 'ready' then
    v_reason:='Required release environment is not ready';
  elsif v_admission.id is null or v_admission.decision <> 'admitted' then
    v_reason:='Production Git SHA does not have a passing P16 admission';
  else
    select * into v_cert
    from public.gomoku_preview_certifications
    where environment_id=v_env.id
      and status='passed'
      and schema_manifest_sha256=lower(p_schema_manifest_sha256)
      and edge_manifest_sha256=lower(p_edge_manifest_sha256)
      and release_manifest_sha256=lower(p_release_manifest_sha256)
      and created_at >= now()-interval '72 hours'
    order by created_at desc
    limit 1;

    if v_cert.id is null then
      v_reason:='No fresh passing preview certification matches the production release manifest';
    else
      v_decision:='authorized';
      v_reason:='Exact release manifest passed preview certification and P16 admission';
    end if;
  end if;

  insert into public.gomoku_schema_promotion_authorizations(
    production_git_sha,schema_manifest_sha256,edge_manifest_sha256,
    release_manifest_sha256,preview_certification_id,decision,reason,
    source_run_id,workflow_sha,created_at,expires_at
  ) values (
    lower(p_production_git_sha),lower(p_schema_manifest_sha256),
    lower(p_edge_manifest_sha256),lower(p_release_manifest_sha256),
    v_cert.id,v_decision,left(v_reason,800),left(btrim(p_source_run_id),96),
    case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
    now(),now()+interval '2 hours'
  )
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_p17_authorize_schema_promotion(text,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_authorize_schema_promotion(text,text,text,text,text,text)
  to service_role;

create or replace function public.gomoku_p17_record_promotion_event(
  p_authorization_id uuid,
  p_event_type text,
  p_production_migration_head text,
  p_details jsonb,
  p_source_run_id text,
  p_workflow_sha text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_auth public.gomoku_schema_promotion_authorizations%rowtype;
  v public.gomoku_schema_promotion_events%rowtype;
begin
  if p_event_type not in ('started','applied','verified','failed','rollback_rehearsed') then
    raise exception 'Invalid promotion event';
  end if;
  if jsonb_typeof(coalesce(p_details,'{}'::jsonb)) <> 'object' then
    raise exception 'Promotion details must be an object';
  end if;

  select * into v_auth
  from public.gomoku_schema_promotion_authorizations
  where id=p_authorization_id;

  if v_auth.id is null then
    raise exception 'Promotion authorization not found';
  end if;
  if v_auth.decision <> 'authorized' then
    raise exception 'Promotion authorization was rejected';
  end if;
  if v_auth.expires_at <= now() and p_event_type in ('started','applied') then
    raise exception 'Promotion authorization has expired';
  end if;

  insert into public.gomoku_schema_promotion_events(
    authorization_id,production_git_sha,event_type,production_migration_head,
    details,source_run_id,workflow_sha,created_at
  ) values (
    v_auth.id,v_auth.production_git_sha,p_event_type,
    nullif(left(btrim(coalesce(p_production_migration_head,'')),220),''),
    coalesce(p_details,'{}'::jsonb),left(btrim(p_source_run_id),96),
    case when p_workflow_sha is null then null else lower(p_workflow_sha) end,
    now()
  )
  returning * into v;

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_p17_record_promotion_event(uuid,text,text,jsonb,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_record_promotion_event(uuid,text,text,jsonb,text,text)
  to service_role;

create or replace function public.gomoku_p17_public_status()
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_env public.gomoku_release_environments%rowtype;
  v_cert public.gomoku_preview_certifications%rowtype;
  v_auth public.gomoku_schema_promotion_authorizations%rowtype;
  v_event public.gomoku_schema_promotion_events%rowtype;
  v_state public.gomoku_repo_schema_state%rowtype;
begin
  select * into v_env
  from public.gomoku_release_environments
  order by case environment when 'staging' then 0 else 1 end,updated_at desc
  limit 1;

  select * into v_cert
  from public.gomoku_preview_certifications
  order by created_at desc
  limit 1;

  select * into v_auth
  from public.gomoku_schema_promotion_authorizations
  order by created_at desc
  limit 1;

  select * into v_event
  from public.gomoku_schema_promotion_events
  order by created_at desc
  limit 1;

  select * into v_state
  from public.gomoku_repo_schema_state
  where id=1;

  return jsonb_build_object(
    'environment',case when v_env.id is null then null else jsonb_build_object(
      'name',v_env.environment,
      'projectRef',v_env.project_ref,
      'branchId',v_env.branch_id,
      'branchName',v_env.branch_name,
      'branchStatus',v_env.branch_status,
      'requiredForPromotion',v_env.required_for_promotion,
      'source',v_env.source,
      'lastCertifiedAt',v_env.last_certified_at,
      'updatedAt',v_env.updated_at
    ) end,
    'localSchemaState',case when v_state.id is null then null else jsonb_build_object(
      'environmentLabel',v_state.environment_label,
      'schemaManifestSha256',v_state.schema_manifest_sha256,
      'edgeManifestSha256',v_state.edge_manifest_sha256,
      'releaseManifestSha256',v_state.release_manifest_sha256,
      'sourceGitSha',v_state.source_git_sha,
      'migrationCount',v_state.migration_count,
      'migrationHead',v_state.migration_head,
      'recordedAt',v_state.recorded_at
    ) end,
    'previewCertification',case when v_cert.id is null then null else jsonb_build_object(
      'id',v_cert.id,
      'sourceGitSha',v_cert.source_git_sha,
      'environment',v_cert.environment,
      'projectRef',v_cert.project_ref,
      'branchStatus',v_cert.branch_status,
      'releaseManifestSha256',v_cert.release_manifest_sha256,
      'status',v_cert.status,
      'checks',v_cert.checks,
      'createdAt',v_cert.created_at
    ) end,
    'promotionAuthorization',case when v_auth.id is null then null else jsonb_build_object(
      'id',v_auth.id,
      'productionGitSha',v_auth.production_git_sha,
      'releaseManifestSha256',v_auth.release_manifest_sha256,
      'decision',v_auth.decision,
      'reason',v_auth.reason,
      'expiresAt',v_auth.expires_at,
      'createdAt',v_auth.created_at
    ) end,
    'promotionEvent',case when v_event.id is null then null else jsonb_build_object(
      'authorizationId',v_event.authorization_id,
      'productionGitSha',v_event.production_git_sha,
      'eventType',v_event.event_type,
      'productionMigrationHead',v_event.production_migration_head,
      'createdAt',v_event.created_at
    ) end
  );
end
$$;

revoke all on function public.gomoku_p17_public_status()
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_public_status()
  to service_role;

create or replace function public.gomoku_p17_admin_summary(p_actor_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_role text;
  v_certs jsonb;
  v_auths jsonb;
  v_events jsonb;
  v_migrations jsonb;
begin
  v_role:=public.gomoku_admin_assert_operator(p_actor_user_id,null);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_certs
  from (
    select id,source_git_sha,source_ref,environment,project_ref,branch_id,
           branch_status,schema_manifest_sha256,edge_manifest_sha256,
           release_manifest_sha256,edge_build_sha,migration_count,migration_head,
           checks,status,source_run_id,workflow_sha,created_at
    from public.gomoku_preview_certifications
    order by created_at desc limit 20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_auths
  from (
    select id,production_git_sha,schema_manifest_sha256,edge_manifest_sha256,
           release_manifest_sha256,preview_certification_id,decision,reason,
           source_run_id,workflow_sha,created_at,expires_at
    from public.gomoku_schema_promotion_authorizations
    order by created_at desc limit 20
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_events
  from (
    select id,authorization_id,production_git_sha,event_type,
           production_migration_head,details,source_run_id,workflow_sha,created_at
    from public.gomoku_schema_promotion_events
    order by created_at desc limit 30
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb)
  into v_migrations
  from (
    select id,environment_label,source_git_sha,migration_name,migration_sha256,
           release_manifest_sha256,result,source_run_id,details,created_at
    from public.gomoku_repo_migration_events
    order by created_at desc limit 30
  ) x;

  return jsonb_build_object(
    'operatorRole',v_role,
    'publicStatus',public.gomoku_p17_public_status(),
    'previewCertifications',v_certs,
    'promotionAuthorizations',v_auths,
    'promotionEvents',v_events,
    'migrationEvents',v_migrations,
    'generatedAt',now()
  );
end
$$;

revoke all on function public.gomoku_p17_admin_summary(uuid)
  from public,anon,authenticated;
grant execute on function public.gomoku_p17_admin_summary(uuid)
  to service_role;

comment on table public.gomoku_release_environments is
  'P17 server-only registry of distinct preview/staging Supabase environments used before production promotion.';
comment on table public.gomoku_repo_schema_state is
  'P17 environment-local Gomoku repository schema/edge/release manifest state, independent of the shared project-wide Supabase migration ledger.';
comment on table public.gomoku_repo_migration_events is
  'P17 append-only repository migration evidence for production and release environments.';
comment on table public.gomoku_preview_certifications is
  'P17 append-only certification evidence proving an exact release manifest in an isolated non-production Supabase environment.';
comment on table public.gomoku_schema_promotion_authorizations is
  'P17 short-lived production promotion authorization bound to P16 admission and an exact fresh preview-certified release manifest.';
comment on table public.gomoku_schema_promotion_events is
  'P17 append-only execution evidence for authorized production schema promotions and rollback rehearsals.';
