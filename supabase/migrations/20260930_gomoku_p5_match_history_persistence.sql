-- P5 — Match History, Results & Persistence

create table if not exists public.gomoku_matches (
  room_id text not null,
  game_version bigint not null check (game_version >= 1),
  round bigint not null check (round >= 1),
  rule text not null default 'renju-practice',
  started_at timestamptz,
  completed_at timestamptz not null default now(),
  winner_color smallint not null check (winner_color in (0,1,2)),
  result_reason text not null check (result_reason in ('five','resign','agreement','full','abandon')),
  move_count smallint not null check (move_count between 0 and 225),
  moves jsonb not null default '[]'::jsonb,
  players jsonb not null default '[]'::jsonb,
  history_hashes text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (room_id, game_version),
  constraint gomoku_matches_moves_array check (jsonb_typeof(moves) = 'array'),
  constraint gomoku_matches_players_array check (jsonb_typeof(players) = 'array')
);

create index if not exists gomoku_matches_completed_at_idx
  on public.gomoku_matches (completed_at desc);

create index if not exists gomoku_matches_history_hashes_idx
  on public.gomoku_matches using gin (history_hashes);

alter table public.gomoku_matches enable row level security;

revoke all on table public.gomoku_matches from public, anon, authenticated;
grant select, insert, update, delete on table public.gomoku_matches to service_role;

comment on table public.gomoku_matches is
  'Server-authoritative durable Gomoku online match ledger. Access is only through the gomoku-room Edge Function; participant history credentials are stored as hashes.';
