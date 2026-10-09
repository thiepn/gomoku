# A7 — Analysis 3.0 release-candidate qualification and rollback

**Status:** Candidate-source branch under QA. No release tag, deployment, or merge is authorized by this document.

**Source of truth:** `phase/a7-release-qualification` -> PR (stacked on A6). Keep the frozen Gomoku 1.0 `main` independent. The existing P26/P27 production controls refer to **1.0.0 only** and must not be reused as proof that Analysis 3.0 is ready.

## Release model

A7 deliberately separates three states:

| State | What is established | Next action |
|---|---|---|
| `blocked-automated` | An A0–A7 test, deterministic artifact, or baseline failed/missing | Fix, push and rerun whole gate |
| `awaiting-physical` | Automated gate passed for one SHA and one immutable build | Obtain device evidence for Android Chrome, Samsung Internet and installed Android PWA |
| `awaiting-owner-approval` | Automated and required physical checks passed | Obtain explicit approval for the exact SHA and binary hashes |
| `release-qualified` | All three preconditions passed | Prepare a separately approved merge/deploy procedure; no automatic production action |

An automated CI success is **not** a physical-device pass, a claim of Elo increase, or a production release. The attached `analysis7-test-output/a7-qualification.json` contains checks tied to the tested source commit and three SHA-256 artifacts, plus explicit missing evidence. The output is an **execution artifact**, not a committed certification or self-approved release.

### CI gate

`.github/workflows/verify-analysis3-a7.yml`:
1. Validates JavaScript/Python syntax and preserves the 40 original immutable game modules (outside authorized modular UI seams).
2. Builds `index.html` and `sw.js` offline from checked-in modules. Checks single inlining, exact source parity and a second idempotent build.
3. Runs every previous A0–A6 tactical, proof, Renju and practice test, plus 20 A7 fail-closed release/rollback test cases.
4. Executes the existing native WASM move-40 counterattack benchmark on quick/standard budgets and writes factual runtime/defense data, **not** Elo.
5. Checks desktop/mobile Chromium interactive flows, accessibility/keyboard/touch/reduced motion, saved-game and study-tree preservation, existing trainer and worker behavior.
6. Reloads the service-worker-controlled application with network physically disabled in Chromium and checks cache scope, invalid-response poisoning, and non-Gomoku route isolation.
7. Records CI receipts *after* each successful stage only. The automated evidence document is invalid if code or generated artifacts change mid-run.
8. Uploads SHA-bound JSON, screenshots, native benchmark rows, offline test logs and built HTML/worker artifacts. It synchronizes generated portable files **only to the A7 branch** after all automated tests pass, and only when a staged change exists.

CI can get to `awaiting-physical`, not beyond it. A7 has no workflow that merges to `main`, makes a production release, creates an unconditional version tag or updates domain DNS.

## Physical Android signoff (required and not faked)

Use `analysis3/A7-DEVICE-EVIDENCE.template.json` as a human verification worksheet. Check all of these on a **specific build from a candidate preview**, not merely on existing 1.0 production:

- **Chrome on a physical Android device** — clean startup, game start/finish, rule variants including Renju, review and verified threat proof, variation reset, 225-cell board, training, due queue, no horizontal overflow, background/resume and reconnect.
- **Samsung Internet on physical Android** — same required game/review/training actions and a full background/resume/offline/reconnect loop.
- **Installed Android PWA** — install from candidate origin, fresh standalone boot, launch while offline, saved game/training persistence across process shutdown, background and recovery, safe service-worker update, retained original progress.
- Additional recommended: iOS Safari, installed iOS PWA, tablet landscape and desktop Firefox/WebKit where facilities permit.

Record actual device model, Android version, exact browser version, URL, tested `index.html` SHA-256, candidate git SHA, date, observed results, screenshots/logs, limitations and tester attestation. Complete **all required test-case IDs** for each device; every case needs a distinct `status: "passed"` and a concrete `observation`. Include the named tester, `issuer`, timestamp, tested HTTPS preview URL and human signature. Generic "tested fine" notes cannot satisfy the gate.

After downloading the A7 CI evidence artifact, copy `a7-qualification.json` into `analysis7-test-output/`, complete the separate device worksheet, then run:
```sh
node analysis3/a7-report.cjs verify-physical ./completed-A7-DEVICE-EVIDENCE.json
```
This compares the worksheet's source SHA and all three artifact hashes with the original CI candidate. The resulting `analysis7-test-output/a7-attested-qualification.json` reports missing tests and approval; it does **not** tag, merge, release or deploy. Missing, stale or mismatched SHA evidence must block promotion. A Chromium 390px test is not physical testing.

## Acceptance thresholds and evidence

- **Critical correctness:** Zero known failing Renju legality, verified forcing proof, after-position versus avoidability, game-history immutability or import/export tests. Inconclusive search stays unknown.
- **Persistence:** Zero loss/corruption of saved games, mistake events, review schedule, or original variations in tested offline/resume paths.
- **Runtime:** No unbounded cache growth; <=24 results, <=4 MiB serialized cache, expiration and worker abort/restart pathways tested. No invented universal latency gain; measure actual elapsed work by device.
- **Accessibility:** Interactive board remains keyboard-operable with properly labeled coordinates, dialog controls reachable at 390px and 768px, visible reduced-motion state and no horizontal overflow.
- **Offline:** First install succeeds online, subsequent offline reload works on supported origins, unrelated site routes remain untouched.
- **Security:** No exfiltrating runtime telemetry, authenticated API interception, automatic release/rollback or credential exposure.

Only absolute blocking correctness defects should be changed after qualification; any source change invalidates the prior evidence and requires the full A7 gate again.

## Promotion (future, separately approved)

1. Confirm a final immutable source SHA and generated `index.html`, `sw.js`, `manifest.webmanifest` SHA-256 values.
2. Review complete CI output and signed-by-tester physical matrix; verify all refer to the **same exact artifacts**, not mutable URLs alone.
3. Request explicit owner approval for the exact SHA and hashes.
4. Merge the stacked changes through the correct `thiepn/gomoku` GitHub account, verifying CI and authorized ancestry; avoid pushing the other connected account or mistaking another fork for the production repository.
5. Preserve the previous production commit and static artifacts (preferably an immutable tag or release) before altering GitHub Pages.
6. Deploy the approved artifact through the established GitHub Pages workflow, verify real domain, install/update and persistence; record what was deployed and its hash. Treat previously registered service workers as a rollout-specific risk.
7. Do **not** modify the existing `v1.0.0` tag or present P27 as Analysis 3.0 release evidence.

This sequence is **not performed** by A7 CI.

## Rollback plan (only when independently approved)

If production regression is substantiated:

1. Halt further candidate pushes/promotions and capture failure, user impact, current live artifact hashes and last proven previous version.
2. Verify that previous release source and its `index.html`/`sw.js` checksums are intact.
3. Obtain explicit owner approval tied to the rollback SHA and destination.
4. Restore last verified static site artifacts via a regular GitHub PR/approved deployment; do **not** force-push or delete personal IndexedDB/localStorage data.
5. Monitor the service-worker replacement/update path. Some offline clients may temporarily continue using cached files; never silently clear their stored games.
6. Re-run smoke checks for online/offline gameplay, import/export, training and device cache recovery. Document incident and hold new releases until fixed.

`node analysis3/a7-report.cjs rollback-test` is a **dry-run policy assertion** and does not make any production changes.

## Next

The phase is complete only when automated QA passes and a release candidate can be identified by an immutable SHA/hash evidence report. Public shipping remains blocked until physical-device attestations and explicit owner approval. This is expected, not a reason to mislabel the automated candidate as production-ready.
