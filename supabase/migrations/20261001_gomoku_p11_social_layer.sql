-- P11 — Competitive Social Layer, Rivalries & Community Discovery
-- Lightweight social graph: private favorites, coarse opt-out presence, account-bound direct challenges.

create table if not exists public.gomoku_social_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  allow_challenges boolean not null default true,
  show_presence boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.gomoku_social_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  activity text not null default 'online' check (activity in ('online','in_game')),
  room_id text references public.gomoku_rooms(id) on delete set null,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gomoku_social_presence_seen_idx
  on public.gomoku_social_presence(last_seen_at desc);

create table if not exists public.gomoku_player_favorites (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(owner_user_id,target_user_id),
  constraint gomoku_player_favorites_not_self check (owner_user_id<>target_user_id)
);
create index if not exists gomoku_player_favorites_target_idx
  on public.gomoku_player_favorites(target_user_id);

create table if not exists public.gomoku_direct_challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_user_id uuid not null references auth.users(id) on delete cascade,
  challenged_user_id uuid not null references auth.users(id) on delete cascade,
  challenger_username text not null,
  challenged_username text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired')),
  room_id text references public.gomoku_rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '15 minutes'),
  responded_at timestamptz,
  constraint gomoku_direct_challenges_not_self check (challenger_user_id<>challenged_user_id)
);
create index if not exists gomoku_direct_challenges_recipient_idx
  on public.gomoku_direct_challenges(challenged_user_id,status,created_at desc);
create index if not exists gomoku_direct_challenges_challenger_idx
  on public.gomoku_direct_challenges(challenger_user_id,status,created_at desc);
create unique index if not exists gomoku_direct_challenges_pending_pair_idx
  on public.gomoku_direct_challenges(
    least(challenger_user_id,challenged_user_id),
    greatest(challenger_user_id,challenged_user_id)
  ) where status='pending';

alter table public.gomoku_social_preferences enable row level security;
alter table public.gomoku_social_presence enable row level security;
alter table public.gomoku_player_favorites enable row level security;
alter table public.gomoku_direct_challenges enable row level security;
revoke all on table public.gomoku_social_preferences from public,anon,authenticated;
revoke all on table public.gomoku_social_presence from public,anon,authenticated;
revoke all on table public.gomoku_player_favorites from public,anon,authenticated;
revoke all on table public.gomoku_direct_challenges from public,anon,authenticated;
grant select,insert,update,delete on table public.gomoku_social_preferences to service_role;
grant select,insert,update,delete on table public.gomoku_social_presence to service_role;
grant select,insert,update,delete on table public.gomoku_player_favorites to service_role;
grant select,insert,update,delete on table public.gomoku_direct_challenges to service_role;

create or replace function public.gomoku_touch_social_presence(p_user_id uuid,p_username text,p_activity text default 'online',p_room_id text default null)
returns void language plpgsql security invoker set search_path=''
as $$
begin
  if p_user_id is null or p_username is null then return; end if;
  insert into public.gomoku_social_preferences(user_id) values(p_user_id) on conflict(user_id) do nothing;
  insert into public.gomoku_social_presence(user_id,username,activity,room_id,last_seen_at,updated_at)
  values(p_user_id,left(p_username,20),case when p_activity='in_game' then 'in_game' else 'online' end,
         case when p_activity='in_game' then p_room_id else null end,now(),now())
  on conflict(user_id) do update set username=excluded.username,activity=excluded.activity,room_id=excluded.room_id,last_seen_at=now(),updated_at=now();
end $$;
revoke all on function public.gomoku_touch_social_presence(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.gomoku_touch_social_presence(uuid,text,text,text) to service_role;

create or replace function public.gomoku_set_social_preferences(p_user_id uuid,p_allow_challenges boolean,p_show_presence boolean)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare r public.gomoku_social_preferences%rowtype;
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  insert into public.gomoku_social_preferences(user_id,allow_challenges,show_presence,updated_at)
  values(p_user_id,coalesce(p_allow_challenges,true),coalesce(p_show_presence,true),now())
  on conflict(user_id) do update set allow_challenges=excluded.allow_challenges,show_presence=excluded.show_presence,updated_at=now()
  returning * into r;
  return jsonb_build_object('allowChallenges',r.allow_challenges,'showPresence',r.show_presence,'updatedAt',r.updated_at);
end $$;
revoke all on function public.gomoku_set_social_preferences(uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.gomoku_set_social_preferences(uuid,boolean,boolean) to service_role;

create or replace function public.gomoku_set_player_favorite(p_owner_user_id uuid,p_target_user_id uuid,p_favorite boolean)
returns boolean language plpgsql security invoker set search_path=''
as $$
begin
  if p_owner_user_id is null or p_target_user_id is null or p_owner_user_id=p_target_user_id then raise exception 'Invalid favorite target'; end if;
  if coalesce(p_favorite,true) then
    insert into public.gomoku_player_favorites(owner_user_id,target_user_id) values(p_owner_user_id,p_target_user_id)
    on conflict(owner_user_id,target_user_id) do nothing;
    return true;
  end if;
  delete from public.gomoku_player_favorites where owner_user_id=p_owner_user_id and target_user_id=p_target_user_id;
  return false;
end $$;
revoke all on function public.gomoku_set_player_favorite(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.gomoku_set_player_favorite(uuid,uuid,boolean) to service_role;

create or replace function public.gomoku_expire_direct_challenges()
returns integer language plpgsql security invoker set search_path=''
as $$
declare n integer;
begin
  update public.gomoku_direct_challenges set status='expired',responded_at=coalesce(responded_at,now())
  where status='pending' and expires_at<=now();
  get diagnostics n=row_count;
  return n;
end $$;
revoke all on function public.gomoku_expire_direct_challenges() from public,anon,authenticated;
grant execute on function public.gomoku_expire_direct_challenges() to service_role;

create or replace function public.gomoku_create_direct_challenge(
  p_challenger_user_id uuid,p_challenged_user_id uuid,p_challenger_username text,p_challenged_username text
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare c public.gomoku_direct_challenges%rowtype; allow_target boolean; pair_key text;
begin
  if p_challenger_user_id is null or p_challenged_user_id is null or p_challenger_user_id=p_challenged_user_id then raise exception 'Invalid challenge target'; end if;
  perform public.gomoku_expire_direct_challenges();
  insert into public.gomoku_social_preferences(user_id) values(p_challenged_user_id) on conflict(user_id) do nothing;
  select allow_challenges into allow_target from public.gomoku_social_preferences where user_id=p_challenged_user_id;
  if allow_target is false then raise exception 'Player is not accepting direct challenges'; end if;
  pair_key:=least(p_challenger_user_id::text,p_challenged_user_id::text)||':'||greatest(p_challenger_user_id::text,p_challenged_user_id::text);
  perform pg_advisory_xact_lock(hashtextextended(pair_key,0));
  if exists(select 1 from public.gomoku_direct_challenges where status='pending' and
    ((challenger_user_id=p_challenger_user_id and challenged_user_id=p_challenged_user_id)
      or (challenger_user_id=p_challenged_user_id and challenged_user_id=p_challenger_user_id)))
  then raise exception 'A challenge is already pending between these players'; end if;
  insert into public.gomoku_direct_challenges(challenger_user_id,challenged_user_id,challenger_username,challenged_username)
  values(p_challenger_user_id,p_challenged_user_id,left(p_challenger_username,20),left(p_challenged_username,20))
  returning * into c;
  return jsonb_build_object('id',c.id,'status',c.status,'challenger',c.challenger_username,'challenged',c.challenged_username,'createdAt',c.created_at,'expiresAt',c.expires_at);
end $$;
revoke all on function public.gomoku_create_direct_challenge(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.gomoku_create_direct_challenge(uuid,uuid,text,text) to service_role;

create or replace function public.gomoku_respond_direct_challenge(
  p_challenge_id uuid,p_user_id uuid,p_action text,p_room_id text default null,p_room_state jsonb default null,p_room_expires_at timestamptz default null
) returns jsonb language plpgsql security invoker set search_path=''
as $$
declare c public.gomoku_direct_challenges%rowtype;
begin
  perform public.gomoku_expire_direct_challenges();
  select * into c from public.gomoku_direct_challenges where id=p_challenge_id for update;
  if c.id is null then raise exception 'Challenge not found'; end if;
  if c.status<>'pending' then return jsonb_build_object('id',c.id,'status',c.status,'roomId',c.room_id); end if;
  if p_action='cancel' then
    if p_user_id<>c.challenger_user_id then raise exception 'Only the challenger can cancel'; end if;
    update public.gomoku_direct_challenges set status='cancelled',responded_at=now() where id=c.id returning * into c;
  elsif p_action='decline' then
    if p_user_id<>c.challenged_user_id then raise exception 'Only the challenged player can decline'; end if;
    update public.gomoku_direct_challenges set status='declined',responded_at=now() where id=c.id returning * into c;
  elsif p_action='accept' then
    if p_user_id<>c.challenged_user_id then raise exception 'Only the challenged player can accept'; end if;
    if p_room_id is null or p_room_state is null or jsonb_typeof(p_room_state)<>'object' then raise exception 'Accepted challenge requires a room'; end if;
    insert into public.gomoku_rooms(id,created_at,updated_at,expires_at,revision,host_token_hash,guest_token_hash,password_salt,password_hash,state)
    values(p_room_id,now(),now(),coalesce(p_room_expires_at,now()+interval '24 hours'),0,null,null,null,null,p_room_state);
    update public.gomoku_direct_challenges set status='accepted',room_id=p_room_id,responded_at=now() where id=c.id returning * into c;
  else raise exception 'Unsupported challenge response'; end if;
  return jsonb_build_object('id',c.id,'status',c.status,'roomId',c.room_id,'challenger',c.challenger_username,'challenged',c.challenged_username,'createdAt',c.created_at,'expiresAt',c.expires_at,'respondedAt',c.responded_at);
end $$;
revoke all on function public.gomoku_respond_direct_challenge(uuid,uuid,text,text,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.gomoku_respond_direct_challenge(uuid,uuid,text,text,jsonb,timestamptz) to service_role;

create or replace function public.gomoku_head_to_head(p_user_id uuid,p_other_user_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare g integer:=0; w integer:=0; d integer:=0; l integer:=0; ranked integer:=0; tournament integer:=0; casual integer:=0; first_at timestamptz; last_at timestamptz;
begin
  if p_user_id is null or p_other_user_id is null or p_user_id=p_other_user_id then
    return jsonb_build_object('games',0,'wins',0,'draws',0,'losses',0,'ranked',0,'tournament',0,'casual',0);
  end if;
  select count(*)::integer,
    count(*) filter(where (black_user_id=p_user_id and winner_color=1) or (white_user_id=p_user_id and winner_color=2))::integer,
    count(*) filter(where winner_color=0)::integer,
    count(*) filter(where (black_user_id=p_user_id and winner_color=2) or (white_user_id=p_user_id and winner_color=1))::integer,
    count(*) filter(where match_mode='ranked')::integer,
    count(*) filter(where match_mode='tournament')::integer,
    count(*) filter(where match_mode='casual')::integer,
    min(completed_at),max(completed_at)
  into g,w,d,l,ranked,tournament,casual,first_at,last_at
  from public.gomoku_matches
  where (black_user_id=p_user_id and white_user_id=p_other_user_id) or (black_user_id=p_other_user_id and white_user_id=p_user_id);
  return jsonb_build_object('games',coalesce(g,0),'wins',coalesce(w,0),'draws',coalesce(d,0),'losses',coalesce(l,0),'ranked',coalesce(ranked,0),'tournament',coalesce(tournament,0),'casual',coalesce(casual,0),'firstPlayedAt',first_at,'lastPlayedAt',last_at);
end $$;
revoke all on function public.gomoku_head_to_head(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gomoku_head_to_head(uuid,uuid) to service_role;

comment on table public.gomoku_player_favorites is 'Private per-user player bookmarks. No follower counts or public relationship graph.';
comment on table public.gomoku_social_presence is 'Coarse opt-out presence for community discovery; room identifiers are never exposed by public APIs.';
comment on table public.gomoku_direct_challenges is 'Short-lived verified-account challenge invitations. Acceptance atomically creates an account-bound Renju room.';
