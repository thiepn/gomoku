-- P23 — Security Assurance, Attack-Surface Audit & Abuse Resistance
-- Makes the exact-SHA P23 adversarial security gate durable in P16 release admission.

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
    'p21_capacity',
    'p23_security'
  ]::text[];
$$;

revoke all on function public.gomoku_p16_required_checks()
  from public,anon,authenticated;
grant execute on function public.gomoku_p16_required_checks()
  to service_role;

comment on function public.gomoku_p16_required_checks() is
  'P23 release admission policy: exact-SHA admission requires portable adversarial security assurance in addition to P18-P21 qualification.';
