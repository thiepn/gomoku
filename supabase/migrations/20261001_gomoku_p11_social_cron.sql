do $$
declare v_job bigint;
begin
  for v_job in select jobid from cron.job where jobname='gomoku-p11-social-tick'
  loop
    perform cron.unschedule(v_job);
  end loop;
  perform cron.schedule(
    'gomoku-p11-social-tick',
    '* * * * *',
    'select public.gomoku_expire_direct_challenges();'
  );
end $$;

comment on function public.gomoku_expire_direct_challenges() is
  'P11 minute-level cleanup for expired pending direct challenges.';
