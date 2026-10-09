# A13 — Post-release stability and operational handoff (preparation only)

**Implementation:** `phase/a13-stability-operations-handoff`, stacked on A12 draft PR #72 (qualified source head `e757a9a2ea546b6716bd2dcbaa53dbf31bf43b07`). **No production release has occurred.**

The A9 immutable game candidate is source SHA `fca45816ed7d3a95bae550b9aa644e29053875f6` from run `37922288752`, not the development branch. A11 and A12 are **automation-qualified, not human/release accepted**.

## Implemented in A13
- `a13-stability-audit.cjs`: fail-closed, **read-only documentary** gates for verified original A9 run and all seven stages; independently witnessed A12 production cutover; SHA-locked live eight-asset production bytes; consecutive **24–72 complete hourly** P20 aggregate telemetry receipts; three separate actual mobile platform observation records; independently reviewed alerts/incidents/recoverability; and later owner + independent reviewer operational handoff. All findings are documentary, not proof of authenticity.
- `a13-live-probe.cjs`: opt-in, **GET-only** production HTTPS observer for exact eight A9 assets. Rejects preview/localhost, redirects, HTTP errors, oversized/empty responses and byte drift. Matches exact deployment identity, performs no cookie-bearing requests and never writes production. Importing the library or running CI initiates **zero network probes**.
- `test-a13-stability-audit.cjs` / `test-a13-live-probe.cjs`: wholly **synthetic** receipt and mocked-fetch regressions. Never interpret fixture timestamps, actors, services, screenshots, samples, devices or approvals as reality.
- `verify-analysis3-a13.yml`: least-privilege, read-only CI and failed-admission assertion. No repository or environment write permission, GitHub releases, Vercel deploy, production Supabase access, publication, original screenshot changes or human signoff.

## Original evidence to obtain independently (not included here)

1. A11: dedicated unlinked public HTTPS preview, eight real SHA-256 asset probes, physical Android Chrome **7/7**, Samsung Internet **6/6**, installed PWA **5/5**, same-origin service-worker update/reversal, witnessed data restore, independent original-evidence review and SHA-bound owner acceptance. Current genuine evidence: **0/18 physical cases**.
2. A12: entirely **separate**, explicit production approval identifying origin, source, operator, maintenance window, rollback/data-preservation plan, current production baseline and the full exact-head P16 checks. An A12 `manual-review-only` report alone is NEVER an authorization. Owner-directed cutover and production-change receipt must actually exist.
3. A13: independent, named operator and witness record of actual deployed commit, prior `main` commit, deployment ID, original A9 source and authorized A12 head; a **closing** live HTTPS re-fetch of all eight production assets with source-matched hashes **after the entire P20 window**, within six hours of its end. This closing probe must precede final handoff and independently corroborate the initial cutover evidence. Authenticate responses independently and compare against the original A9 artifact; JSON receipts can be fabricated.
4. P20 stability: 24–72 *contiguous hourly* UTC aggregate buckets beginning no later than two hours after deployment. Require **60 P20 one-minute samples in every hour**, each with its original sanitized good/bad-minute evidence. Service availability >= **99.9%**, persistence freshness >= **99.9%**, recovery freshness >= **99.9%**, runtime-clean minutes >= **99%**, and no critical alert. Never infer P20 SLIs from HTTP request or per-player counts. Preserve independent P20 exports and their SHA-256 digests. Existing P20 data and privacy safeguards must remain intact; no per-user telemetry collection.
5. Physical post-release observations: named tester, timestamp after deployment, original evidence hashes and distinct case results for Android Chrome, Samsung Internet and **installed** PWA. Include launch, offline usage, saved-record retention, online play, accessibility; installed PWA additionally needs a real same-origin version change and reinstall data survival. Emulation must not be substituted for physical devices.
6. Review original incident and rollback records, with no unresolved Sev1/Sev2 incident, no player data loss, and the original rollback package still recoverable. An executed rollback means the new candidate is NOT certified as running; reopen a new release cycle.
7. Handoff only after the observation window and incident review: owner, independent reviewer, on-call roster, escalation, support runbook/retention, post-release backup, rollback reference and owner-signed evidence. Human signoff cannot be inferred from CI.

**Do not** use A13 to create a previously missing release/approval. Even a structurally complete synthetic packet returns only `ready-for-manual-stability-review`, with `canCertifyStable=false`, `canCloseRelease=false`, `canMerge=false`, `canTag=false`, `canDeployProduction=false`, and `canChangeProductionData=false`. Independent review of originals and separate owner release/closure authority remain mandatory.

## Read-only local documentary audit

```sh
node analysis3/a13-stability-audit.cjs \
  ORIGINAL-A9-CANDIDATE.json A12-EXECUTED-CUTOVER.json \
  A13-REAL-PRODUCTION-PROBE.json P20-REAL-HOURLY-TELEMETRY.json \
  A13-PHYSICAL-DEVICES.json A13-INCIDENT-REVIEW.json A13-OWNER-HANDOFF.json
```

Exit **2** = blocked or missing evidence. Exit **0** = a **documentary-only** packet is ready for independent review. It is *not* an automatic assertion that production was actually changed or safe.

## Explicit production-only read probe (do NOT run before permission)

This command is a future operator handoff, not a request to run it now. It touches the production public HTTPS origin **only after distinct explicit authorization**; use a reviewed URL, not a guessed one.

```sh
A13_READONLY_PROBE_APPROVAL=I_APPROVE_A13_READONLY_HTTPS_PROBE \
A13_EXACT_PRODUCTION_ORIGIN=https://REVIEWED-PRODUCTION-ORIGIN.example/ \
node analysis3/a13-live-probe.cjs \
  https://REVIEWED-PRODUCTION-ORIGIN.example/ \
  ORIGINAL-A9-CANDIDATE.json ACTUAL-DEPLOYMENT-ID
```

Program emits a JSON observation to stdout; it does not deploy or write a file. Archive the raw bytes and verified hashes under the operator's controlled evidence process.

## Operational response runbook

**Before** cutover: freeze independently accepted source; snapshot existing live asset hashes and backup; independently rehearse recovery; establish live alert and rollback contacts; stop on incomplete owner signoff.

**Immediately after** an approved cutover: compare exact production eight-asset bytes, PWA install/update/scope, state retention and online match integrity; route severe errors to operator. Stop/rollback on asset mismatch, lost records, cache contamination, broken offline mode, escalating incident or unrecoverable data. If rollback occurs, verify stable former shell, service worker and player records; do not claim release successful.

**24–72 hours:** evaluate P20 data with contiguous, a complete real P20 minute-sampler history; capture incident journal, user data safety, browser/PWA physical results and fresh recovery readiness. Fail closed on any gap, stale report, unresolved critical incident or changed deployment ID. Post-release stability is not established by a single green CI job.

**Handoff:** a named independent human validates originals, source SHA and deployment, checks support/incident/rollback procedures, and explicitly signs the operational handoff. Then the owner can decide separately to close the release.

## Next — A14

**A14: Post-release Evidence Authenticity & Operational Lifecycle Assurance.** Goals: attest raw production/CI evidence provenance, replay-resistant SHA and deployment identity reconciliation, sustained alert windows and rollback drill archiving, owner-approved closure runbook, and longitudinal stability checks. **Status: not started.** No live checks or release changes until A11–A13 acceptance is real and specifically authorized.
