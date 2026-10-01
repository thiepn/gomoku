-- P14 — Competitive Administration, Incident Response & Release Governance
-- Adds explicit operator authorization, incident control, competitive kill switches,
-- append-only audit evidence, and release lifecycle governance.

create table if not exists public.gomoku_admin_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('operator','incident_commander','release_manager','admin')),
  active boolean not null default true,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gomoku_admin_operators_note_check
    check (note is null or char_length(note) <= 240)
);

create table if not exists public.gomoku_incidents (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('sev1','sev2','sev3','sev4')),
  status text not null default 'investigating'
    check (status in ('investigating','identified','monitoring','resolved')),
  title text not null,
  summary text,
  commander_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gomoku_incidents_title_check
    check (char_length(title) between 3 and 120),
  constraint gomoku_incidents_summary_check
    check (summary is null or char_length(summary) <= 1200)
);

create index if not exists gomoku_incidents_active_idx
  on public.gomoku_incidents (severity, started_at desc)
  where status <> 'resolved';

create table if not exists public.gomoku_release_registry (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  git_sha text not null unique,
  status text not null default 'candidate'
    check (status in ('candidate','approved','active','rolled_back','retired')),
  source_ref text,
  notes text,
  previous_release_id uuid references public.gomoku_release_registry(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  activated_by uuid references auth.users(id) on delete set null,
  rolled_back_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  activated_at timestamptz,
  rolled_back_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint gomoku_release_registry_version_check
    check (version ~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,47}$'),
  constraint gomoku_release_registry_sha_check
    check (git_sha ~ '^[0-9a-f]{40}$'),
  constraint gomoku_release_registry_source_ref_check
    check (source_ref is null or char_length(source_ref) <= 160),
  constraint gomoku_release_registry_notes_check
    check (notes is null or char_length(notes) <= 1200)
);

create unique index if not exists gomoku_release_registry_one_active_idx
  on public.gomoku_release_registry ((1))
  where status='active';

create table if not exists public.gomoku_competitive_control (
  id smallint primary key default 1,
  service_mode text not null default 'normal'
    check (service_mode in ('normal','degraded','maintenance')),
  ranked_enabled boolean not null default true,
  tournaments_enabled boolean not null default true,
  challenges_enabled boolean not null default true,
  room_creation_enabled boolean not null default true,
  public_banner text,
  active_incident_id uuid references public.gomoku_incidents(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint gomoku_competitive_control_singleton check (id=1),
  constraint gomoku_competitive_control_banner_check
    check (public_banner is null or char_length(public_banner) <= 160)
);

insert into public.gomoku_competitive_control(id)
values(1)
on conflict(id) do nothing;

create table if not exists public.gomoku_admin_audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null,
  action text not null,
  target_type text,
  target_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  created_at timestamptz not null default now(),
  constraint gomoku_admin_audit_role_check
    check (actor_role in ('operator','incident_commander','release_manager','admin','system')),
  constraint gomoku_admin_audit_action_check
    check (action ~ '^[a-z][a-z0-9_.-]{2,79}$'),
  constraint gomoku_admin_audit_target_type_check
    check (target_type is null or char_length(target_type) <= 64),
  constraint gomoku_admin_audit_target_id_check
    check (target_id is null or char_length(target_id) <= 160),
  constraint gomoku_admin_audit_reason_check
    check (reason is null or char_length(reason) <= 800),
  constraint gomoku_admin_audit_request_id_check
    check (request_id is null or char_length(request_id) <= 96)
);

create index if not exists gomoku_admin_audit_created_idx
  on public.gomoku_admin_audit_log (created_at desc);
create index if not exists gomoku_admin_audit_actor_idx
  on public.gomoku_admin_audit_log (actor_user_id,created_at desc)
  where actor_user_id is not null;

alter table public.gomoku_admin_operators enable row level security;
alter table public.gomoku_incidents enable row level security;
alter table public.gomoku_release_registry enable row level security;
alter table public.gomoku_competitive_control enable row level security;
alter table public.gomoku_admin_audit_log enable row level security;

revoke all on table public.gomoku_admin_operators from public,anon,authenticated;
revoke all on table public.gomoku_incidents from public,anon,authenticated;
revoke all on table public.gomoku_release_registry from public,anon,authenticated;
revoke all on table public.gomoku_competitive_control from public,anon,authenticated;
revoke all on table public.gomoku_admin_audit_log from public,anon,authenticated;
revoke all on table public.gomoku_admin_audit_log from service_role;

grant select,insert,update,delete on table public.gomoku_admin_operators to service_role;
grant select,insert,update,delete on table public.gomoku_incidents to service_role;
grant select,insert,update,delete on table public.gomoku_release_registry to service_role;
grant select,insert,update,delete on table public.gomoku_competitive_control to service_role;
grant select,insert on table public.gomoku_admin_audit_log to service_role;
grant usage,select on sequence public.gomoku_admin_audit_log_id_seq to service_role;

create or replace function public.gomoku_admin_operator(p_user_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v public.gomoku_admin_operators%rowtype;
begin
  select * into v
  from public.gomoku_admin_operators
  where user_id=p_user_id and active=true;

  if v.user_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'userId',v.user_id,
    'role',v.role,
    'active',v.active,
    'updatedAt',v.updated_at
  );
end
$$;

revoke all on function public.gomoku_admin_operator(uuid) from public,anon,authenticated;
grant execute on function public.gomoku_admin_operator(uuid) to service_role;

create or replace function public.gomoku_admin_assert_operator(
  p_user_id uuid,
  p_roles text[] default null
)
returns text
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.gomoku_admin_operators
  where user_id=p_user_id and active=true;

  if v_role is null then
    raise exception 'Administrative access denied';
  end if;

  if p_roles is not null and array_length(p_roles,1) is not null and not (v_role = any(p_roles)) then
    raise exception 'Administrative role is insufficient';
  end if;

  return v_role;
end
$$;

revoke all on function public.gomoku_admin_assert_operator(uuid,text[]) from public,anon,authenticated;
grant execute on function public.gomoku_admin_assert_operator(uuid,text[]) to service_role;

create or replace function public.gomoku_admin_audit(
  p_actor_user_id uuid,
  p_actor_role text,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_reason text default null,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_request_id text default null
)
returns bigint
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_id bigint;
begin
  insert into public.gomoku_admin_audit_log(
    actor_user_id,actor_role,action,target_type,target_id,reason,
    before_state,after_state,request_id
  ) values (
    p_actor_user_id,
    left(coalesce(p_actor_role,'system'),32),
    left(coalesce(p_action,'system.unknown'),80),
    nullif(left(coalesce(p_target_type,''),64),''),
    nullif(left(coalesce(p_target_id,''),160),''),
    nullif(left(coalesce(p_reason,''),800),''),
    p_before_state,
    p_after_state,
    nullif(left(coalesce(p_request_id,''),96),'')
  )
  returning id into v_id;

  return v_id;
end
$$;

revoke all on function public.gomoku_admin_audit(uuid,text,text,text,text,text,jsonb,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_audit(uuid,text,text,text,text,text,jsonb,jsonb,text)
  to service_role;

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
    limit 50
  ) x;

  return jsonb_build_object(
    'operatorRole',v_role,
    'operations',public.gomoku_public_operational_status(),
    'incidents',v_incidents,
    'releases',v_releases,
    'audit',v_audit,
    'generatedAt',now()
  );
end
$$;

revoke all on function public.gomoku_admin_overview(uuid) from public,anon,authenticated;
grant execute on function public.gomoku_admin_overview(uuid) to service_role;

create or replace function public.gomoku_admin_set_controls(
  p_actor_user_id uuid,
  p_service_mode text default null,
  p_ranked_enabled boolean default null,
  p_tournaments_enabled boolean default null,
  p_challenges_enabled boolean default null,
  p_room_creation_enabled boolean default null,
  p_banner text default null,
  p_banner_provided boolean default false,
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
  v_before public.gomoku_competitive_control%rowtype;
  v_after public.gomoku_competitive_control%rowtype;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['operator','incident_commander','admin']::text[]
  );

  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'Administrative control changes require a reason';
  end if;

  if p_service_mode is not null and p_service_mode not in ('normal','degraded','maintenance') then
    raise exception 'Invalid service mode';
  end if;

  select * into v_before
  from public.gomoku_competitive_control
  where id=1
  for update;

  update public.gomoku_competitive_control
  set service_mode=coalesce(p_service_mode,service_mode),
      ranked_enabled=coalesce(p_ranked_enabled,ranked_enabled),
      tournaments_enabled=coalesce(p_tournaments_enabled,tournaments_enabled),
      challenges_enabled=coalesce(p_challenges_enabled,challenges_enabled),
      room_creation_enabled=coalesce(p_room_creation_enabled,room_creation_enabled),
      public_banner=case when p_banner_provided
        then nullif(left(btrim(coalesce(p_banner,'')),160),'')
        else public_banner
      end,
      updated_by=p_actor_user_id,
      updated_at=now()
  where id=1
  returning * into v_after;

  perform public.gomoku_admin_audit(
    p_actor_user_id,v_role,'controls.updated','competitive_control','1',
    p_reason,to_jsonb(v_before),to_jsonb(v_after),p_request_id
  );

  return public.gomoku_public_operational_status();
end
$$;

revoke all on function public.gomoku_admin_set_controls(uuid,text,boolean,boolean,boolean,boolean,text,boolean,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_set_controls(uuid,text,boolean,boolean,boolean,boolean,text,boolean,text,text)
  to service_role;

create or replace function public.gomoku_admin_create_incident(
  p_actor_user_id uuid,
  p_severity text,
  p_title text,
  p_summary text default null,
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
  v public.gomoku_incidents%rowtype;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['operator','incident_commander','admin']::text[]
  );

  if p_severity not in ('sev1','sev2','sev3','sev4') then
    raise exception 'Invalid incident severity';
  end if;
  if char_length(btrim(coalesce(p_title,''))) < 3 then
    raise exception 'Incident title is required';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'Incident creation requires a reason';
  end if;

  insert into public.gomoku_incidents(
    severity,status,title,summary,commander_user_id,created_by,started_at,created_at,updated_at
  ) values (
    p_severity,'investigating',left(btrim(p_title),120),
    nullif(left(btrim(coalesce(p_summary,'')),1200),''),
    p_actor_user_id,p_actor_user_id,now(),now(),now()
  )
  returning * into v;

  update public.gomoku_competitive_control
  set active_incident_id=v.id,
      updated_by=p_actor_user_id,
      updated_at=now()
  where id=1;

  perform public.gomoku_admin_audit(
    p_actor_user_id,v_role,'incident.created','incident',v.id::text,
    p_reason,null,to_jsonb(v),p_request_id
  );

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_admin_create_incident(uuid,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_create_incident(uuid,text,text,text,text,text)
  to service_role;

create or replace function public.gomoku_admin_update_incident(
  p_actor_user_id uuid,
  p_incident_id uuid,
  p_status text default null,
  p_summary text default null,
  p_summary_provided boolean default false,
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
  v_before public.gomoku_incidents%rowtype;
  v_after public.gomoku_incidents%rowtype;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['operator','incident_commander','admin']::text[]
  );

  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'Incident changes require a reason';
  end if;
  if p_status is not null and p_status not in ('investigating','identified','monitoring','resolved') then
    raise exception 'Invalid incident status';
  end if;

  select * into v_before
  from public.gomoku_incidents
  where id=p_incident_id
  for update;

  if v_before.id is null then
    raise exception 'Incident not found';
  end if;

  update public.gomoku_incidents
  set status=coalesce(p_status,status),
      summary=case when p_summary_provided
        then nullif(left(btrim(coalesce(p_summary,'')),1200),'')
        else summary
      end,
      acknowledged_at=case
        when coalesce(p_status,status) in ('identified','monitoring','resolved')
          then coalesce(acknowledged_at,now())
        else acknowledged_at
      end,
      resolved_at=case
        when coalesce(p_status,status)='resolved' then coalesce(resolved_at,now())
        when p_status is not null and p_status<>'resolved' then null
        else resolved_at
      end,
      commander_user_id=coalesce(commander_user_id,p_actor_user_id),
      updated_at=now()
  where id=p_incident_id
  returning * into v_after;

  update public.gomoku_competitive_control
  set active_incident_id=case
        when v_after.status='resolved' and active_incident_id=v_after.id then null
        when v_after.status<>'resolved' then v_after.id
        else active_incident_id
      end,
      updated_by=p_actor_user_id,
      updated_at=now()
  where id=1;

  perform public.gomoku_admin_audit(
    p_actor_user_id,v_role,'incident.updated','incident',p_incident_id::text,
    p_reason,to_jsonb(v_before),to_jsonb(v_after),p_request_id
  );

  return to_jsonb(v_after);
end
$$;

revoke all on function public.gomoku_admin_update_incident(uuid,uuid,text,text,boolean,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_update_incident(uuid,uuid,text,text,boolean,text,text)
  to service_role;

create or replace function public.gomoku_admin_register_release(
  p_actor_user_id uuid,
  p_version text,
  p_git_sha text,
  p_source_ref text default null,
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
  v public.gomoku_release_registry%rowtype;
begin
  v_role:=public.gomoku_admin_assert_operator(
    p_actor_user_id,
    array['release_manager','admin']::text[]
  );

  if p_version is null or p_version !~ '^[A-Za-z0-9][A-Za-z0-9._+-]{0,47}$' then
    raise exception 'Invalid release version';
  end if;
  if p_git_sha is null or lower(p_git_sha) !~ '^[0-9a-f]{40}$' then
    raise exception 'Invalid release git sha';
  end if;
  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'Release registration requires a reason';
  end if;

  insert into public.gomoku_release_registry(
    version,git_sha,status,source_ref,notes,created_by,created_at,updated_at
  ) values (
    p_version,lower(p_git_sha),'candidate',
    nullif(left(btrim(coalesce(p_source_ref,'')),160),''),
    nullif(left(btrim(coalesce(p_notes,'')),1200),''),
    p_actor_user_id,now(),now()
  )
  returning * into v;

  perform public.gomoku_admin_audit(
    p_actor_user_id,v_role,'release.registered','release',v.id::text,
    p_reason,null,to_jsonb(v),p_request_id
  );

  return to_jsonb(v);
end
$$;

revoke all on function public.gomoku_admin_register_release(uuid,text,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.gomoku_admin_register_release(uuid,text,text,text,text,text,text)
  to service_role;

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

comment on table public.gomoku_admin_operators is
  'P14 explicit service-side operator allowlist. Authentication alone never grants Gomoku administrative authority.';
comment on table public.gomoku_incidents is
  'P14 operational incident ledger with public-safe status projection through gomoku-room.';
comment on table public.gomoku_competitive_control is
  'P14 singleton operational controls for new ranked, tournament, challenge, and room creation entry points.';
comment on table public.gomoku_release_registry is
  'P14 release candidate, approval, activation, retirement, and rollback ledger.';
comment on table public.gomoku_admin_audit_log is
  'P14 append-only administrative audit evidence. Direct client access is denied.';
comment on function public.gomoku_public_operational_status() is
  'P14 sanitized operational status for public health responses; excludes operator identities and audit details.';
