-- P21 — Load, Concurrency, Chaos & Capacity Certification
-- Makes the GitHub capacity gate durable in the database admission policy and
-- reconciles P19/P20 checks that were already enforced by the exact-SHA waiter.

create or replace function public.gomoku_p16_required_checks()
returns text[]
language sql
immutable
security invoker
set search_path=''
as $$
  select array[
    'p16_contract',
    'p15_operations',
    'p14_governance',
    'p13_reliability',
    'ranked',
    'lifecycle',
    'history',
    'profiles',
    'integrity',
    'p18_portability',
    'p19_supply_chain',
    'p20_slo_governance',
    'p21_capacity'
  ]::text[];
$$;

revoke all on function public.gomoku_p16_required_checks()
  from public,anon,authenticated;
grant execute on function public.gomoku_p16_required_checks()
  to service_role;

comment on function public.gomoku_p16_required_checks() is
  'P21 release admission policy: exact-SHA admission requires portability, supply-chain integrity, production SLO governance, and portable load/concurrency/chaos capacity certification.';


create or replace function public.gomoku_p21_lobby_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
  with active_rooms as (
    select r.id,r.created_at,r.updated_at,r.password_hash,r.state,r.revision
    from public.gomoku_rooms r
    where r.expires_at>now()
      and coalesce(r.state->>'mode','')<>'challenge'
    order by r.updated_at desc
    limit 100
  ),
  spectator_counts as (
    select s.room_id,count(*)::integer as spectator_count
    from public.gomoku_room_spectators s
    join active_rooms r on r.id=s.room_id
    where s.last_seen>now()-interval '45 seconds'
    group by s.room_id
  ),
  room_rows as (
    select
      r.*,
      coalesce(sc.spectator_count,0) as spectator_count,
      coalesce(pa.player_count,0) as player_count,
      coalesce(pa.online_count,0) as online_count,
      coalesce(pa.players,'[]'::jsonb) as players
    from active_rooms r
    left join spectator_counts sc on sc.room_id=r.id
    left join lateral (
      select
        count(*)::integer as player_count,
        count(*) filter(where pp.last_seen>now()-interval '45 seconds')::integer as online_count,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'seat',coalesce((p.value->>'seat')::integer,0),
              'name',left(coalesce(p.value->>'name','Player'),24),
              'color',coalesce((p.value->>'color')::integer,0),
              'profileUsername',nullif(p.value->>'profileUsername',''),
              'verified',nullif(p.value->>'profileUsername','') is not null,
              'online',coalesce(pp.last_seen>now()-interval '45 seconds',false)
            )
            order by coalesce((p.value->>'seat')::integer,0)
          ),
          '[]'::jsonb
        ) as players
      from jsonb_array_elements(coalesce(r.state->'players','[]'::jsonb)) p(value)
      left join public.gomoku_room_player_presence pp
        on pp.room_id=r.id
       and pp.seat=coalesce((p.value->>'seat')::integer,0)
    ) pa on true
  )
  select jsonb_build_object(
    'rooms',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',r.id,
          'rule','renju-practice',
          'mode',case
            when r.state->>'mode'='tournament' then 'tournament'
            when r.state->>'mode'='ranked' or coalesce((r.state->>'ranked')::boolean,false) then 'ranked'
            else 'casual'
          end,
          'ranked',(r.state->>'mode'='ranked' or coalesce((r.state->>'ranked')::boolean,false)),
          'tournament',(r.state->>'mode'='tournament'),
          'playerCount',r.player_count,
          'onlineCount',r.online_count,
          'capacity',2,
          'status',case
            when r.player_count<2 then 'waiting'
            when coalesce(r.state#>'{game,result}','null'::jsonb)<>'null'::jsonb
              or coalesce(r.state#>'{game,terminal}','null'::jsonb)<>'null'::jsonb then 'finished'
            else 'playing'
          end,
          'connectionStatus',case when r.online_count=r.player_count then 'live' else 'reconnecting' end,
          'round',greatest(1,coalesce((r.state->>'round')::integer,1)),
          'moves',jsonb_array_length(coalesce(r.state#>'{game,moves}','[]'::jsonb)),
          'passwordProtected',(r.password_hash is not null),
          'spectatorsAllowed',true,
          'spectatorCount',r.spectator_count,
          'players',r.players,
          'updatedAt',r.updated_at,
          'createdAt',r.created_at
        )
        order by r.updated_at desc
      ),
      '[]'::jsonb
    ),
    'generatedAt',now()
  )
  from room_rows r;
$$;

revoke all on function public.gomoku_p21_lobby_snapshot()
  from public,anon,authenticated;
grant execute on function public.gomoku_p21_lobby_snapshot()
  to service_role;

comment on function public.gomoku_p21_lobby_snapshot() is
  'P21 read model: returns the public lobby projection, spectator counts and player presence in one server-side snapshot to avoid per-request REST fan-out under burst load.';
