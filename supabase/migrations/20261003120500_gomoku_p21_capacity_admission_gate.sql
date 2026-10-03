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
