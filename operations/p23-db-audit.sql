\set ON_ERROR_STOP on

do $p23$
begin
  if exists (
    select 1
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p')
      and c.relname like 'gomoku_%'
      and not c.relrowsecurity
  ) then raise exception 'P23: a Gomoku table lacks RLS'; end if;

  if exists (
    select 1
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p','v','m')
      and c.relname like 'gomoku_%'
      and (
        has_table_privilege('anon',c.oid,'SELECT')
        or has_table_privilege('anon',c.oid,'INSERT')
        or has_table_privilege('anon',c.oid,'UPDATE')
        or has_table_privilege('anon',c.oid,'DELETE')
        or has_table_privilege('authenticated',c.oid,'SELECT')
        or has_table_privilege('authenticated',c.oid,'INSERT')
        or has_table_privilege('authenticated',c.oid,'UPDATE')
        or has_table_privilege('authenticated',c.oid,'DELETE')
      )
  ) then raise exception 'P23: direct anon/authenticated Gomoku table privilege detected'; end if;

  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname like 'gomoku_%'
      and (
        p.prosecdef
        or has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE')
        or not has_function_privilege('service_role',p.oid,'EXECUTE')
      )
  ) then raise exception 'P23: unsafe Gomoku function execution privilege/security mode detected'; end if;

  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname like 'gomoku_%'
      and (
        pg_get_functiondef(p.oid) ~* 'auth[.]role[(]'
        or pg_get_functiondef(p.oid) ~* 'raw_user_meta_data'
        or pg_get_functiondef(p.oid) ~* 'user_metadata'
      )
  ) then raise exception 'P23: deprecated or user-editable JWT authorization source detected'; end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename like 'gomoku_%'
      and (roles @> array['anon']::name[] or roles @> array['authenticated']::name[])
  ) then raise exception 'P23: direct client RLS policy detected on service-owned Gomoku tables'; end if;
end
$p23$;

select jsonb_build_object(
  'version','p23.db-boundary.v1',
  'tables',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname like 'gomoku_%'),
  'functions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'gomoku_%'),
  'securityDefinerFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'gomoku_%' and p.prosecdef),
  'anonExecutableFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'gomoku_%' and has_function_privilege('anon',p.oid,'EXECUTE')),
  'authenticatedExecutableFunctions',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'gomoku_%' and has_function_privilege('authenticated',p.oid,'EXECUTE')),
  'generatedAt',now()
) as p23_db_boundary;
