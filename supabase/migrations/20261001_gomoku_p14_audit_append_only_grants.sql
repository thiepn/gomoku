-- P14 audit grant correction.
-- Existing projects may inherit broad service_role privileges on newly-created
-- public tables through default privileges. Revoke them explicitly before
-- re-granting the append-only surface required by Gomoku governance.

revoke all on table public.gomoku_admin_audit_log from service_role;
grant select,insert on table public.gomoku_admin_audit_log to service_role;

revoke all on sequence public.gomoku_admin_audit_log_id_seq from service_role;
grant usage,select on sequence public.gomoku_admin_audit_log_id_seq to service_role;

comment on table public.gomoku_admin_audit_log is
  'P14 append-only administrative audit evidence. service_role has SELECT + INSERT only; direct client access is denied.';
