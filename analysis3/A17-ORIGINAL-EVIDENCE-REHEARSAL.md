# Gomoku A17 — Authorized original evidence collection and isolated operations rehearsal

**Implementation scope:** `phase/a17-authorized-evidence-rehearsal`, stacked directly on A16 draft PR #76 qualified head `bb868a84d24f622f8f5dcab64756c803228db8d0` (six automated exact-head checks successful). **Source development only. No production release or real-device acceptance has occurred.**

## What was actually implemented

- `a17-operator-gate.cjs`: narrow opt-in scope worksheet with exact A9 source, A16 head, allowed operations, dedicated HTTPS preview origin, distinct operator and stated approver, supporting digest references, unique scope nonce, and a ≤1-hour expiry. A plain JSON scope is **not authenticated permission**. Actual permission must be independently granted and verified by the authorized owner before a real host query or physical operation; CI uses synthetic scope values.
- `a17-preview-collector.cjs`: GET-only, explicit fetch transport injected by an authorized operator. Checks exact eight original A9 source file digests, response URL exactly equal to expected, redirects blocked, no cookies/credentials, tight response size and streaming bounds; enforces no source drift, no unapproved hostname and no remote query on denial. Reports `preview-bytes-observed-unsigned`, **never** real owner approval. CI injects mock HTTP responses backed by the **actual original A9 archive bytes**; no hosted preview requests in CI.
- `a17-physical-worksheet.cjs`: 18-case original browser/PWA matrix (Android Chrome 7, Samsung Internet 6, installed Android PWA 5), all initially `not_tested`. Case submission requires exact scope, physical operator/device context, dated narrative, digest referencing independently preserved original evidence, and returns `observed_pending_independent_review` only. No case is automatically accepted even when all are filled, and no real physical tests were performed by this branch.
- `a17-isolated-restore.cjs`: distinctly identified *previous stable image* plus original exact-A9 static assets, eight whitelisted SHA-matched byte reads, reject symlink/source drift, operate **only** in a new isolated local workspace, transition to the A9 candidate and restore previous stable, preserve a **synthetic-only** saved-record sentinel, clean up rehearsal files. Disallows real player data and conflating A9 candidate ZIP with the previously deployed stable archive. This is NOT a real player-backup restore or production rollback.
- `a17-external-custody.cjs`: read-only review of one original A15 local issue/consume chain and a separately described append-only provider record, with exact challenge, original source, A16 head, record digests, timestamps, deployment/packet scope and dual Ed25519 custodian/reviewer witness identities via A16 verification. No external ledger provider, key, credential, blockchain or tamperproof repository is provisioned. Authenticity, permanence and human custodianship still need independent verification.
- `a17-release-desk.cjs` and `a17-evidence-desk.html`: an explicit nine-gate `HOLD` report and a responsive offline human evidence intake UI. Physical counters start **0/18**, every case is NOT TESTED, and exporting creates an **unapproved local draft** only. Includes no API writes, credentials, production actions or ability to approve.
- `test-a17-evidence.cjs`, `test-a17-browser.py` and read-only workflow: original byte-backed adversarial mocks, isolated directory rehearsal and synthetic Ed25519 custody checks; **actual desktop/mobile-emulated Chromium** keyboard/filter/zoom/offline draft checks served from localhost. Not actual Android Chrome, Samsung Internet or an installed real PWA. No screenshot golden changes.

## Actual evidence vs missing real authorization

The originally qualified A9 GitHub Actions ZIP `37922288752` / artifact `11612273760`, locked source `fca45816ed7d3a95bae550b9aa644e29053875f6`, nested ZIP SHA-256 `186765f892cc245f198f3bef8c32b853e6c53f0d8727bdc347c7db17fd943275`, and all eight file hashes are independently rechecked in isolated CI. **These are real original CI byte checks**, not real live-hosted response bytes or physical-device approvals.

External gates still OPEN:

- Dedicated independently authorized isolated `.vercel.app` HTTPS preview and actual original-byte live GET observations — **not executed**.
- A11 physical Android Chrome **0/7**, Samsung Internet **0/6**, installed Android PWA **0/5**; independently witnessed service-worker version-changing update and reversal — **not executed**.
- Original physical device evidence, owned profile/save data persistence, original distinct previous stable image restore and independent reviewer/owner signoff — **not collected**. The isolated synthetic file rehearsal cannot be used as player data restore evidence.
- Independent authentic source-scoped A11 owner approval and **separately** authorized A12 target/window/change; actual production cutover — **not executed**.
- A13 authentic 24–72h P20 original minute-level service/persistence/recovery observation, postrelease device/session/incident review — **not collected**.
- Actual A14/A16 public human signer trust roots, independently administered replay ledger, externally attested custody/hardware trust and human closure authorization — **not provisioned**.

**Every A17 report sets `canMerge=false`, `canTag=false`, `canDeploy=false`, `canModifyProductionData=false`, `canCertifyPhysical=false`, `canCloseRelease=false` and `canGrantOwnerAuthority=false`.** No script executes a real release or automatically upgrades synthetic notes to human acceptance.

## Safe operator workflow

1. Obtain genuine separate authorization for a **dedicated isolated preview**, exact source SHA, approved origin, expiry and operator/reviewer identities. Independently authenticate the owner-granted scope; editing a JSON worksheet does not constitute approval.
2. From a trusted operator workstation, supply original immutable A9 candidate receipt and optionally call the scoped preview collector with an explicit GET-only transport. Collect and retain original HTTPS response bytes independently and verify them against the original A9 ZIP; **do not call in CI**.
3. Open `analysis3/a17-evidence-desk.html` locally to see the untouched 18-case physical matrix. Export an **unapproved** worksheet. On genuine hardware capture dated original evidence, service-worker upgrade/reversal and independently verified restored state. An actual reviewer verifies original device provenance and signer fingerprints separately.
4. For a strictly local dry-run, use a separately authorized, canonical empty workspace, original and distinct prior stable **static** file sources with SHA-256 receipts, and a synthetic sentinel. Never pass player account databases or point at the actual website's production directory. Rehearsal auto-cleans the isolated workspace.
5. Authenticate third-party ledger implementation and independent approver/reviewer keys out of band; only then interpret A17 external custody checks as documentary readiness. Owner release consideration is separate from A12 actual production cutover; A13 operational closure is further separate and later.
6. Keep release state **HOLD** until real A11, A12 and A13 evidence exists. No silent merges, deployments, tags, migrations, publication or cache purge.

## Next A18 — Independently Attested Real-Environment Qualification & Release Gate Hardening

**Status: NOT STARTED.** Suggested objectives: scoped operator handoff from locally verified CI archives to actually authorized hosted preview, independently preserved network response attestation, physical Android/Samsung/installed-PWA accessibility and offline state acceptance, real distinct previous-stable restore rehearsal and global anti-replay custody; independently authenticated key/revocation review and owner-controlled cutover/closure decision separation. Any actual hosted/production/device operation still needs explicit human authorization; no signatures or devices are assumed.
