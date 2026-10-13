-- E6 SOURCE ONLY: strictly owner-scoped match command receipts and single-transaction CAS.
-- Depends on unapplied E2 + E4 migrations. No Elo activation, PvP changes or deployment.
-- The original match row remains the ONLY game/transcript authority; these rows
-- record command identities only, not a second game or rating store.

alter table public.gomoku_bot_matches
  add column if not exists transcript_sha256 text,
  add column if not exists abandoned_at timestamptz;
alter table public.gomoku_bot_matches
  add constraint gomoku_bot_e6_transcript_sha_format
    check (transcript_sha256 is null or transcript_sha256 ~ '^[a-f0-9]{64}$');
alter table public.gomoku_bot_matches
  drop constraint if exists gomoku_bot_matches_status_check;
alter table public.gomoku_bot_matches
  add constraint gomoku_bot_matches_status_check
    check (status in ('active','completed','resigned','abandoned'));
alter table public.gomoku_bot_matches
  add constraint gomoku_bot_e6_abandon_consistency check (
    (status='abandoned' and abandoned_at is not null and result->>'reason' in ('idle-expiry','user-abandoned')
       and (result->>'winner')::integer=0)
    or (status<>'abandoned' and abandoned_at is null)
  );

create table if not exists public.gomoku_bot_match_commands (
  match_id uuid not null references public.gomoku_bot_matches(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  command_id text not null check(command_id ~ '^[A-Za-z0-9._:-]{8,96}$'),
  request_sha256 text not null check(request_sha256 ~ '^[a-f0-9]{64}$'),
  expected_revision bigint not null check(expected_revision>=0),
  applied_revision bigint not null check(applied_revision=expected_revision+1),
  applied_at timestamptz not null default now(),
  primary key(match_id,command_id)
);
create index if not exists gomoku_bot_e6_commands_owner
  on public.gomoku_bot_match_commands(owner_user_id,applied_at desc);
alter table public.gomoku_bot_match_commands enable row level security;
revoke all on public.gomoku_bot_match_commands from public,anon,authenticated;
grant select,insert on public.gomoku_bot_match_commands to service_role;

-- Immutable command receipts. Reuse E4's immutable-event trigger, never
-- introduce another rating ledger or authoritative match writer.
create trigger gomoku_bot_e6_command_receipts_immutable
  before update or delete on public.gomoku_bot_match_commands
  for each row execute function public.gomoku_bot_e4_deny_ledger_mutation();

-- All existing/missing command identity checks and transcript replacement occur
-- under ONE owner-scoped row lock. A retry after a successful move returns the
-- current authoritative match; it cannot replay the move or create another Elo
-- event, even after subsequent commands have been committed.
create or replace function public.gomoku_bot_e6_commit_action(
 p_owner uuid,p_match uuid,p_command text,p_request_hash text,
 p_revision bigint,p_action text,p_moves jsonb,p_status text,
 p_result jsonb,p_digest text,p_completed_at timestamptz default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  m public.gomoku_bot_matches%rowtype;
  old public.gomoku_bot_match_commands%rowtype;
  prior_count integer;
  next_count integer;
  old_player integer;
  human jsonb;
  reply jsonb;
begin
  if p_owner is null or p_match is null
     or p_command !~ '^[A-Za-z0-9._:-]{8,96}$'
     or p_request_hash !~ '^[a-f0-9]{64}$'
     or p_digest !~ '^[a-f0-9]{64}$'
     or p_revision is null or p_revision<0
     or p_action not in ('move','resign')
     or p_status not in ('active','completed','resigned')
     or jsonb_typeof(p_moves)<>'array' or jsonb_array_length(p_moves)>227 then
    raise exception 'Invalid verified bot action commitment' using errcode='22023';
  end if;
  select * into m from public.gomoku_bot_matches
   where id=p_match and owner_user_id=p_owner for update;
  if not found then raise exception 'Bot match not found or not owned' using errcode='42501';end if;
  select * into old from public.gomoku_bot_match_commands
   where match_id=p_match and command_id=p_command and owner_user_id=p_owner;
  if found then
    if old.request_sha256<>p_request_hash then
      return jsonb_build_object('status','command-mismatch','match',to_jsonb(m));
    end if;
    return jsonb_build_object('status','already-applied','match',to_jsonb(m),
      'appliedRevision',old.applied_revision);
  end if;
  if m.status<>'active' or m.revision<>p_revision then
    return jsonb_build_object('status','conflict','match',to_jsonb(m));
  end if;
  if m.ruleset<>'renju-practice' or
     m.bot_snapshot->>'policy'<>'studio-native-search/e2.1' then
     raise exception 'Bot Elo original-policy provenance mismatch' using errcode='22023';
  end if;
  prior_count:=jsonb_array_length(m.moves);
  next_count:=jsonb_array_length(p_moves);
  if p_moves->0 is distinct from m.moves->0 and prior_count>0 then
    raise exception 'Match prefix replaced' using errcode='22023';
  end if;
  if p_moves->0 is null and prior_count>0 then
    raise exception 'Previous moves removed' using errcode='22023';
  end if;
  if (select coalesce(jsonb_agg(x.value order by x.ordinality),'[]'::jsonb)
      from jsonb_array_elements(p_moves) with ordinality as x(value,ordinality)
      where x.ordinality<=prior_count) <> m.moves then
    raise exception 'Authoritative match transcript is not append-only' using errcode='22023';
  end if;
  if p_action='resign' then
    if p_status<>'resigned' or p_moves<>m.moves
       or p_result->>'reason'<>'resign'
       or (p_result->>'winner')::integer<>3-m.player_color then
      raise exception 'Invalid verified resignation' using errcode='22023';
    end if;
  else
    if next_count not between prior_count+1 and prior_count+2 then
      raise exception 'A move must append one human move and at most one bot reply' using errcode='22023';
    end if;
    old_player:=mod(prior_count,2)+1;
    if old_player<>m.player_color then
      raise exception 'Human played outside their turn' using errcode='22023';
    end if;
    human:=p_moves->prior_count;
    if (human->>'actor')<>'player' or (human->>'color')::integer<>m.player_color or
       (human->>'i')::integer not between -1 and 224 then
       raise exception 'A verified human move is missing' using errcode='22023';
    end if;
    if next_count=prior_count+2 then
      reply:=p_moves->(prior_count+1);
      if (reply->>'actor')<>'bot' or (reply->>'color')::integer<>3-m.player_color or
         (reply->>'i')::integer not between -1 and 224 or
         (reply->'decision'->>'policy')<>'studio-native-search/e2.1' then
         raise exception 'A verified server-owned bot decision is missing' using errcode='22023';
      end if;
    end if;
    if p_status='resigned' then
      raise exception 'Move cannot change match to resigned' using errcode='22023';
    end if;
    if (p_status='active' and (p_result is not null or p_completed_at is not null)) or
       (p_status='completed' and (p_result is null or p_completed_at is null)) then
      raise exception 'Terminal state and game result disagree' using errcode='22023';
    end if;
  end if;
  if p_status='resigned' and p_completed_at is null then
    raise exception 'Resignation completion time is required' using errcode='22023';
  end if;
  update public.gomoku_bot_matches set
    moves=p_moves,status=p_status,result=p_result,
    revision=m.revision+1,last_command_id=p_command,
    transcript_sha256=p_digest,completed_at=p_completed_at,
    updated_at=now()
   where id=p_match and owner_user_id=p_owner returning * into m;
  insert into public.gomoku_bot_match_commands(
    match_id,owner_user_id,command_id,request_sha256,expected_revision,applied_revision
  ) values (p_match,p_owner,p_command,p_request_hash,p_revision,m.revision);
  return jsonb_build_object('status','applied','match',to_jsonb(m),
    'appliedRevision',m.revision);
end;
$$;

-- Explicit idle lifecycle. Expiry never forfeits or awards Elo; it preserves
-- owner-private move history and terminates the active match with no winner.
-- Uses an absolute 30-day inactivity policy based on the server timestamp.
create or replace function public.gomoku_bot_e6_expire_idle(p_owner uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if p_owner is null then raise exception 'Missing verified owner' using errcode='22023';end if;
 update public.gomoku_bot_matches set
   status='abandoned',result='{"winner":0,"reason":"idle-expiry"}'::jsonb,
   completed_at=now(),abandoned_at=now(),updated_at=now(),
   revision=revision+1
 where owner_user_id=p_owner and status='active'
   and coalesce(rating_admission->>'rated','false')<>'true'
   and updated_at<now()-interval '30 days';
 get diagnostics changed=row_count;
 return changed;
end;
$$;
-- Explicit leave is restricted to PRACTICE matches. A pre-admitted rated game
-- can only finish by a verified outcome/resignation; never erase an Elo loss.
create or replace function public.gomoku_bot_e6_abandon_practice(
  p_owner uuid,p_match uuid
) returns jsonb language plpgsql security definer set search_path='' as $
declare m public.gomoku_bot_matches%rowtype;
begin
  if p_owner is null or p_match is null then
    raise exception 'Missing verified owner or game id' using errcode='22023';
  end if;
  select * into m from public.gomoku_bot_matches
    where owner_user_id=p_owner and id=p_match for update;
  if not found then raise exception 'Bot match not found' using errcode='42501';end if;
  if m.status<>'active' then
    return jsonb_build_object('status','already-closed','match',to_jsonb(m));
  end if;
  if coalesce(m.rating_admission->>'rated','false')='true' then
    return jsonb_build_object('status','rated-resignation-required','match',to_jsonb(m));
  end if;
  update public.gomoku_bot_matches set
    status='abandoned',result='{"winner":0,"reason":"user-abandoned"}'::jsonb,
    abandoned_at=now(),completed_at=now(),updated_at=now(),revision=m.revision+1
   where owner_user_id=p_owner and id=p_match returning * into m;
  return jsonb_build_object('status','abandoned','match',to_jsonb(m));
end;
$;
revoke all on function public.gomoku_bot_e6_commit_action(
 uuid,uuid,text,text,bigint,text,jsonb,text,jsonb,text,timestamptz)
 from public,anon,authenticated;
revoke all on function public.gomoku_bot_e6_expire_idle(uuid),
 public.gomoku_bot_e6_abandon_practice(uuid,uuid)
 from public,anon,authenticated;
grant execute on function public.gomoku_bot_e6_commit_action(
 uuid,uuid,text,text,bigint,text,jsonb,text,jsonb,text,timestamptz),
 public.gomoku_bot_e6_expire_idle(uuid),
 public.gomoku_bot_e6_abandon_practice(uuid,uuid) to service_role;

comment on table public.gomoku_bot_match_commands is
 'Immutable owner-private command IDs for atomic, retry-safe verified E2 bot turns. No rating or game state duplicate.';
