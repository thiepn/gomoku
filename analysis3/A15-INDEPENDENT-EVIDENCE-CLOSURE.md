# A15 — Independently anchored public evidence, replay accounting and operator decision closure

**Implementation state:** nondeploying development only; stacked on A14 draft PR #74, exact head `20ed712041029930b41fd76e5c895a6f43c29e1d`, where P19/R4/P20/A14/P21/P23 all six GitHub Actions runs completed successfully. **No A11 physical acceptance or A12 production release has occurred.**

## What is actually implemented

**1. Original-source and evidence-pin readback** (`a15-evidence-pins.json` / `a15-public-evidence.cjs`). The pinned public GitHub manifest records the exact original A9 candidate run and release artifact, exact A14 head, six latest-head mandatory jobs, and artifact digest metadata for the P21/P23 runs. The module can independently fetch the pinned official **public GitHub API endpoints** with opt-in GET only, verifying repository, run id, exact SHA, attempt #1, status and conclusion; and artifact ID, name, reported SHA-256, size, original run and expiry. GitHub workflow-archive digest, nested A9 offline ZIP SHA and game static-file hashes are different types of evidence and must not be conflated.

The separate `verifyOriginalOfflineZip` checks the actual nested offline-candidate ZIP bytes against the independently locked original SHA-256. It is **not** a ZIP extraction or independent assertion of its origin. The script never downloads production content or private files without additional approval. CI uses fake HTTP responses and never invokes an actual GitHub GET via this verifier. The pinned metadata was inspected from GitHub on 2026-10-10; recheck at execution time.

**2. Durable local replay-accounting interface** (`a15-local-ledger.cjs`). Requires an existing canonical absolute, non-symlink-controlled filesystem directory and explicit operator opt-in. Creates cryptographically random 128-bit challenges scoped to deployment ID and evidence digest; supports bounded expiry and exactly-once consume. Rejects scope drift, expiry, duplicated issue/consume, stale ledger head, malformed chain and simultaneous lock acquisition. Writes state atomically using restricted `0600` files, a create-exclusive lock, fsync and rename. Read-only inspect recomputes canonical record hashes and chain continuity. It does not open sockets, perform CI writes or operate on production records.

**Limit:** This is a durable **local** ledger, not a globally authoritative service, immutable custody archive, multi-device consensus or authentic human approval. An operator controlling the same disk can replace its contents. A separate independently administered append-only receipt, operator-authorized challenge issuance, fresh reads and independent witness must be added before ever claiming global anti-replay/closure. No key, token, server or hosted ledger is provisioned.

**3. Reviewed key rotation + operational closure** (`a15-operator-closure.cjs`). Pure nonmutating checks validate approved existing A14 trust anchor presence (currently **zero keys**), stable key ID/person/fingerprint, exact previous policy digest, monotonic revocation list, all three distinct role holders, and independent owner/reviewer change ticket documentary evidence. It cannot register/revoke/rotate real keys and never returns authorization. A synthetic documentary closure combiner checks verified-GitHub-readback shaped receipts, original A9 ZIP hash, consumed local challenge report, A14 signature-chain outcome, A13 stability hours, independently reported originals, out-of-band replay anchor and distinct human owner/reviewer. These are only JSON shaped documents and **not independently authenticated** by the combiner; even the complete synthetic path returns `ready-for-separate-owner-closure-decision`, with ALL permissions false.

**4. Automated qualification** (`verify-analysis3-a15.yml` + adversarial tests). Read-only GitHub Actions, SHA-pinned allowed actions, no stored secrets, no production Supabase access, no hosted preview, no real device emulation mislabelled as physical, no static screenshot goldens altered, no merge/tag/deploy/DB writes, and default-closed release/approval assertions.

## Original hard prerequisites remain OPEN

- **A10 isolated HTTPS preview:** dedicated authorized preview host and eight independently verified original HTTPS response bytes absent.
- **A11 physical acceptance:** Android Chrome **0/7**, Samsung Internet **0/6**, installed PWA **0/5**; original same-origin SW upgrade/rollback, independently witnessed previous stable restore and independent evidence review absent.
- **A11 owner acceptance / A12 production authorization:** neither an independently verified owner acceptance nor a separately scoped release window/target approval has been produced. No A12 actual deployment.
- **A13 actual postrelease evidence:** 24–72h real one-minute P20 production SLO observations, physical postrelease player-state/PWA checks and independent signed operational handoff cannot yet have occurred.
- **A14 and A15 signer/challenge governance:** source-controlled A14 registry deliberately holds zero human public keys; no human signatures, hardware/device approvals, independent durable challenge-issuance/consumption ledger, externally attested anchor or independent key rotation review exists.

## Safe local usage

```sh
# No remote calls by default. Verify a previously sourced local ORIGINAL offline ZIP:
node analysis3/a15-public-evidence.cjs /isolated/operator/source/gomoku-analysis3-a9-offline-candidate.zip

# Default-deny documentary closure:
node analysis3/a15-operator-closure.cjs

# Independently authorized public GitHub readback is a JavaScript API:
# await require('./analysis3/a15-public-evidence.cjs').readback({approved:true})
# Call only after operator authorization; it fetches metadata from pinned GitHub public URLs.
```

For the local ledger, use its API from a **separate authorized operator** workstation and a secured existing directory. Do not run issuance/consumption during synthetic CI except in disposable test folders. Do not substitute local ledger receipts for independently witnessed upstream challenge custody. Signatures and signers must be reviewed out-of-band, not fabricated in code or automated by the assistant.

## Next: A16 — Independently Witnessed Release Evidence Integration & Final Acceptance Preparation

**Status: not started.** Objectives: external replay-ledger interface with authenticated operator custody, signed immutable archive reconciliation, independently reviewed trust pin/rotation and revocation evidence, hardened exact-head/asset acceptance, witnessed rollback/physical-device review, and a genuine human-operated release decision packet. No merges, tags, deployments, migrations, live player-data access, or human signoffs may be assumed or executed without separate authorization.
