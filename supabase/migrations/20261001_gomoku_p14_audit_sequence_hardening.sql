-- P14 audit identity-sequence hardening.
-- PostgreSQL/Supabase default privileges can leave sequence USAGE available to
-- public client roles even when the backing audit table is fully restricted.

revoke all on sequence public.gomoku_admin_audit_log_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.gomoku_admin_audit_log_id_seq to service_role;
