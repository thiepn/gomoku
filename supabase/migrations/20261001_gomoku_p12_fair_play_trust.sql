-- P12 — Fair Play, Abuse Controls & Competitive Trust
-- Objective automated protections + auditable moderation. Reports never auto-sanction players.

create table if not exists public.gomoku_player_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_user_id,blocked_user_id),
  constraint gomoku_player_blocks_not_self check (blocker_user_id<>blocked_user_id)
);
create index if not exists gomoku_player_blocks_blocked_idx on public.gomoku_player_blocks(blocked_user_id);

create table if not exists public.gomoku_fair_play_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_username text not null,
  room_id text,
  game_version bigint,
  category text not null check (category in ('cheating','stalling_disconnect','harassment','rating_manipulation','inappropriate_username','other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  resolution text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint gomoku_fair_play_reports_not_self check (reporter_user_id<>target_user_id),
  constraint gomoku_fair_play_reports_details_len check (char_length(details)<=800),
  constraint gomoku_fair_play_reports_game_check check (game_version is null or game_version>=1)
);
create index if not exists gomoku_fair_play_reports_reporter_idx on public.gomoku_fair_play_reports(reporter_user_id,created_at desc);
create index if not exists gomoku_fair_play_reports_target_idx on public.gomoku_fair_play_reports(target_user_id,status,created_at desc);
create index if not exists gomoku_fair_play_reports_room_idx on public.gomoku_fair_play_reports(room_id,game_version) where room_id is not null;

create table if not exists public.gomoku_player_trust_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ranked_cooldown_until timestamptz,
  ranked_suspended_until timestamptz,
  challenges_suspended_until timestamptz,
  notice text,
  updated_at timestamptz not null default now()
);

create table if not exists public.gomoku_match_integrity_flags (
  id bigserial primary key,
  room_id text not null,
  game_version bigint not null,
  flag_code text not null check (flag_code in ('early_ranked_exit','repeat_pair','serial_abandon','rapid_repeat_results')),
  severity smallint not null default 1 check (severity between 1 and 3),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  status text not null default 'open' check (status in ('open','reviewing','confirmed','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(room_id,game_version,flag_code)
);
create index if not exists gomoku_match_integrity_flags_status_idx on public.gomoku_match_integrity_flags(status,severity desc,created_at desc);

create table if not exists public.gomoku_rating_protections (
  room_id text not null,
  game_version bigint not null,
  pair_games_6h integer not null check (pair_games_6h>=1),
  base_k_factor integer not null check (base_k_factor between 1 and 100),
  effective_k_factor integer not null check (effective_k_factor between 1 and 100),
  protection_level text not null check (protection_level in ('none','reduced','minimal')),
  created_at timestamptz not null default now(),
  primary key(room_id,game_version)
);

create table if not exists public.gomoku_fair_play_audit_events (
  id bigserial primary key,
  event_type text not null check (event_type in ('block_set','block_removed','report_submitted','ranked_cooldown','rating_protection','moderation_action')),
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  room_id text,
  game_version bigint,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create index if not exists gomoku_fair_play_audit_subject_idx on public.gomoku_fair_play_audit_events(subject_user_id,created_at desc);
create index if not exists gomoku_fair_play_audit_room_idx on public.gomoku_fair_play_audit_events(room_id,game_version) where room_id is not null;

create table if not exists public.gomoku_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null check (action_type in ('warning','ranked_suspend','challenge_suspend','clear_ranked','clear_challenge','clear_all')),
  reason text not null,
  duration_minutes integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint gomoku_moderation_reason_len check (char_length(reason) between 3 and 500),
  constraint gomoku_moderation_duration_check check (duration_minutes is null or duration_minutes between 1 and 525600)
);
create index if not exists gomoku_moderation_actions_subject_idx on public.gomoku_moderation_actions(subject_user_id,created_at desc);

alter table public.gomoku_player_blocks enable row level security;
alter table public.gomoku_fair_play_reports enable row level security;
alter table public.gomoku_player_trust_state enable row level security;
alter table public.gomoku_match_integrity_flags enable row level security;
alter table public.gomoku_rating_protections enable row level security;
alter table public.gomoku_fair_play_audit_events enable row level security;
alter table public.gomoku_moderation_actions enable row level security;

revoke all on table public.gomoku_player_blocks from public,anon,authenticated;
revoke all on table public.gomoku_fair_play_reports from public,anon,authenticated;
revoke all on table public.gomoku_player_trust_state from public,anon,authenticated;
revoke all on table public.gomoku_match_integrity_flags from public,anon,authenticated;
revoke all on table public.gomoku_rating_protections from public,anon,authenticated;
revoke all on table public.gomoku_fair_play_audit_events from public,anon,authenticated;
revoke all on table public.gomoku_moderation_actions from public,anon,authenticated;

grant select,insert,update,delete on table public.gomoku_player_blocks to service_role;
grant select,insert,update,delete on table public.gomoku_fair_play_reports to service_role;
grant select,insert,update,delete on table public.gomoku_player_trust_state to service_role;
grant select,insert,update,delete on table public.gomoku_match_integrity_flags to service_role;
grant select,insert,update,delete on table public.gomoku_rating_protections to service_role;
grant select,insert,update,delete on table public.gomoku_fair_play_audit_events to service_role;
grant select,insert,update,delete on table public.gomoku_moderation_actions to service_role;
grant usage,select on sequence public.gomoku_match_integrity_flags_id_seq to service_role;
grant usage,select on sequence public.gomoku_fair_play_audit_events_id_seq to service_role;

create or replace function public.gomoku_players_blocked(p_a uuid,p_b uuid)
returns boolean
language sql security invoker set search_path=''
as $$
  select exists(
    select 1 from public.gomoku_player_blocks
    where (blocker_user_id=p_a and blocked_user_id=p_b)
       or (blocker_user_id=p_b and blocked_user_id=p_a)
  );
$$;
revoke all on function public.gomoku_players_blocked(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gomoku_players_blocked(uuid,uuid) to service_role;

create or replace function public.gomoku_set_player_block(p_blocker_user_id uuid,p_blocked_user_id uuid,p_blocked boolean)
returns boolean
language plpgsql security invoker set search_path=''
as $$
begin
  if p_blocker_user_id is null or p_blocked_user_id is null or p_blocker_user_id=p_blocked_user_id then raise exception 'Invalid block target'; end if;
  if coalesce(p_blocked,true) then
    insert into public.gomoku_player_blocks(blocker_user_id,blocked_user_id)
    values(p_blocker_user_id,p_blocked_user_id)
    on conflict(blocker_user_id,blocked_user_id) do nothing;
    delete from public.gomoku_player_favorites where owner_user_id=p_blocker_user_id and target_user_id=p_blocked_user_id;
    update public.gomoku_direct_challenges set status='cancelled',responded_at=coalesce(responded_at,now())
    where status='pending' and (
      (challenger_user_id=p_blocker_user_id and challenged_user_id=p_blocked_user_id)
      or (challenger_user_id=p_blocked_user_id and challenged_user_id=p_blocker_user_id)
    );
    insert into public.gomoku_fair_play_audit_events(event_type,actor_user_id,subject_user_id)
    values('block_set',p_blocker_user_id,p_blocked_user_id);
    return true;
  end if;
  delete from public.gomoku_player_blocks where blocker_user_id=p_blocker_user_id and blocked_user_id=p_blocked_user_id;
  insert into public.gomoku_fair_play_audit_events(event_type,actor_user_id,subject_user_id)
  values('block_removed',p_blocker_user_id,p_blocked_user_id);
  return false;
end $$;
revoke all on function public.gomoku_set_player_block(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.gomoku_set_player_block(uuid,uuid,boolean) to service_role;

create or replace function public.gomoku_submit_fair_play_report(
  p_reporter_user_id uuid,p_target_user_id uuid,p_target_username text,
  p_category text,p_details text default '',p_room_id text default null,p_game_version bigint default null
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare r public.gomoku_fair_play_reports%rowtype; v_count integer;
begin
  if p_reporter_user_id is null or p_target_user_id is null or p_reporter_user_id=p_target_user_id then raise exception 'Invalid report target'; end if;
  if p_category not in ('cheating','stalling_disconnect','harassment','rating_manipulation','inappropriate_username','other') then raise exception 'Invalid report category'; end if;
  if char_length(coalesce(p_details,''))>800 then raise exception 'Report details are too long'; end if;
  select count(*)::integer into v_count from public.gomoku_fair_play_reports
  where reporter_user_id=p_reporter_user_id and created_at>now()-interval '24 hours';
  if v_count>=5 then raise exception 'Daily report limit reached'; end if;
  if exists(
    select 1 from public.gomoku_fair_play_reports
    where reporter_user_id=p_reporter_user_id and target_user_id=p_target_user_id
      and category=p_category and created_at>now()-interval '24 hours'
      and coalesce(room_id,'')=coalesce(p_room_id,'')
      and coalesce(game_version,0)=coalesce(p_game_version,0)
  ) then raise exception 'This report was already submitted'; end if;
  if p_room_id is not null and not exists(
    select 1 from public.gomoku_matches
    where room_id=p_room_id and (p_game_version is null or game_version=p_game_version)
      and (black_user_id=p_reporter_user_id or white_user_id=p_reporter_user_id)
      and (black_user_id=p_target_user_id or white_user_id=p_target_user_id)
  ) then raise exception 'Reported match is not a verified shared match'; end if;

  insert into public.gomoku_fair_play_reports(reporter_user_id,target_user_id,target_username,room_id,game_version,category,details)
  values(p_reporter_user_id,p_target_user_id,left(p_target_username,20),nullif(left(coalesce(p_room_id,''),32),''),p_game_version,p_category,left(coalesce(p_details,''),800))
  returning * into r;

  insert into public.gomoku_fair_play_audit_events(event_type,actor_user_id,subject_user_id,room_id,game_version,metadata)
  values('report_submitted',p_reporter_user_id,p_target_user_id,r.room_id,r.game_version,jsonb_build_object('reportId',r.id,'category',r.category));

  return jsonb_build_object('id',r.id,'category',r.category,'status',r.status,'createdAt',r.created_at);
end $$;
revoke all on function public.gomoku_submit_fair_play_report(uuid,uuid,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.gomoku_submit_fair_play_report(uuid,uuid,text,text,text,text,bigint) to service_role;

create or replace function public.gomoku_apply_moderation_action(
  p_subject_user_id uuid,p_action_type text,p_reason text,p_duration_minutes integer default null,p_actor_user_id uuid default null
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare a public.gomoku_moderation_actions%rowtype; v_expires timestamptz;
begin
  if p_subject_user_id is null then raise exception 'Missing subject'; end if;
  if p_action_type not in ('warning','ranked_suspend','challenge_suspend','clear_ranked','clear_challenge','clear_all') then raise exception 'Invalid moderation action'; end if;
  if char_length(coalesce(p_reason,''))<3 or char_length(p_reason)>500 then raise exception 'Moderation reason is invalid'; end if;
  if p_action_type in ('ranked_suspend','challenge_suspend') then
    if p_duration_minutes is null or p_duration_minutes<1 or p_duration_minutes>525600 then raise exception 'Suspension duration is invalid'; end if;
    v_expires:=now()+make_interval(mins=>p_duration_minutes);
  end if;

  insert into public.gomoku_moderation_actions(subject_user_id,actor_user_id,action_type,reason,duration_minutes,expires_at)
  values(p_subject_user_id,p_actor_user_id,p_action_type,p_reason,p_duration_minutes,v_expires)
  returning * into a;

  insert into public.gomoku_player_trust_state(user_id) values(p_subject_user_id) on conflict(user_id) do nothing;

  if p_action_type='ranked_suspend' then
    update public.gomoku_player_trust_state
    set ranked_suspended_until=greatest(coalesce(ranked_suspended_until,'-infinity'::timestamptz),v_expires),
        notice='Ranked access temporarily restricted.',updated_at=now()
    where user_id=p_subject_user_id;
    delete from public.gomoku_matchmaking_queue where user_id=p_subject_user_id;
  elsif p_action_type='challenge_suspend' then
    update public.gomoku_player_trust_state
    set challenges_suspended_until=greatest(coalesce(challenges_suspended_until,'-infinity'::timestamptz),v_expires),
        notice='Direct challenges temporarily restricted.',updated_at=now()
    where user_id=p_subject_user_id;
  elsif p_action_type='clear_ranked' then
    update public.gomoku_player_trust_state set ranked_suspended_until=null,ranked_cooldown_until=null,notice=null,updated_at=now()
    where user_id=p_subject_user_id;
  elsif p_action_type='clear_challenge' then
    update public.gomoku_player_trust_state set challenges_suspended_until=null,notice=null,updated_at=now()
    where user_id=p_subject_user_id;
  elsif p_action_type='clear_all' then
    update public.gomoku_player_trust_state set ranked_suspended_until=null,ranked_cooldown_until=null,challenges_suspended_until=null,notice=null,updated_at=now()
    where user_id=p_subject_user_id;
  end if;

  insert into public.gomoku_fair_play_audit_events(event_type,actor_user_id,subject_user_id,metadata)
  values('moderation_action',p_actor_user_id,p_subject_user_id,jsonb_build_object('actionId',a.id,'action',a.action_type,'expiresAt',a.expires_at));

  return jsonb_build_object('id',a.id,'action',a.action_type,'createdAt',a.created_at,'expiresAt',a.expires_at);
end $$;
revoke all on function public.gomoku_apply_moderation_action(uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.gomoku_apply_moderation_action(uuid,text,text,integer,uuid) to service_role;

create or replace function public.gomoku_record_integrity_signals()
returns trigger
language plpgsql security invoker set search_path=''
as $$
declare v_prev_pair integer:=0; v_loser uuid; v_abandons integer:=0; v_cooldown interval; v_same_winner integer:=0;
begin
  if new.match_mode<>'ranked' or new.black_user_id is null or new.white_user_id is null then return new; end if;

  select count(*)::integer into v_prev_pair
  from public.gomoku_matches m
  where m.match_mode='ranked' and m.completed_at>=new.completed_at-interval '6 hours'
    and (m.room_id,m.game_version)<>(new.room_id,new.game_version)
    and ((m.black_user_id=new.black_user_id and m.white_user_id=new.white_user_id) or (m.black_user_id=new.white_user_id and m.white_user_id=new.black_user_id));

  if new.move_count<=4 and new.result_reason in ('resign','abandon') then
    insert into public.gomoku_match_integrity_flags(room_id,game_version,flag_code,severity,metadata)
    values(new.room_id,new.game_version,'early_ranked_exit',1,jsonb_build_object('moves',new.move_count,'reason',new.result_reason)) on conflict do nothing;
  end if;

  if v_prev_pair>=3 then
    insert into public.gomoku_match_integrity_flags(room_id,game_version,flag_code,severity,metadata)
    values(new.room_id,new.game_version,'repeat_pair',case when v_prev_pair>=5 then 2 else 1 end,jsonb_build_object('pairGames6h',v_prev_pair+1)) on conflict do nothing;
  end if;

  if v_prev_pair>=5 then
    select count(*)::integer into v_same_winner
    from public.gomoku_matches m
    where m.match_mode='ranked' and m.completed_at>=new.completed_at-interval '6 hours'
      and ((m.black_user_id=new.black_user_id and m.white_user_id=new.white_user_id) or (m.black_user_id=new.white_user_id and m.white_user_id=new.black_user_id))
      and (
        (new.winner_color=1 and ((m.black_user_id=new.black_user_id and m.winner_color=1) or (m.white_user_id=new.black_user_id and m.winner_color=2)))
        or (new.winner_color=2 and ((m.black_user_id=new.white_user_id and m.winner_color=1) or (m.white_user_id=new.white_user_id and m.winner_color=2)))
      );
    if v_same_winner>=4 then
      insert into public.gomoku_match_integrity_flags(room_id,game_version,flag_code,severity,metadata)
      values(new.room_id,new.game_version,'rapid_repeat_results',2,jsonb_build_object('sameWinnerGames6h',v_same_winner,'pairGames6h',v_prev_pair+1)) on conflict do nothing;
    end if;
  end if;

  if new.result_reason='abandon' and new.winner_color in (1,2) then
    v_loser:=case when new.winner_color=1 then new.white_user_id else new.black_user_id end;
    select count(*)::integer into v_abandons
    from public.gomoku_matches m
    where m.match_mode='ranked' and m.result_reason='abandon' and m.completed_at>=new.completed_at-interval '24 hours'
      and ((m.white_user_id=v_loser and m.winner_color=1) or (m.black_user_id=v_loser and m.winner_color=2));
    if v_abandons>=3 then
      v_cooldown:=case when v_abandons=3 then interval '15 minutes' when v_abandons=4 then interval '30 minutes' else interval '60 minutes' end;
      insert into public.gomoku_player_trust_state(user_id,ranked_cooldown_until,notice,updated_at)
      values(v_loser,new.completed_at+v_cooldown,'Ranked cooldown after repeated abandonments.',now())
      on conflict(user_id) do update set
        ranked_cooldown_until=greatest(coalesce(public.gomoku_player_trust_state.ranked_cooldown_until,'-infinity'::timestamptz),excluded.ranked_cooldown_until),
        notice=excluded.notice,updated_at=now();
      insert into public.gomoku_match_integrity_flags(room_id,game_version,flag_code,severity,metadata)
      values(new.room_id,new.game_version,'serial_abandon',2,jsonb_build_object('abandons24h',v_abandons,'cooldownMinutes',extract(epoch from v_cooldown)/60)) on conflict do nothing;
      insert into public.gomoku_fair_play_audit_events(event_type,subject_user_id,room_id,game_version,metadata)
      values('ranked_cooldown',v_loser,new.room_id,new.game_version,jsonb_build_object('abandons24h',v_abandons,'until',new.completed_at+v_cooldown));
      delete from public.gomoku_matchmaking_queue where user_id=v_loser;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.gomoku_record_integrity_signals() from public,anon,authenticated;
drop trigger if exists gomoku_p12_integrity_signal_trigger on public.gomoku_matches;
create trigger gomoku_p12_integrity_signal_trigger after insert on public.gomoku_matches for each row execute function public.gomoku_record_integrity_signals();

create or replace function public.gomoku_create_direct_challenge(
  p_challenger_user_id uuid,p_challenged_user_id uuid,p_challenger_username text,p_challenged_username text
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare c public.gomoku_direct_challenges%rowtype; allow_target boolean; pair_key text; v_count integer; v_until timestamptz;
begin
  if p_challenger_user_id is null or p_challenged_user_id is null or p_challenger_user_id=p_challenged_user_id then raise exception 'Invalid challenge target'; end if;
  perform public.gomoku_expire_direct_challenges();
  if public.gomoku_players_blocked(p_challenger_user_id,p_challenged_user_id) then raise exception 'Player interaction is blocked'; end if;
  select challenges_suspended_until into v_until from public.gomoku_player_trust_state where user_id=p_challenger_user_id;
  if v_until is not null and v_until>now() then raise exception 'Direct challenges are temporarily restricted'; end if;
  select count(*)::integer into v_count from public.gomoku_direct_challenges where challenger_user_id=p_challenger_user_id and created_at>now()-interval '10 minutes';
  if v_count>=5 then raise exception 'Challenge rate limit reached'; end if;
  select count(*)::integer into v_count from public.gomoku_direct_challenges
  where challenger_user_id=p_challenger_user_id and challenged_user_id=p_challenged_user_id and created_at>now()-interval '1 hour';
  if v_count>=3 then raise exception 'Challenge cooldown for this player is active'; end if;
  insert into public.gomoku_social_preferences(user_id) values(p_challenged_user_id) on conflict(user_id) do nothing;
  select allow_challenges into allow_target from public.gomoku_social_preferences where user_id=p_challenged_user_id;
  if allow_target is false then raise exception 'Player is not accepting direct challenges'; end if;
  pair_key:=least(p_challenger_user_id::text,p_challenged_user_id::text)||':'||greatest(p_challenger_user_id::text,p_challenged_user_id::text);
  perform pg_advisory_xact_lock(hashtextextended(pair_key,0));
  if exists(select 1 from public.gomoku_direct_challenges where status='pending' and
    ((challenger_user_id=p_challenger_user_id and challenged_user_id=p_challenged_user_id) or (challenger_user_id=p_challenged_user_id and challenged_user_id=p_challenger_user_id)))
  then raise exception 'A challenge is already pending between these players'; end if;
  insert into public.gomoku_direct_challenges(challenger_user_id,challenged_user_id,challenger_username,challenged_username)
  values(p_challenger_user_id,p_challenged_user_id,left(p_challenger_username,20),left(p_challenged_username,20)) returning * into c;
  return jsonb_build_object('id',c.id,'status',c.status,'challenger',c.challenger_username,'challenged',c.challenged_username,'createdAt',c.created_at,'expiresAt',c.expires_at);
end $$;
revoke all on function public.gomoku_create_direct_challenge(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.gomoku_create_direct_challenge(uuid,uuid,text,text) to service_role;

create or replace function public.gomoku_try_matchmaking(
  p_user_id uuid,p_username text,p_history_hash text default null
) returns jsonb
language plpgsql security invoker set search_path=''
as $$
declare
  v_now timestamptz:=now(); v_rating integer; v_queued_at timestamptz; v_wait_seconds integer; v_range integer;
  v_candidate public.gomoku_matchmaking_queue%rowtype; v_candidate_range integer; v_candidate_wait integer;
  v_room_id text; v_flip boolean; v_black public.gomoku_matchmaking_queue%rowtype; v_white public.gomoku_matchmaking_queue%rowtype;
  v_state jsonb; v_restricted_until timestamptz; v_trust public.gomoku_player_trust_state%rowtype;
begin
  if p_user_id is null then raise exception 'Missing user id'; end if;
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'A public player username is required for ranked matchmaking'; end if;
  select * into v_trust from public.gomoku_player_trust_state where user_id=p_user_id;
  v_restricted_until:=greatest(coalesce(v_trust.ranked_cooldown_until,'-infinity'::timestamptz),coalesce(v_trust.ranked_suspended_until,'-infinity'::timestamptz));
  if v_restricted_until>v_now then
    delete from public.gomoku_matchmaking_queue where user_id=p_user_id;
    return jsonb_build_object('status','restricted','restrictedUntil',v_restricted_until,'reason',case when coalesce(v_trust.ranked_suspended_until,'-infinity'::timestamptz)>=v_restricted_until then 'moderation' else 'abandonment_cooldown' end);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  delete from public.gomoku_matchmaking_queue where last_seen<v_now-interval '45 seconds';
  delete from public.gomoku_ranked_active a where not exists(select 1 from public.gomoku_rooms r where r.id=a.room_id);
  select a.room_id into v_room_id from public.gomoku_ranked_active a where a.user_id=p_user_id;
  if v_room_id is not null then
    delete from public.gomoku_matchmaking_queue where user_id=p_user_id;
    select rating into v_rating from public.gomoku_ratings where user_id=p_user_id;
    return jsonb_build_object('status','matched','roomId',v_room_id,'rating',coalesce(v_rating,1500));
  end if;
  insert into public.gomoku_ratings(user_id) values(p_user_id) on conflict(user_id) do nothing;
  select rating into v_rating from public.gomoku_ratings where user_id=p_user_id;
  insert into public.gomoku_matchmaking_queue(user_id,username,rating_snapshot,history_hash,queued_at,last_seen)
  values(p_user_id,p_username,v_rating,p_history_hash,v_now,v_now)
  on conflict(user_id) do update set username=excluded.username,rating_snapshot=excluded.rating_snapshot,history_hash=excluded.history_hash,last_seen=excluded.last_seen;
  select queued_at into v_queued_at from public.gomoku_matchmaking_queue where user_id=p_user_id for update;
  v_wait_seconds:=greatest(0,floor(extract(epoch from (v_now-v_queued_at)))::integer);
  v_range:=least(500,100+(v_wait_seconds/10)*50);

  select q.* into v_candidate
  from public.gomoku_matchmaking_queue q
  where q.user_id<>p_user_id and q.last_seen>=v_now-interval '45 seconds'
    and abs(q.rating_snapshot-v_rating)<=greatest(v_range,least(500,100+(greatest(0,floor(extract(epoch from (v_now-q.queued_at)))::integer)/10)*50))
    and not exists(select 1 from public.gomoku_ranked_active a where a.user_id=q.user_id)
    and not public.gomoku_players_blocked(p_user_id,q.user_id)
    and not exists(select 1 from public.gomoku_player_trust_state ts where ts.user_id=q.user_id and greatest(coalesce(ts.ranked_cooldown_until,'-infinity'::timestamptz),coalesce(ts.ranked_suspended_until,'-infinity'::timestamptz))>v_now)
    and (
      v_wait_seconds>=60 or greatest(0,floor(extract(epoch from (v_now-q.queued_at)))::integer)>=60
      or not exists(
        select 1 from public.gomoku_matches m where m.match_mode='ranked' and m.completed_at>v_now-interval '20 minutes'
          and ((m.black_user_id=p_user_id and m.white_user_id=q.user_id) or (m.black_user_id=q.user_id and m.white_user_id=p_user_id))
      )
    )
  order by abs(q.rating_snapshot-v_rating),q.queued_at,q.user_id
  for update skip locked limit 1;

  if v_candidate.user_id is null then
    return jsonb_build_object('status','queued','rating',v_rating,'waitSeconds',v_wait_seconds,'searchRange',v_range,'queuedAt',v_queued_at);
  end if;

  v_candidate_wait:=greatest(0,floor(extract(epoch from (v_now-v_candidate.queued_at)))::integer);
  v_candidate_range:=least(500,100+(v_candidate_wait/10)*50);
  v_room_id:='RANK-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  v_flip:=random()<0.5;
  if v_flip then select * into v_black from public.gomoku_matchmaking_queue where user_id=p_user_id; v_white:=v_candidate;
  else v_black:=v_candidate; select * into v_white from public.gomoku_matchmaking_queue where user_id=p_user_id; end if;

  v_state:=jsonb_build_object(
    'version',12,'mode','ranked','ranked',true,'round',1,'gameVersion',1,'roundStartedAt',v_now,'completedMatch',null,'rule','renju-practice',
    'players',jsonb_build_array(
      jsonb_build_object('seat',1,'name',v_black.username,'color',1,'joinedAt',v_now,'historyHash',coalesce(v_black.history_hash,''),'userId',v_black.user_id,'profileUsername',v_black.username),
      jsonb_build_object('seat',2,'name',v_white.username,'color',2,'joinedAt',v_now,'historyHash',coalesce(v_white.history_hash,''),'userId',v_white.user_id,'profileUsername',v_white.username)
    ),
    'game',jsonb_build_object('moves',jsonb_build_array(),'result',null,'terminal',null),
    'drawOffer',null,'drawNotice',null,'rematch',jsonb_build_array(),'rematchNotice',null,'undoRequest',null,'undoNotice',null,
    'lifecycle',jsonb_build_object('type','matched','at',v_now),'chat',jsonb_build_array(),'recentCommands',jsonb_build_array(),'actionGuard',jsonb_build_object()
  );
  insert into public.gomoku_rooms(id,created_at,updated_at,expires_at,revision,host_token_hash,guest_token_hash,password_salt,password_hash,state)
  values(v_room_id,v_now,v_now,v_now+interval '24 hours',0,null,null,null,null,v_state);
  insert into public.gomoku_ranked_active(user_id,room_id,opponent_user_id,created_at)
  values(v_black.user_id,v_room_id,v_white.user_id,v_now),(v_white.user_id,v_room_id,v_black.user_id,v_now);
  delete from public.gomoku_matchmaking_queue where user_id in (v_black.user_id,v_white.user_id);
  return jsonb_build_object('status','matched','roomId',v_room_id,'rating',v_rating,'opponent',jsonb_build_object('username',v_candidate.username,'rating',v_candidate.rating_snapshot),'searchRange',greatest(v_range,v_candidate_range));
end $$;
revoke all on function public.gomoku_try_matchmaking(uuid,text,text) from public,anon,authenticated;
grant execute on function public.gomoku_try_matchmaking(uuid,text,text) to service_role;

create or replace function public.gomoku_apply_ranked_result()
returns trigger
language plpgsql security invoker set search_path=''
as $$
declare
  v_black_rating integer; v_white_rating integer; v_black_games integer; v_white_games integer;
  v_expected_black numeric; v_score_black numeric; v_base_k integer; v_k integer; v_delta integer;
  v_black_after integer; v_white_after integer; v_pair_recent integer:=0; v_level text:='none';
begin
  if new.rated is not true or new.match_mode<>'ranked' then return new; end if;
  if new.black_user_id is null or new.white_user_id is null or new.black_user_id=new.white_user_id then raise exception 'Ranked result requires two distinct verified players'; end if;
  if exists(select 1 from public.gomoku_rating_events where room_id=new.room_id and game_version=new.game_version) then return new; end if;
  insert into public.gomoku_ratings(user_id) values(new.black_user_id),(new.white_user_id) on conflict(user_id) do nothing;
  perform 1 from public.gomoku_ratings where user_id in (new.black_user_id,new.white_user_id) order by user_id for update;
  select rating,games into v_black_rating,v_black_games from public.gomoku_ratings where user_id=new.black_user_id;
  select rating,games into v_white_rating,v_white_games from public.gomoku_ratings where user_id=new.white_user_id;
  v_base_k:=case when least(v_black_games,v_white_games)<10 then 40 when least(v_black_games,v_white_games)<30 then 32 else 24 end;
  select count(*)::integer into v_pair_recent
  from public.gomoku_rating_events e
  where e.created_at>=new.completed_at-interval '6 hours'
    and ((e.black_user_id=new.black_user_id and e.white_user_id=new.white_user_id) or (e.black_user_id=new.white_user_id and e.white_user_id=new.black_user_id));

  if v_pair_recent>=5 then v_k:=greatest(1,round(v_base_k*0.10)::integer);v_level:='minimal';
  elsif v_pair_recent>=3 then v_k:=greatest(1,round(v_base_k*0.50)::integer);v_level:='reduced';
  else v_k:=v_base_k;v_level:='none'; end if;

  v_expected_black:=1.0/(1.0+power(10.0,(v_white_rating-v_black_rating)/400.0));
  v_score_black:=case new.winner_color when 1 then 1.0 when 2 then 0.0 else 0.5 end;
  v_delta:=round(v_k*(v_score_black-v_expected_black))::integer;
  v_black_after:=greatest(100,v_black_rating+v_delta);
  v_white_after:=greatest(100,v_white_rating-v_delta);

  update public.gomoku_ratings set rating=v_black_after,peak_rating=greatest(peak_rating,v_black_after),games=games+1,
    wins=wins+case when new.winner_color=1 then 1 else 0 end,draws=draws+case when new.winner_color=0 then 1 else 0 end,
    losses=losses+case when new.winner_color=2 then 1 else 0 end,last_played_at=new.completed_at,updated_at=now()
  where user_id=new.black_user_id;
  update public.gomoku_ratings set rating=v_white_after,peak_rating=greatest(peak_rating,v_white_after),games=games+1,
    wins=wins+case when new.winner_color=2 then 1 else 0 end,draws=draws+case when new.winner_color=0 then 1 else 0 end,
    losses=losses+case when new.winner_color=1 then 1 else 0 end,last_played_at=new.completed_at,updated_at=now()
  where user_id=new.white_user_id;

  insert into public.gomoku_rating_events(room_id,game_version,black_user_id,white_user_id,winner_color,k_factor,black_before,black_after,black_delta,white_before,white_after,white_delta)
  values(new.room_id,new.game_version,new.black_user_id,new.white_user_id,new.winner_color,v_k,v_black_rating,v_black_after,v_black_after-v_black_rating,v_white_rating,v_white_after,v_white_after-v_white_rating);
  insert into public.gomoku_rating_protections(room_id,game_version,pair_games_6h,base_k_factor,effective_k_factor,protection_level)
  values(new.room_id,new.game_version,v_pair_recent+1,v_base_k,v_k,v_level) on conflict(room_id,game_version) do nothing;
  if v_level<>'none' then
    insert into public.gomoku_fair_play_audit_events(event_type,room_id,game_version,metadata)
    values('rating_protection',new.room_id,new.game_version,jsonb_build_object('pairGames6h',v_pair_recent+1,'baseK',v_base_k,'effectiveK',v_k,'level',v_level));
  end if;
  update public.gomoku_matches set black_rating_before=v_black_rating,black_rating_after=v_black_after,white_rating_before=v_white_rating,white_rating_after=v_white_after
  where room_id=new.room_id and game_version=new.game_version;
  delete from public.gomoku_ranked_active where user_id in (new.black_user_id,new.white_user_id);
  return new;
end $$;
revoke all on function public.gomoku_apply_ranked_result() from public,anon,authenticated;

comment on table public.gomoku_fair_play_reports is 'Player-submitted reports for review. Reports never automatically sanction the reported player.';
comment on table public.gomoku_match_integrity_flags is 'Server-generated review signals based on objective match patterns; flags are not guilt determinations.';
comment on table public.gomoku_rating_protections is 'Transparent K-factor protection against repeated same-pair rating farming.';
comment on table public.gomoku_player_trust_state is 'Temporary objective cooldowns and explicit moderator restrictions; no opaque trust score.';
