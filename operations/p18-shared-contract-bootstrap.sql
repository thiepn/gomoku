-- P18 local/standalone compatibility bootstrap.
-- This file is NEVER applied to production. It recreates only the shared
-- THIEPN Account contracts that Gomoku depends on so the Gomoku migrations
-- can be replayed in an isolated Supabase project or local CI stack.

create extension if not exists pg_cron with schema extensions;

create table if not exists public.account_apps (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null,
  path text not null check (path like '/%/'),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_app_manifests (
  app_slug text primary key references public.account_apps(slug) on delete cascade,
  manifest_version integer not null default 1 check (manifest_version > 0),
  identity_scope text not null default 'shared' check (identity_scope='shared'),
  data_scope text not null default 'isolated' check (data_scope='isolated'),
  export_scope text not null default 'app-owned'
    check (export_scope in ('none','app-owned','platform-metadata')),
  capabilities jsonb not null default '{}'::jsonb
    check (jsonb_typeof(capabilities)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  core_app_id text check (core_app_id is null or core_app_id ~ '^[a-z0-9-]+$')
);

create table if not exists public.account_app_permissions (
  app_slug text not null references public.account_apps(slug) on delete cascade,
  permission_id text not null check (permission_id ~ '^[a-z0-9._-]+$'),
  name text not null,
  description text not null,
  required boolean not null default false,
  mutable_by_user boolean not null default true,
  sensitivity text not null default 'basic' check (sensitivity in ('basic','sensitive')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_slug,permission_id),
  check ((not required) or (not mutable_by_user))
);

create table if not exists public.account_app_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null references public.account_apps(slug) on delete cascade,
  status text not null default 'connected'
    check (status in ('connected','limited','disconnected','suspended','error')),
  source text not null default 'account'
    check (source in ('usage','account','migration')),
  connected_at timestamptz not null default now(),
  last_used_at timestamptz,
  disconnected_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id,app_slug)
);

create table if not exists public.account_app_grants (
  user_id uuid not null,
  app_slug text not null,
  permission_id text not null,
  status text not null default 'denied' check (status in ('granted','denied')),
  granted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id,app_slug,permission_id),
  foreign key (user_id,app_slug)
    references public.account_app_connections(user_id,app_slug) on delete cascade,
  foreign key (app_slug,permission_id)
    references public.account_app_permissions(app_slug,permission_id) on delete cascade
);

create table if not exists public.leaderboard_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  username_normalized text unique,
  username_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_apps enable row level security;
alter table public.account_app_manifests enable row level security;
alter table public.account_app_permissions enable row level security;
alter table public.account_app_connections enable row level security;
alter table public.account_app_grants enable row level security;
alter table public.leaderboard_profiles enable row level security;

revoke all on table public.account_apps from public,anon,authenticated;
revoke all on table public.account_app_manifests from public,anon,authenticated;
revoke all on table public.account_app_permissions from public,anon,authenticated;
revoke all on table public.account_app_connections from public,anon,authenticated;
revoke all on table public.account_app_grants from public,anon,authenticated;
revoke all on table public.leaderboard_profiles from public,anon,authenticated;

grant select,insert,update,delete on table public.account_apps to service_role;
grant select,insert,update,delete on table public.account_app_manifests to service_role;
grant select,insert,update,delete on table public.account_app_permissions to service_role;
grant select,insert,update,delete on table public.account_app_connections to service_role;
grant select,insert,update,delete on table public.account_app_grants to service_role;
grant select,insert,update,delete on table public.leaderboard_profiles to service_role;

comment on table public.account_apps is
  'P18 compatibility copy of the THIEPN Account app registry for isolated Gomoku environments only.';
comment on table public.leaderboard_profiles is
  'P18 compatibility copy of the shared public profile contract for isolated Gomoku environments only.';
