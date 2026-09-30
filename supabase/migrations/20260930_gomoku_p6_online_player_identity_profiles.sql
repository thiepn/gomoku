-- P6 — Online Player Identity, Statistics & Profiles

alter table public.gomoku_matches
  add column if not exists black_user_id uuid references auth.users(id) on delete set null,
  add column if not exists white_user_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.gomoku_matches'::regclass
      and conname='gomoku_matches_distinct_account_players'
  ) then
    alter table public.gomoku_matches
      add constraint gomoku_matches_distinct_account_players
      check (
        black_user_id is null
        or white_user_id is null
        or black_user_id <> white_user_id
      );
  end if;
end $$;

create index if not exists gomoku_matches_black_user_completed_idx
  on public.gomoku_matches (black_user_id, completed_at desc)
  where black_user_id is not null;

create index if not exists gomoku_matches_white_user_completed_idx
  on public.gomoku_matches (white_user_id, completed_at desc)
  where white_user_id is not null;

insert into public.account_apps
  (slug,name,description,path,sort_order,active,updated_at)
values
  ('gomoku','Gomoku Studio','Online Renju rooms, persistent match history, statistics and public player profiles.','/gomoku/',40,true,now())
on conflict (slug) do update set
  name=excluded.name,
  description=excluded.description,
  path=excluded.path,
  sort_order=excluded.sort_order,
  active=true,
  updated_at=now();

insert into public.account_app_manifests
  (app_slug,manifest_version,identity_scope,data_scope,export_scope,capabilities,core_app_id,updated_at)
values
  ('gomoku',1,'shared','isolated','platform-metadata',
   '{"sharedIdentity":true,"activityTracking":true,"publicProfiles":true}'::jsonb,
   'gomoku',now())
on conflict (app_slug) do update set
  manifest_version=excluded.manifest_version,
  identity_scope=excluded.identity_scope,
  data_scope=excluded.data_scope,
  export_scope=excluded.export_scope,
  capabilities=excluded.capabilities,
  core_app_id=excluded.core_app_id,
  updated_at=now();

insert into public.account_app_permissions
  (app_slug,permission_id,name,description,required,mutable_by_user,sensitivity,sort_order,active,updated_at)
values
  ('gomoku','identity.basic','Basic account identity',
   'Use your stable THIEPN Account ID and shared public game username for verified Gomoku identity and statistics.',
   true,false,'basic',10,true,now())
on conflict (app_slug,permission_id) do update set
  name=excluded.name,
  description=excluded.description,
  required=excluded.required,
  mutable_by_user=excluded.mutable_by_user,
  sensitivity=excluded.sensitivity,
  sort_order=excluded.sort_order,
  active=true,
  updated_at=now();
