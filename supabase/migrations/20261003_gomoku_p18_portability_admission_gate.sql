-- P18 — make environment portability a durable release-admission requirement.
-- The GitHub qualifier already waits for the exact-SHA portable-preview check.
-- This database policy mirrors that dependency so admission cannot be forged
-- by omitting P18 evidence from an automation payload.

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
    'p18_portability'
  ]::text[];
$$;

revoke all on function public.gomoku_p16_required_checks()
  from public,anon,authenticated;
grant execute on function public.gomoku_p16_required_checks()
  to service_role;

comment on function public.gomoku_p16_required_checks() is
  'P18 release admission policy: candidate qualification requires legacy production checks plus exact-SHA portable preview/recovery qualification.';
