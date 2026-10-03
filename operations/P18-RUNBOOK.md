# P18 — Environment Portability, Free-Tier Preview Infrastructure & Release Disaster Recovery

P18 removes paid Supabase Branching as a prerequisite for release qualification.

## Environment model

P18 supports three interchangeable execution targets:

1. **Production** — shared THIEPN Account Supabase project.
2. **Dedicated hosted preview** — optional second Supabase project, isolated from production.
3. **Portable local preview** — disposable Supabase CLI stack used by GitHub Actions and local recovery drills.

The local preview is the mandatory release-admission gate. A hosted preview remains optional and can be added when a project slot is available.

## Current free-plan constraint

The Thiepn Supabase organization currently uses both available active Free projects:

- THIEPN Account
- THIEPN Core

Therefore P18 does not create another hosted project and never repurposes THIEPN Core.

Supabase Branching requires Pro or above. P18 instead uses the all-plan local Supabase workflow for mandatory preview validation.

## Portable shared contracts

Gomoku runs inside the shared THIEPN Account project but owns only its own migrations. A clean standalone environment therefore needs a small compatibility layer for shared contracts that Gomoku reads:

- the legacy P1/P2 room store and spectator-presence objects
- account app registry
- account app manifest
- account app permissions
- app connections and grants
- public leaderboard profiles
- auth.users remains the real Supabase Auth table

`operations/p18-shared-contract-bootstrap.sql` recreates only those contracts. It contains no production data and is never applied to production.

## Deterministic migration replay

The repository contains historical migration filenames with duplicate date prefixes, and filename ordering does not always match the order in which production applied dependent migrations. For example, P6 identity columns were applied before the later P6 exact-statistics function even though the filenames sort the other way.

`operations/p18-build-portable-workspace.mjs` therefore carries an explicit dependency order derived from the production Supabase migration ledger. It refuses to run if a canonical migration is missing from that order or if a new migration appears without an explicit placement. The disposable workspace then assigns synthetic, unique 14-digit migration versions while preserving each migration's SQL bytes.

This transformation is CI-only. Canonical migration files are never renamed or rewritten.

The portable stack is pinned to PostgreSQL 17 to match production.

## Mandatory portable preview

`.github/workflows/p18-portability-recovery.yml` runs a job named `portable-preview` on relevant pull requests and main pushes.

It:

1. builds a disposable Supabase workspace;
2. starts a clean local Supabase stack;
3. applies the compatibility bootstrap and every Gomoku migration from zero;
4. serves the candidate `gomoku-room` Edge Function locally with exact Git provenance;
5. lints the reconstructed database;
6. runs lifecycle, integrity, ranked, history and player-profile live suites against the isolated stack;
7. creates a synthetic anonymous room fixture;
8. produces a local data-only recovery image, excluding migration-seeded/recomputed operational state (including P20 SLO samples and alert state);
9. destroys the entire stack and Docker data;
10. recreates the stack from zero;
11. restores the synthetic recovery image;
12. verifies the fixture plus ranked/profile contracts after recovery;
13. emits a short-lived recovery evidence artifact.

P16 admission waits for `portable-preview`. A candidate therefore cannot be admitted merely because production happens to be healthy.

## Disaster-recovery boundary

The portable recovery rehearsal proves that:

- source + migrations can reconstruct the service schema;
- the Edge Function boots against the reconstructed schema;
- a logical Gomoku data image can be restored after total environment destruction;
- restored state remains usable through the public application API.

The rehearsal uses synthetic data only. It never copies production data into CI.

## Free-plan production backup

Supabase recommends regular logical exports for Free projects because platform daily-backup downloads are not available on Free.

P18 includes an optional scheduled encrypted Gomoku-data export. It activates only when both GitHub secrets exist:

- `P18_PRODUCTION_DB_URL`
- `P18_BACKUP_PASSPHRASE`

The passphrase must be at least 32 characters and should be a random high-entropy secret.

The job:

- uses PostgreSQL 17 tooling;
- exports only `public.gomoku_*` table data, excluding P20's recomputable SLO samples and alert state;
- never exports unrelated THIEPN Account app data;
- encrypts with AES-256-CBC + PBKDF2 before artifact upload;
- deletes the plaintext dump before upload;
- uploads only the encrypted dump and checksum;
- retains it for seven days.

The repository is public, so **unencrypted production backup artifacts are forbidden**.

Gomoku data references THIEPN Account identities. Full disaster recovery therefore requires the shared account/auth backup to be restored before Gomoku user-linked rows. P18 deliberately does not duplicate or exfiltrate the shared Auth database into this public repository's workflow.

## Dedicated free hosted preview

If a Free project slot later becomes available, P18 can use a separate project without changing the release contract.

`operations/p18-hosted-preview.mjs` supports:

- exact-SHA migration planning from the preview's current repo schema state;
- transactional rollback rehearsal;
- direct replay into the dedicated preview database;
- preview API discovery through a scoped Supabase token;
- production planning/rehearsal/apply only when a separate production DB URL is explicitly configured.

The script refuses the production project ref as a preview target and rejects non-transactional migration statements from the automatic path.

P17 environment registration now accepts `P17_ENVIRONMENT_SOURCE=dedicated_project`.

## Safety invariants

P18 never:

- runs `supabase db reset --linked`;
- runs blind `supabase db push` against the shared production project;
- treats THIEPN Core as a Gomoku preview environment;
- uploads a plaintext production data dump;
- requires a THIEPN Account human operator UUID;
- disables RLS or widens client grants;
- turns a local/synthetic preview into a fake hosted Supabase project identity.

## Promotion boundary

P18 portable preview is a **qualification gate**, not a production deployer.

P16 admission depends on portable preview success.
P17 remains the hosted-environment/promotion control plane when a real isolated hosted project is configured.
Production deployment continues to require explicit production credentials or the existing controlled deployment path.
