-- P4 — Online Match Integrity & Abuse Hardening

create table if not exists public.gomoku_room_rate_limits (
  key_hash text primary key,
  window_started timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists gomoku_room_rate_limits_updated_at_idx
  on public.gomoku_room_rate_limits (updated_at);

alter table public.gomoku_room_rate_limits enable row level security;

revoke all on table public.gomoku_room_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.gomoku_room_rate_limits to service_role;

create or replace function public.gomoku_take_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_allowed boolean;
  v_now timestamptz := clock_timestamp();
begin
  if p_key is null or length(p_key) < 16 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit arguments';
  end if;

  insert into public.gomoku_room_rate_limits as r
    (key_hash, window_started, request_count, updated_at)
  values
    (p_key, v_now, 1, v_now)
  on conflict (key_hash) do update
  set
    request_count = case
      when r.window_started <= v_now - make_interval(secs => p_window_seconds)
        then 1
      else r.request_count + 1
    end,
    window_started = case
      when r.window_started <= v_now - make_interval(secs => p_window_seconds)
        then v_now
      else r.window_started
    end,
    updated_at = v_now
  returning request_count <= p_limit into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.gomoku_take_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.gomoku_take_rate_limit(text, integer, integer)
  to service_role;

comment on table public.gomoku_room_rate_limits is
  'Server-only hashed request buckets for Gomoku room creation and join abuse protection. No raw IP addresses are stored.';

comment on function public.gomoku_take_rate_limit(text, integer, integer) is
  'Atomically consumes one request from a fixed-window server-only rate-limit bucket and returns whether it remains within limit.';
