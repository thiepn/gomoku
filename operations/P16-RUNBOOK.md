# P16 — Automated Release Admission, Deployment Orchestration & Continuous Production Certification

P16 connects the P15 governance records to CI/CD while keeping three facts distinct:

**Candidate qualified ≠ deployed ≠ certified.**

A passing CI run can admit an immutable Git SHA. Admission does not deploy it. A deployment observation proves which admitted SHA reached production. A production certification then proves that the running build, operational state, recovery contracts, and recorded deployment still align.

## Trust model

GitHub Actions authenticates to `gomoku-room` with **GitHub OIDC**. The P16 control plane accepts only a short-lived, correctly signed token whose claims identify:

- repository `thiepn/gomoku`;
- the immutable repository and owner IDs;
- ref `refs/heads/main`;
- workflow `.github/workflows/p16-release-control.yml`;
- the dedicated audience `gomoku-production-control`.

Every accepted JWT `jti` is written once to a replay-prevention ledger. Reusing the same token is rejected.

Automation uses service-side P16 RPCs only after OIDC verification. It **does not grant operator authority** and does not create a row in `gomoku_admin_operators`.

## Automated admission

The P16 workflow qualifies the merge SHA against:

1. P16 release-control contracts;
2. P15 operations governance;
3. P14 administrative governance;
4. P13 reliability and live health;
5. ranked matchmaking;
6. room lifecycle;
7. match history;
8. player identity;
9. match integrity.

The evidence for each check is append-only. The database makes the final `admitted` / `rejected` decision from the required policy list; the workflow cannot simply submit `decision=admitted`.

P16 also hardens P14/P15 human release governance:

- candidate → approved requires the latest automated admission to pass;
- rollout creation requires automated admission;
- approved → active requires a passing post-deployment production certification;
- emergency rollback remains available to an eligible prior release.

## Runtime provenance

`gomoku-room` imports `build-meta.ts`.

The committed source intentionally contains:

`BUILD_GIT_SHA='SOURCE'`

That value is not certifiable. An automated deployment rewrites the file only in the runner workspace with the exact `GITHUB_SHA` before deployment. The deployed Edge bundle therefore carries its immutable source SHA, and `/api/health` exposes that SHA as public-safe build provenance.

A manual production deployment must stamp the same metadata explicitly. If it deploys the source placeholder, continuous certification fails.

## Deployment orchestration

The release workflow records orchestration events before taking deployment actions.

### Schema gate

P16 intentionally does **not** run `supabase db push` automatically in this repository today.

The existing production database has a migration history that was built through prior controlled MCP/admin applies. Blindly letting a new CI runner infer and push that history could reapply or reorder schema work.

When a merge contains a new file under `supabase/migrations/`, orchestration records:

`schema / blocked / controlled_schema_apply_required`

The schema must first be applied through the trusted controlled migration path and verified. After that, the admitted Edge artifact can be deployed.

This is a safety gate, not a missing release check.

### Edge-only deployment

For a merge with no schema migration, the workflow can deploy `gomoku-room` automatically when the repository secret `SUPABASE_ACCESS_TOKEN` exists.

The workflow:

1. admits the SHA;
2. confirms there is no schema gate;
3. stamps the runtime Git SHA;
4. runs `supabase functions deploy gomoku-room`;
5. calls the new production function;
6. verifies `/api/health.build.gitSha` equals the admitted SHA;
7. records the production deployment through the OIDC control plane;
8. performs production certification.

If the secret is missing, the release is not silently treated as deployed. An append-only `edge / blocked / missing_supabase_access_token` event is recorded.

The Supabase project reference is not a secret. The access token is.

## Continuous certification

Every successful admitted `main` release-control run certifies the **currently running production build** after orchestration completes, even when the new candidate was intentionally held at a schema or credential gate. The workflow also runs certification every six hours at minute 17 and can be dispatched manually.

Certification executes against the **currently running Edge bundle**, not against a Git checkout claim. The runtime build SHA must:

- be a real 40-character Git SHA;
- have a latest P16 admission of `admitted`;
- have a matching production deployment observation;
- equal the latest observed production deployment;
- report healthy P13 reliability;
- be in normal service mode;
- have no active incident;
- pass all P15 structural controls.

The resulting certification row is append-only.

The public-safe release status exposes:

- current drift state;
- observed production Git SHA / Edge version / frontend SHA;
- automated admission decision;
- latest production certification and checks.

Possible drift states include `aligned`, `unobserved`, `unadmitted_deployment`, `admission_revoked`, `uncertified`, `certification_drift`, and `certification_failed`.

## Operator console

The existing operator-only Operations console now includes P16 release control:

- observed production artifact;
- latest automated admission;
- latest production certification;
- drift state;
- qualification evidence;
- recent orchestration events.

The UI remains inaccessible to ordinary players. P16 does not change the P14 operator bootstrap rule.

## Failure handling

If qualification fails, there is no admission.

If schema is pending, Edge deployment is blocked rather than attempted out of order.

If the deployed runtime SHA differs from the admitted SHA, the deployment observation fails.

If production health, structural controls, incident state, admission, or observed deployment no longer align, continuous certification records a failed result and the GitHub certification job fails.

A failed certification never edits completed matches, player ratings, room state, incidents, or audit history.

## Production rollout for P16 itself

P16 itself contains a schema migration, so its initial rollout follows the schema gate manually:

1. merge only after all PR verification passes;
2. apply the P16 migration through the trusted Supabase migration path;
3. deploy `gomoku-room` with the merge SHA stamped into `build-meta.ts`;
4. publish the rebuilt Pages shell;
5. write P16 qualification/admission evidence for the merge SHA;
6. record the actual Edge/Pages deployment;
7. run production certification;
8. verify RLS/grants/advisors and live compatibility.

Future Edge-only changes can use automatic deployment once `SUPABASE_ACCESS_TOKEN` is configured.
