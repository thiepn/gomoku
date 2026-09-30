update public.account_app_manifests
set capabilities = capabilities || '{"rankedMatchmaking":true,"publicLeaderboard":true,"rankedRating":true}'::jsonb,
    updated_at = now()
where app_slug='gomoku';