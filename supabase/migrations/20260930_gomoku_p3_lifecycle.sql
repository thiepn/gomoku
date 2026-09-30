-- P3 — Online Room Lifecycle & Multiplayer Reliability
-- Applied to THIEPN Account on 2026-09-30.

alter table public.gomoku_rooms
  alter column host_token_hash drop not null;

create table if not exists public.gomoku_room_player_presence (
  room_id text not null references public.gomoku_rooms(id) on delete cascade,
  seat smallint not null check (seat in (1,2)),
  last_seen timestamptz not null default now(),
  primary key (room_id, seat)
);

create index if not exists gomoku_room_player_presence_last_seen_idx
  on public.gomoku_room_player_presence (last_seen);

alter table public.gomoku_room_player_presence enable row level security;

revoke all on table public.gomoku_room_player_presence from public, anon, authenticated;
grant select, insert, update, delete on table public.gomoku_room_player_presence to service_role;

comment on table public.gomoku_room_player_presence is
  'Server-managed player heartbeats for Gomoku room reconnect grace, online status, stale-seat release, and abandoned-room cleanup. Direct public client access is denied.';
