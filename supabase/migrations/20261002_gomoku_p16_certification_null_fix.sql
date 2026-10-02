-- P16 corrective migration: JSON null is not SQL NULL when using -> on jsonb.
-- Use text extraction so a JSON null incident becomes SQL NULL for certification.

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
    'noActiveIncident',v_operations->>'incident' is null,
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
