# P15 — Competitive Operations Console, Controlled Rollouts & Incident Drill Certification

P15 turns the P14 governance backend into an operator workflow. It does **not** grant anyone administrative access: the console appears only after a signed-in THIEPN Account successfully passes the P14 `gomoku_admin_operators` allowlist check.

## Operations console

Authorized operators get a single **Operations** entry inside the competitive panel. The console covers:

- production entry controls and public-safe banners;
- incident creation and lifecycle transitions;
- release registration and approval;
- deployment observations and reconciliation;
- staged rollout validation;
- non-destructive incident drills;
- recent append-only administrative audit evidence.

Ordinary players never receive an operator button. A connected account that is not allowlisted receives a 403 from the server and the console stays hidden.

## Controlled rollout model

Supabase currently exposes one active deployment of the `gomoku-room` Edge Function. P15 therefore does **not** claim to implement weighted backend traffic routing.

The rollout sequence is:

**Observe → Limited → Broad → Full**

These are governance and validation checkpoints, **not weighted traffic splitting**. They force operators to verify the deployed artifact, production health, and dwell time before promoting a release record.

Default minimum dwell times are:

- Observe: 2 minutes before Limited.
- Limited: 5 minutes before Broad.
- Broad: 10 minutes before Full.
- Full: 15 minutes before completion/activation.

A rollout can be paused or rolled back at any open stage.

## Deployment reconciliation

A rollout cannot start, advance, resume, or complete unless:

1. aggregate Gomoku health is `healthy`;
2. a recent production deployment observation exists;
3. the observed Git SHA matches the governed release Git SHA;
4. the observation is no older than two hours.

Deployment observations are append-only. They can store the Git SHA, Supabase Edge Function version, Edge bundle SHA-256, GitHub Pages/frontend SHA, and notes.

The reconciliation state is one of:

- `matched`: governed release SHA equals the latest observed deployment SHA;
- `mismatch`: the observed deployment differs from the governed release;
- `deployment_unobserved`: a release is governed but no production observation is recorded;
- `deployment_unregistered`: production was observed but there is no governed release;
- `untracked`: neither side has been registered yet.

A deployment observation is evidence only. Recording one does not deploy anything.

## Release completion and rollback

Completing a Full rollout activates an approved release in the P14 registry. If an active release is rolled back, P15 delegates the governance transition to the P14 rollback contract and requires an eligible target release.

The governance system **does not deploy or roll back code**. An operator must still deploy the chosen Git/Edge/frontend artifacts through the real deployment systems and record the resulting observation. Governance and actual deployment must reconcile before the release is considered controlled.

## Incident drills

P15 supports four scenarios:

- `ranked_outage`;
- `persistence_degradation`;
- `bad_release`;
- `full`.

### Structural certification

The service-only structural drill inspects the live production schema and privilege boundaries without changing competitive controls, rooms, incidents, releases, or rollout state. It verifies:

- the competitive control singleton exists;
- control changes do not mutate active room rows;
- P13 durable persistence/recovery contracts exist;
- release and rollout rollback contracts exist;
- deployment reconciliation exists;
- P15 tables and RPCs are unavailable to anon/authenticated clients;
- the P14 audit ledger remains append-only and its sequence remains private.

Structural certification writes only an append-only drill evidence row.

### Operator drill

An authorized operator can run the same scenario through the Operations console. The Edge Function adds current aggregate health and the public-safe operational snapshot to the evidence. This proves the authenticated operator path and audit event path without deliberately breaking production.

Neither drill terminates rooms or disables live entry paths.

## Incident workflow with P15

1. Inspect health and deployment reconciliation.
2. Open an incident.
3. Disable only the affected new-entry surface when isolation is required.
4. Preserve active rooms and P13 completed-result recovery.
5. Diagnose and deploy the correction.
6. Record the actual production deployment observation.
7. Reconcile the observed SHA with the governed release.
8. Use rollout validation stages before full activation when appropriate.
9. Restore entry controls.
10. Move the incident to Monitoring, then Resolved.
11. Run the relevant P15 incident drill.
12. Confirm drill and administrative audit evidence.

## Production certification

A P15 release is operationally certified when:

- the P15 migration is applied;
- `gomoku-room` reports phase P15;
- existing ranked, lifecycle, history, identity and integrity suites pass;
- the structural `full` drill passes;
- effective database grants confirm P15 admin tables/RPCs are server-only;
- deployment reconciliation accurately describes the current production artifact;
- no operator authority was inferred or auto-granted.

Human console use still requires explicit operator bootstrap under P14.
