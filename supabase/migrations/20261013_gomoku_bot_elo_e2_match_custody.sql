-- E2 bot-game custody only. No Elo profiles, rewards, human-ranked triggers or migrations applied.
-- Requires the existing THIEPN Account auth.users identity.
create table if not exists public.gomoku_bot_matches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null check (length(request_key) between 8 and 100),
  ruleset text not null default 'renju-practice' check (ruleset='renju-practice'),
  bot_id text not null check (bot_id in ('first','beg','club','mid','advanced','high','expert','maximum')),
  bot_snapshot jsonb not null check (jsonb_typeof(bot_snapshot)='object'),
  player_color smallint not null check (player_color in (1,2)),
  server_seed bigint not null check (server_seed between 0 and 4294967295),
  moves jsonb not null default '[]'::jsonb check (jsonb_typeof(moves)='array' and jsonb_array_length(moves)<=227),
  revision bigint not null default 0 check (revision >= 0),
  status text not null default 'active' check (status in ('active','completed','resigned')),
  result jsonb check (result is null or jsonb_typeof(result)='object'),
  last_command_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint gomoku_bot_matches_result_check check (
    (status='active' and result is null and completed_at is null)
    or (status<>'active' and result is not null and completed_at is not null)
  ),
  unique (owner_user_id,request_key)
);
create unique index if not exists gomoku_bot_matches_one_active_per_owner
  on public.gomoku_bot_matches(owner_user_id) where status='active';
create index if not exists gomoku_bot_matches_owner_history
  on public.gomoku_bot_matches(owner_user_id,started_at desc);
alter table public.gomoku_bot_matches enable row level security;
revoke all on public.gomoku_bot_matches from public,anon,authenticated;
grant select,insert,update,delete on public.gomoku_bot_matches to service_role;
comment on table public.gomoku_bot_matches is
  'E2 owner-private verified bot game transcripts. No rating settlement, no PvP identity, no fake Elo.';
