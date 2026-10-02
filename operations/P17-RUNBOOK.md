# P17 — Release Environments, Preview Certification & Safe Schema Promotion

P17 makes preview/staging a real release gate.

## Invariants

**Qualified ≠ preview-certified ≠ promotion-authorized ≠ promoted ≠ production-certified.**

P16 still owns CI admission. P17 owns environment isolation and promotion.

Production deployment is no longer performed by the P16 workflow. P16 records a `delegated_to_p17` orchestration event and continues certifying the currently running production build.

## Why P17 does not use ordinary db push

The Supabase project is shared by multiple THIEPN apps. Its project-wide `supabase_migrations` history contains many migrations that do not live in this Gomoku repository.

Treating this repository as the owner of that complete migration ledger would make `supabase db push` unsafe.

P17 therefore tracks a **repo-scoped manifest**:

- SHA-256 of every Gomoku SQL migration file;
- SHA-256 of the Gomoku Edge source/config;
- a combined release-manifest SHA-256;
- source Git SHA;
- migration count and head file.

Supabase Branching remains the authoritative environment isolation and promotion mechanism.

## Preview environment

The planned persistent branch name is:

`gomoku-preview`

It must be a distinct Supabase project ref from production.

Current Supabase pricing reported for this organization is **$0.01344/hour** for a preview branch. Creation is intentionally not automated until that cost is explicitly accepted.

The production branch currently reports `MIGRATIONS_FAILED` in Supabase Branching metadata. P17 does not hide this. The first preview branch creation is the real replay test for the shared project migration baseline.

## GitHub credential

P17 needs one repository secret for automated preview operations:

`SUPABASE_ACCESS_TOKEN`

Use a scoped PAT where available. Grant only the permissions needed for:

- preview branches;
- database/query access;
- Edge Functions;
- API-key read;
- branch merge.

P17 obtains branch-specific database and API credentials at runtime through Supabase. They are not committed.

## Release flow

On every relevant main push:

1. P16 admission completes.
2. P17 generates the deterministic release manifest.
3. P17 resolves `gomoku-preview` credentials.
4. Existing preview schema state identifies the previous promoted Git SHA.
5. Only migrations changed since that SHA are selected.
6. Every selected migration is run inside `BEGIN … ROLLBACK` first.
7. Only if rollback rehearsal passes are migrations committed to preview.
8. The candidate Edge Function is deployed to preview with the exact Git SHA and channel `preview-p17`.
9. Preview schema state is updated to the exact manifest.
10. Live lifecycle, integrity, ranked, history and profile contract suites run against preview.
11. P17 records a preview certification only if all required checks pass.
12. Production promotion authorization requires:
    - the exact production Git SHA to be P16-admitted;
    - a registered required preview/staging environment;
    - that environment to be ready;
    - a passing preview certification younger than 72 hours;
    - exact schema, Edge and release-manifest hashes.
13. The certified Supabase branch is merged to production.
14. Production must converge to the candidate runtime SHA.
15. Production repo schema state and migration evidence are recorded.
16. P16 deployment observation is reconciled.
17. P16 production certification must pass.
18. P17 records the promotion as verified.

Any failure stops before the next state transition.

## Preview certification checks

A passing preview certification requires all of:

- `branchHealthy`
- `migrationReplayPassed`
- `migrationHistoryAligned`
- `schemaContractsPassed`
- `edgeBuildMatches`
- `edgeHealthHealthy`
- `runtimeIsPreview`
- `isolationConfirmed`
- `rollbackRehearsalPassed`

The database computes pass/fail from the required list.

## Migration safety

P17 only promotes SQL that succeeds transactionally.

The workflow rejects known non-transactional migration operations such as:

- `CREATE INDEX CONCURRENTLY`
- `DROP INDEX CONCURRENTLY`
- `REINDEX CONCURRENTLY`
- `VACUUM`

Such changes require a separately governed migration procedure rather than silently weakening the rollback rehearsal.

## Branch merge

Promotion uses Supabase Branching merge rather than replaying the repository against the shared production migration ledger.

Supabase branch data is isolated and not treated as production data. Only the promoted database/Edge changes are part of the release path.

## OIDC

P17 uses the same GitHub OIDC issuer/audience and replay ledger as P16, but trusts only:

`thiepn/gomoku/.github/workflows/p17-preview-promotion.yml@refs/heads/main`

The P16 workflow remains separately pinned.

No GitHub workflow receives a THIEPN Account operator role.

## Server-only control tables

P17 adds:

- `gomoku_release_environments`
- `gomoku_repo_schema_state`
- `gomoku_repo_migration_events`
- `gomoku_preview_certifications`
- `gomoku_schema_promotion_authorizations`
- `gomoku_schema_promotion_events`

All are RLS-protected and hidden from `anon` and `authenticated`.

Evidence tables are append-only to application code. Mutable state is limited to the current environment registry and environment-local repo schema state.

## Bootstrap order

P17 itself must be bootstrapped through the existing P16 controlled path:

1. merge P17 only after CI is green;
2. apply the P17 migration to production;
3. deploy `gomoku-room` with the P17 merge SHA;
4. compute and store production repo schema state;
5. certify production;
6. obtain explicit approval for the $0.01344/hour preview branch cost;
7. create `gomoku-preview`;
8. verify branch migration replay and branch health;
9. register the preview environment;
10. run its first P17 certification.

After bootstrap, later releases can use the normal P17 preview → authorize → merge → production-certify path.

## Certification health isolation

Production-certification failures are control-plane evidence, not gameplay/runtime failures. P17 keeps them in `gomoku_runtime_events` and exposes their counts separately as `releaseControl15m`, but `gomoku_reliability_snapshot()` excludes `component='production_certification'` from the error/warning counters that determine `healthy | degraded | critical`.

This prevents the certification retry loop from manufacturing the unhealthy signal it is trying to evaluate. Actual room, persistence, queue, recovery-heartbeat and other runtime errors remain health-impacting.
