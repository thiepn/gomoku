create index if not exists gomoku_fair_play_audit_actor_idx
  on public.gomoku_fair_play_audit_events(actor_user_id,created_at desc)
  where actor_user_id is not null;

create index if not exists gomoku_moderation_actions_actor_idx
  on public.gomoku_moderation_actions(actor_user_id,created_at desc)
  where actor_user_id is not null;
