-- E4 SOURCE ONLY. Requires the unapplied E2 custody migration before this migration.
-- Zero calibration releases are seeded and the explicit activation switch is FALSE.
-- No Elo awards can occur from these definitions alone.
-- All writers are existing trusted gomoku-room service-role calls after THIEPN Account validation.

alter table public.gomoku_bot_matches
  add column if not exists rating_admission jsonb not null
    default '{"schema":"bot-elo-admission/v1","rated":false,"reason":"legacy-unrated"}'::jsonb,
  add column if not exists rating_settled_at timestamptz;
alter table public.gomoku_bot_matches
  add constraint gomoku_bot_e4_admission_object check (jsonb_typeof(rating_admission)='object');

create table if not exists public.gomoku_bot_rating_controls (
  singleton boolean primary key default true check (singleton=true),
  enabled boolean not null default false,
  active_release_id text,
  updated_at timestamptz not null default now(),
  check ((enabled=false) or (active_release_id is not null))
);
insert into public.gomoku_bot_rating_controls(singleton,enabled,active_release_id)
values(true,false,null) on conflict (singleton) do nothing;

create table if not exists public.gomoku_bot_rating_releases (
  release_id text primary key check (release_id ~ '^[a-z][a-z0-9_.-]{2,63}$'),
  schema_version text not null default 'gomoku-bot-calibration-assignment/1.0.0',
  policy_id text not null check (policy_id='studio-native-search/e2.1'),
  ruleset text not null default 'renju-practice' check (ruleset='renju-practice'),
  source_experiment_id text not null check (source_experiment_id ~ '^[0-9a-f]{64}$'),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  approved_manifest_sha256 text not null check (approved_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  reviewer text not null check (length(trim(reviewer))>=3),
  review_rationale text not null check (length(trim(review_rationale))>=80),
  review_approved_at timestamptz not null,
  calibration_complete boolean not null check(calibration_complete=true),
  bot_ratings_milli jsonb not null check (jsonb_typeof(bot_ratings_milli)='object'),
  created_at timestamptz not null default now()
);
-- A reviewed assignment is evidence, not an automatic license to award Elo.
-- The separate activation switch is intentionally disabled and has no public setter.
alter table public.gomoku_bot_rating_controls
  add constraint gomoku_bot_e4_release_fk
  foreign key (active_release_id) references public.gomoku_bot_rating_releases(release_id);

create table if not exists public.gomoku_bot_rating_profiles (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  ruleset text not null default 'renju-practice' check(ruleset='renju-practice'),
  rating_milli bigint not null default 1200000 check(rating_milli between 400000 and 10000000),
  peak_rating_milli bigint not null default 1200000 check(peak_rating_milli between 400000 and 10000000),
  rated_games integer not null default 0 check(rated_games>=0),
  wins integer not null default 0 check(wins>=0),
  draws integer not null default 0 check(draws>=0),
  losses integer not null default 0 check(losses>=0),
  last_release_id text references public.gomoku_bot_rating_releases(release_id),
  last_played_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(owner_user_id,ruleset),
  check(rated_games=wins+draws+losses),
  check(peak_rating_milli>=rating_milli)
);

create table if not exists public.gomoku_bot_rating_events (
  event_id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.gomoku_bot_matches(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  ruleset text not null default 'renju-practice' check(ruleset='renju-practice'),
  bot_id text not null check(bot_id in ('first','beg','club','mid','advanced','high','expert','maximum')),
  release_id text not null references public.gomoku_bot_rating_releases(release_id),
  release_sha256 text not null,
  policy_id text not null check(policy_id='studio-native-search/e2.1'),
  score numeric(2,1) not null check(score in (0,0.5,1)),
  k_factor integer not null check(k_factor in (16,24,40)),
  rating_before_milli bigint not null,
  bot_rating_milli bigint not null,
  expected_score numeric(12,9) not null check(expected_score>=0 and expected_score<=1),
  delta_milli bigint not null,
  rating_after_milli bigint not null,
  game_number integer not null check(game_number>=1),
  completed_at timestamptz not null,
  applied_at timestamptz not null default now(),
  check(rating_after_milli=rating_before_milli+delta_milli)
);
create index if not exists gomoku_bot_e4_events_owner_history
  on public.gomoku_bot_rating_events(owner_user_id,applied_at desc,event_id desc);

-- No public access to new owner-private records. Edge Function uses existing
-- verifiedAccount and service-role REST only; do not expose unrestricted client RLS writers.
alter table public.gomoku_bot_rating_controls enable row level security;
alter table public.gomoku_bot_rating_releases enable row level security;
alter table public.gomoku_bot_rating_profiles enable row level security;
alter table public.gomoku_bot_rating_events enable row level security;
revoke all on public.gomoku_bot_rating_controls,public.gomoku_bot_rating_releases,
  public.gomoku_bot_rating_profiles,public.gomoku_bot_rating_events
  from public,anon,authenticated;
grant select,insert,update,delete on public.gomoku_bot_rating_controls,
  public.gomoku_bot_rating_releases,public.gomoku_bot_rating_profiles to service_role;
grant select,insert on public.gomoku_bot_rating_events to service_role;

-- Independently reject attempts to alter or delete historical settlements.
create or replace function public.gomoku_bot_e4_deny_ledger_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Bot Elo events are immutable (append-only)' using errcode='55000';
end;
$$;
create trigger gomoku_bot_e4_ledger_immutable
  before update or delete on public.gomoku_bot_rating_events
  for each row execute function public.gomoku_bot_e4_deny_ledger_mutation();

-- Frozen admission is created BEFORE the E2 match is inserted, from the verified
-- account, the approved server release, and the current locked owner profile.
-- Returns a clearly unrated marker if E4 is not explicitly activated.
create or replace function public.gomoku_bot_e4_prepare_admission(
  p_owner uuid,p_bot_id text,p_ruleset text,p_policy text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  ctl public.gomoku_bot_rating_controls%rowtype;
  rel public.gomoku_bot_rating_releases%rowtype;
  p public.gomoku_bot_rating_profiles%rowtype;
  bot_milli bigint;
  n numeric;
  k integer;
  possible_win bigint;
  reason text;
begin
  if p_owner is null or p_bot_id not in
    ('first','beg','club','mid','advanced','high','expert','maximum')
    or p_ruleset<>'renju-practice' or p_policy<>'studio-native-search/e2.1' then
      raise exception 'Invalid Bot Elo admission request' using errcode='22023';
  end if;
  select * into ctl from public.gomoku_bot_rating_controls where singleton=true;
  if not found or ctl.enabled is not true or ctl.active_release_id is null then
    return jsonb_build_object('schema','bot-elo-admission/v1','rated',false,
      'reason','calibration-not-activated','botId',p_bot_id,'ruleset',p_ruleset,
      'policy',p_policy);
  end if;
  select * into rel from public.gomoku_bot_rating_releases
    where release_id=ctl.active_release_id and calibration_complete=true
    and policy_id=p_policy and ruleset=p_ruleset;
  if not found then
    return jsonb_build_object('schema','bot-elo-admission/v1','rated',false,
      'reason','no-authorized-release','botId',p_bot_id);
  end if;
  if not(rel.bot_ratings_milli ? p_bot_id)
    or (rel.bot_ratings_milli->>p_bot_id) !~ '^[0-9]{6,7}$' then
    raise exception 'Reviewed calibration is missing a valid bot rating' using errcode='22023';
  end if;
  bot_milli:=(rel.bot_ratings_milli->>p_bot_id)::bigint;
  if bot_milli not between 400000 and 6000000 then
    raise exception 'Reviewed calibration bot rating is out of range' using errcode='22023';
  end if;
  insert into public.gomoku_bot_rating_profiles(owner_user_id,ruleset)
    values(p_owner,p_ruleset) on conflict(owner_user_id,ruleset) do nothing;
  select * into p from public.gomoku_bot_rating_profiles
    where owner_user_id=p_owner and ruleset=p_ruleset for update;
  if not found then raise exception 'Bot Elo rating profile unavailable';end if;
  k:=case when p.rated_games<20 then 40 when p.rated_games<100 then 24 else 16 end;
  n:=1/(1+power(10::numeric,(bot_milli-p.rating_milli)::numeric/400000));
  possible_win:=round(1000*k*(1-n))::bigint;
  reason:=case
    when p.rating_milli-bot_milli>=400000 then 'opponent-below-eligibility'
    when p.rating_milli+possible_win>bot_milli+400000 then 'win-would-exceed-ceiling'
    else null end;
  if reason is not null then
    return jsonb_build_object('schema','bot-elo-admission/v1','rated',false,
      'reason',reason,'botId',p_bot_id,'releaseId',rel.release_id,
      'ratingBeforeMilli',p.rating_milli,'botRatingMilli',bot_milli,'kFactor',k);
  end if;
  return jsonb_build_object('schema','bot-elo-admission/v1','rated',true,
    'reason','eligible','ownerUserId',p_owner,'botId',p_bot_id,
    'ruleset',p_ruleset,'policy',p_policy,
    'releaseId',rel.release_id,'releaseSha256',rel.approved_manifest_sha256,
    'ratingBeforeMilli',p.rating_milli,'botRatingMilli',bot_milli,
    'kFactor',k,'ratedGamesBefore',p.rated_games,'expectedScore',round(n,9),
    'maxWinDeltaMilli',possible_win,'ceilingMilli',bot_milli+400000);
end;
$$;

-- Entire settlement occurs in ONE PostgreSQL transaction. Row locks serialize
-- requests; UNIQUE(match_id) prevents duplicate credit even on retries.
create or replace function public.gomoku_bot_e4_settle(
  p_owner uuid,p_match uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  m public.gomoku_bot_matches%rowtype;
  existing public.gomoku_bot_rating_events%rowtype;
  ctl public.gomoku_bot_rating_controls%rowtype;
  rel public.gomoku_bot_rating_releases%rowtype;
  p public.gomoku_bot_rating_profiles%rowtype;
  adm jsonb;
  k integer;
  bot_milli bigint;
  expected numeric;
  outcome numeric;
  change_milli bigint;
  new_milli bigint;
  event public.gomoku_bot_rating_events%rowtype;
  win_color integer;
begin
  if p_owner is null or p_match is null then
    raise exception 'Missing verified owner or match id' using errcode='22023';
  end if;
  select * into m from public.gomoku_bot_matches
    where id=p_match and owner_user_id=p_owner for update;
  if not found then raise exception 'Bot match is not owned by account' using errcode='42501';end if;
  select * into existing from public.gomoku_bot_rating_events where match_id=p_match;
  if found then
    return jsonb_build_object('status','already-settled','settled',true,
      'eventId',existing.event_id,'deltaMilli',existing.delta_milli,
      'ratingAfterMilli',existing.rating_after_milli);
  end if;
  adm:=m.rating_admission;
  if coalesce(adm->>'schema','')<>'bot-elo-admission/v1' or
     coalesce(adm->>'rated','false')<>'true' then
    return jsonb_build_object('status','not-rated','settled',false,
      'reason',coalesce(adm->>'reason','admission-not-rated'));
  end if;
  if m.status not in ('completed','resigned') or m.result is null or m.completed_at is null then
    return jsonb_build_object('status','pending-game','settled',false);
  end if;
  if coalesce(m.bot_snapshot->>'verifiedServerMoves','false')<>'true'
     or coalesce(m.bot_snapshot->>'policy','')<>'studio-native-search/e2.1'
     or coalesce(m.bot_snapshot->>'rated','false')<>'false'
     or m.ruleset<>'renju-practice'
     or adm->>'ownerUserId'<>p_owner::text
     or adm->>'botId'<>m.bot_id or adm->>'policy'<>m.bot_snapshot->>'policy' then
     raise exception 'Bot Elo admission and trusted match provenance disagree' using errcode='22023';
  end if;
  select * into ctl from public.gomoku_bot_rating_controls where singleton=true for share;
  if not found or ctl.enabled is not true or ctl.active_release_id is null
      or ctl.active_release_id<>adm->>'releaseId' then
    return jsonb_build_object('status','blocked-by-release','settled',false);
  end if;
  select * into rel from public.gomoku_bot_rating_releases
   where release_id=ctl.active_release_id and calibration_complete=true;
  if not found or rel.approved_manifest_sha256<>adm->>'releaseSha256' then
    return jsonb_build_object('status','invalid-or-replaced-release','settled',false);
  end if;
  if not(rel.bot_ratings_milli ? m.bot_id) or
      rel.bot_ratings_milli->>m.bot_id <> adm->>'botRatingMilli' then
    raise exception 'Bot Elo calibration changed since admission' using errcode='22023';
  end if;
  select * into p from public.gomoku_bot_rating_profiles
    where owner_user_id=p_owner and ruleset=m.ruleset for update;
  if not found then return jsonb_build_object('status','missing-profile','settled',false);end if;
  if p.rating_milli<> (adm->>'ratingBeforeMilli')::bigint
      or p.rated_games<>(adm->>'ratedGamesBefore')::int then
    return jsonb_build_object('status','stale-admission','settled',false);
  end if;
  bot_milli:=(adm->>'botRatingMilli')::bigint;
  k:=(adm->>'kFactor')::integer;
  if k<>case when p.rated_games<20 then 40 when p.rated_games<100 then 24 else 16 end
     or p.rating_milli-bot_milli>=400000 then
     raise exception 'Bot Elo pre-match eligibility was inconsistent' using errcode='22023';
  end if;
  expected:=1/(1+power(10::numeric,(bot_milli-p.rating_milli)::numeric/400000));
  if p.rating_milli+round(1000*k*(1-expected))::bigint>bot_milli+400000 then
    raise exception 'Bot Elo ceiling disallows settlement' using errcode='22023';
  end if;
  win_color:=(m.result->>'winner')::integer;
  if win_color not in (0,1,2) then raise exception 'Invalid server-verified match winner';end if;
  if m.status='resigned' and (m.result->>'reason'<>'resign'
        or win_color<>3-m.player_color) then
    raise exception 'Invalid resign outcome' using errcode='22023';
  end if;
  outcome:=case when win_color=0 then 0.5 when win_color=m.player_color then 1 else 0 end;
  change_milli:=round(1000*k*(outcome-expected))::bigint;
  new_milli:=greatest(400000,p.rating_milli+change_milli);
  change_milli:=new_milli-p.rating_milli;
  insert into public.gomoku_bot_rating_events(
    match_id,owner_user_id,ruleset,bot_id,release_id,release_sha256,policy_id,
    score,k_factor,rating_before_milli,bot_rating_milli,expected_score,
    delta_milli,rating_after_milli,game_number,completed_at
  ) values (
    m.id,p_owner,m.ruleset,m.bot_id,rel.release_id,rel.approved_manifest_sha256,
    rel.policy_id,outcome,k,p.rating_milli,bot_milli,round(expected,9),
    change_milli,new_milli,p.rated_games+1,m.completed_at
  ) returning * into event;
  update public.gomoku_bot_rating_profiles set
    rating_milli=new_milli,peak_rating_milli=greatest(peak_rating_milli,new_milli),
    rated_games=rated_games+1,
    wins=wins+(case when outcome=1 then 1 else 0 end),
    draws=draws+(case when outcome=0.5 then 1 else 0 end),
    losses=losses+(case when outcome=0 then 1 else 0 end),
    last_release_id=rel.release_id,last_played_at=m.completed_at,updated_at=now()
  where owner_user_id=p_owner and ruleset=m.ruleset;
  update public.gomoku_bot_matches set rating_settled_at=now()
    where id=m.id and owner_user_id=p_owner;
  return jsonb_build_object('status','settled','settled',true,
    'eventId',event.event_id,'deltaMilli',change_milli,
    'ratingAfterMilli',new_milli,'releaseId',rel.release_id);
end;
$$;
revoke all on function public.gomoku_bot_e4_prepare_admission(uuid,text,text,text)
  from public,anon,authenticated;
revoke all on function public.gomoku_bot_e4_settle(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.gomoku_bot_e4_prepare_admission(uuid,text,text,text),
  public.gomoku_bot_e4_settle(uuid,uuid) to service_role;

comment on table public.gomoku_bot_rating_events is
  'Separate immutable, server-only owner-scoped Bot Elo ledger. No human PvP integration.';
comment on table public.gomoku_bot_rating_controls is
  'E4 source defaults to disabled; an explicitly reviewed calibrated policy must be activated separately.';
