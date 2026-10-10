# A24 — Authentic External Evidence Intake & Human Release Boundary Readiness

**Status:** nondeploying source implementation, separately stacked on A23 draft PR #83 exact qualified SHA \`d36610bc49aa0cee03f3a649108fda98e99094ee\`. All six parent jobs/logs and independently downloaded A23/R4/P21/P23 SHA-256/CRC original artifacts were verified before branching. This stage addresses **operational collection**, not additional synthetic release certification. No remote preview or physical phone has been accessed.

## Ready-to-use operator artifacts

### 1. Original dedicated HTTPS response evidence: offline import without touching the hosted site

**Prerequisites before any human operator collects actual hosted responses:** independently authorize the precise dedicated isolated HTTPS \`.vercel.app\` preview, original immutable A9 source SHA, the operator, time window, permissible data categories, original-byte retention and the separate reviewer/custodian. This repository **does not grant that permission**. Do not probe an unapproved host. Never capture player personal data, cookies, tokens, session headers or production endpoints.

From a local copy containing the checked-out A24 branch:

\`\`\`bash
node analysis3/a24-capture-template.cjs \
  --origin https://your-authorized-isolated-preview.vercel.app/ \
  --operator "REAL_ORIGINAL_OPERATOR_ID" \
  --out /private/a24-blank-original-capture.json
\`\`\`

The template is **deliberately incomplete and unapproved**. It enumerates the eight exact original A9 static files and safe response paths (\`captured/index.html\`, \`captured/sw.js\`, \`captured/manifest.webmanifest\`, and five icon originals). It performs **no HTTP request**. On a separately authorized workstation, record real **GET 200, no redirects, no cookies/credentials, body bytes as decoded identity bytes**, exact request/response URL, UTC capture time, original byte length, SHA-256, immutable operator and independent provider object identity. Preserve the original eight response bodies under a separate controlled evidence root in the exact generated paths. The \`capturedSha256\` and \`providerObjectSha256\` must be computed from the preserved bytes, not typed by guesswork.

Prepare the **verified original A9 static asset directory** from the original GitHub A9 workflow artifact using the existing \`a10-stage-preview.py\` script. Then, after completing the manifest accurately:

\`\`\`bash
node analysis3/a24-offline-intake.cjs \
  --manifest /private/a24-capture-completed.json \
  --capture-root /private/retained-a24-originals \
  --original-root /private/verified-a9-static \
  --out /private/a24-host-byte-review-no-approval.json
\`\`\`

It checks actual original bytes against all eight A9 CI static assets and rejects redirects, URL/host mismatches, cookies, symlink/path-traversal, wrong SHA/size/source, duplicate/foreign objects, future times and oversize objects. It writes a **0600 protected, no-overwrite** JSON receipt; **no hosted network request happens**. Even eight matching source bytes **do not prove they were served by a real host**, that the owner authorized it, or that external provider administration is authentic. All decisions remain \`NO_GO\` and \`NOT_GRANTED\` until independent human checks outside this automated process.

### 2. Actual 18 original Android + seven accessible-use observations: incremental intake

Open **\`analysis3/a24-field-kit.html\`** locally. It contains the actual 7 Android Chrome, 6 Samsung Internet, 5 installed Android PWA and seven accessibility original case selectors; actual media file hashing via browser WebCrypto, device/OS/browser/operator attribution and notes, online-only scope validation (no GET), and local SW/prior-stable byte review. Use it on a controlled computer after separately obtaining permissions. **Do not put protected player data in the notes or export.** It refuses duplicate media evidence and exports only **pending** hash receipts, not the underlying original binary. Do **not** treat the browser's mobile viewport tests as physical Android.

For a precise filesystem-based independent intake, save original media in a separate witness-controlled folder. A partial manifest can cover a single observed case or any subset. Media paths use \`media/<platform>/<case-id>.bin\` and \`assistive/<accessibility-id>.bin\`; the original byte SHA and device/OS/browser/operator + rights original hash, observation and UTC time are mandatory. **No physical result can be marked accepted** by these importers.

\`\`\`bash
node analysis3/a24-field-intake.cjs \
  --mode field --manifest /private/field-originals.json \
  --root /private/retained-device-originals \
  --out /private/a24-field-pending-review.json
\`\`\`

The returned report lists genuinely SHA-verified (but **not device-authenticated**) originals and missing cases, enabling incremental work, keeping \`physicalAccepted=0\` and all release authority false. An independent human must review original hardware, permissions, media custody and seven accessible-use evidence decisions individually.

### 3. Distinct real previous-stable and service-worker restoration contract

Preserve original \`sw/before.bin\`, \`sw/updated.bin\`, \`sw/reverted.bin\` and **distinct** \`prior/previous-stable.bin\`. The A24 rollback manifest contains their four SHA-256 values, previous A23 head/A9 source and explicitly \`ownerRestoreApproval="NOT_OBTAINED"\`, \`realSameOriginUpdatePerformed=false\`, \`realPlayerDataRestored=false\`, and \`realProductionTouched=false\`.

\`\`\`bash
node analysis3/a24-field-intake.cjs \
  --mode rollback --manifest /private/offline-rollback-originals.json \
  --root /private/retained-rollback-originals \
  --out /private/a24-rollback-pending-review.json
\`\`\`

This checks byte hashes, requires a **version change and exact revert**, and distinguishes a prior-stable binary from A9's ZIP. It does **not** install the PWA, update a live same-origin SW, restore player records or authorize an actual rollback. Preserve separate actual original deployed-stable provenance and owner approval before any later permitted real operation.

### 4. Independent human staging, release and incident custody

Use the existing A20–A23 signer rotation/revocation, external global replay chronology and separate owner pre-release/post-release contracts for **review only**. They intentionally have **empty source real trust registries**. Collect actual signed original owner/custodian identities and externally administered append-only nonce source evidence outside CI; do not provision a signing key, operate a production ledger or sign in as a real owner through a synthetic workflow. Any conflicting operator, compromised-signer or double-consume original must remain **BLOCKED**, requiring separately verified human arbitration.

**Staging human review** is distinct from actually authorized and executed **A12 production cutover**. Only a real A12 cutover plus real **24–72 hours A13 minute-level P20** monitoring and independently reviewed postrelease physical/incident originals can form a subsequent owner closeout request. The A24 tooling **cannot merge, tag, deploy, migrate, authorize, approve, close, purge or touch player data**.

## CI & adversarial acceptance

\`test-a24-operator.cjs\` tests actual immutable A9 candidate file bytes under synthetic offline-capture fixtures, exact host/asset/response rejection, original SHA and filesystem path safety, partially observed Android/accessibility media, local receipt generation, and offline-only rollback. \`test-a24-browser.py\` runs **real localhost Chromium** desktop/mobile-emulated browser with actual local binary file uploads and \`crypto.subtle\` SHA-256, duplicate refusal, 7/6/5+7 checklists, host scope/no-network, before/update/reverted/prior media, unsigned export, keyboard and 200% zoom. \`.github/workflows/verify-analysis3-a24.yml\` uses pinned immutable read-only Actions to re-download the original successful A9 artifact, verify original ZIP and eight asset bodies, run all tests and store a synthetic-only source-bound \`NO_GO\` artifact. No production hosts requested, no screenshot goldens modified.

## Genuine external gates — all OPEN

- **A10 HTTPS:** zero separately owner-authorized live original response observations.
- **A11 physical:** **Android Chrome 0/7, Samsung Internet 0/6, installed Android PWA 0/5**, with seven genuine assistive originals and actual observer consent still unverified.
- **Rollback:** no real same-origin service-worker version change/reversal, previously deployed original backup restore or saved player-state verification.
- **Human/global trust:** no independent real signer keys, owner rights approvals, independently administered external globally consistent single-use replay authority, or real A11 human acceptance.
- **A12:** no separately authorized or executed production cutover; no merge, deployment, migration, tag or publication.
- **A13:** no genuine postrelease 24–72h P20 telemetry, incident/device follow-up or human owner closeout.

## Next A25 — Operator-Supplied Evidence Intake, Real Acceptance Handoff & Release Readiness

**Implementation status: NOT STARTED.** Prioritize processing actual owner-authorized hosted/media originals supplied by independent operators, resolving real evidence inconsistencies, and keeping pre- and post-release signoffs separate. No additional synthetic-governance-only phases unless tied to a demonstrated operational blocker.
