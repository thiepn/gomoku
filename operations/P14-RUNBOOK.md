# P14 — Competitive Administration, Incident Response & Release Governance

P14 adds an operator control plane around Gomoku's competitive systems. It is deliberately separate from ordinary THIEPN Account authentication: being signed in, connected to Gomoku, or having the required `identity.basic` grant does **not** make a user an operator.

## Operator bootstrap

`gomoku_admin_operators` intentionally ships empty. Add the first operator only through a trusted backend/database administration path after verifying the exact THIEPN Account user UUID. Do not expose operator enrollment through the public client or infer an operator from username, email, metadata, or repository ownership.

Roles are scoped:

- `operator`: operational controls and incident handling.
- `incident_commander`: operational controls and incident handling.
- `release_manager`: release registration, approval, activation, and rollback governance.
- `admin`: both operational and release authority.

Operator removal is performed by setting `active=false` or deleting the allowlist row through a trusted administrative path.

## Competitive controls

The singleton `gomoku_competitive_control` governs **new entry**:

- ranked matchmaking queue entry;
- tournament creation and registration;
- direct challenge creation and acceptance;
- ordinary room creation.

`service_mode=maintenance` blocks all four new-entry paths. Individual switches can disable a single path while the rest remain available.

**Existing matches continue.** P14 does not terminate rooms, rewrite completed results, cancel an active tournament match, eject players, or block access to an already accepted direct-challenge room. This keeps incident response reversible and avoids turning an operational intervention into a competitive-result mutation.

When changing controls, provide a concise reason. Every mutation is appended to `gomoku_admin_audit_log`. A short public banner may explain degraded service without exposing operator identities, internal notes, report content, or private room data.

## Incident workflow

1. Open an incident with severity `sev1`–`sev4`, a factual title, and a reason.
2. If necessary, set the affected entry switches or `service_mode` to `degraded` / `maintenance`.
3. Move the incident through `investigating → identified → monitoring → resolved`.
4. Restore controls only when the affected path is safe.
5. Resolve the incident. Resolving the active incident removes it from the public operational projection, while the incident and audit history remain.

Public health output exposes only severity, status, title, timestamps, service mode, feature availability, banner, and active release metadata.

## Release governance

Release records use the lifecycle:

**candidate → approved → active**

Activating a new release retires the previous active record. A rollback marks the current release `rolled_back` and promotes an eligible prior release back to `active`.

The release registry **does not deploy code**. It records authorization and provenance. GitHub Pages publication, Edge Function deployment, database migration execution, and any restoration of a prior Git SHA remain deployment operations and must be verified independently. Never mark a release active before the corresponding deployed artifacts are confirmed.

## Emergency order of operations

For a competitive production incident:

1. Inspect `/api/health` and P13 persistence/recovery health.
2. Open a P14 incident.
3. Disable only the affected **new-entry** surface; use maintenance mode only when the blast radius is broad.
4. Preserve active rooms and completed-match recovery unless data integrity itself requires a separate corrective migration.
5. Diagnose using sanitized runtime events and database state.
6. Deploy a corrected release or execute a governed rollback.
7. Verify health, match persistence, ranked/tournament invariants, and the deployed SHA.
8. Restore controls.
9. Move the incident to monitoring and then resolved.
10. Confirm the administrative audit trail contains the control, incident, and release transitions.

## Audit guarantees

Administrative writes require an explicit operator role and a human-readable reason. The Edge Function generates an administrative request ID. The audit table is RLS-protected, unavailable to public/authenticated clients, and service-role access is limited to `SELECT` + `INSERT`; application code has no update/delete path for audit records.

P13 runtime events remain diagnostic telemetry. P14 administrative audit events are governance evidence; they serve different purposes and should not be conflated.
