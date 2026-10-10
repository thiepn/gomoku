# A25 — Operator-supplied original evidence handoff and release-readiness workflow

**Qualified development base:** A24 draft PR #84, source HEAD \`a5ddd553386d4d5dfd9ad97bb432f47e2f8435af\`, with all six CI runs and full job logs verified; four original retained ZIP artifacts independently downloaded, SHA-256 and ZIP CRC checked. A25 is a separate nondeploying stacked draft. Never count public A9 CI file integrity or localhost Chromium emulation as genuine host, physical device, owner rights, provider or human approval.

## Improvement: practical handoff rather than speculative synthetic governance

**\`analysis3/a25-field-kit.html\`** is a responsive, offline browser worksheet. It uses WebCrypto SHA-256 on locally selected **original media AND a separately retained rights/intake source file**. The operator can work incrementally through **7 Android Chrome + 6 Samsung Internet + 5 installed Android PWA + 7 accessibility** original cases and see which remain missing. All case statuses are pending and 0/18 are real-human approved. Buttons now export actual source-compatible A24 field, rollback and blank eight-response host manifests rather than only an unsigned narrative report.

The exact uploaded media file can be saved unchanged via **Save selected original .bin**, and the separate rights original via **Save original rights document .bin**. The user's browser download location is **not** the final custody directory: the operator must independently move and preserve the original under the indicated controlled \`media/<platform>/<case-id>.bin\` or \`assistive/<id>.bin\` path, retaining actual SHA-matched rights originals under \`rights/<platform>/<case-id>.bin\` or \`rights/accessibility/<id>.bin\` in a controlled original custody root. No original binary is put into a JSON export or uploaded to a web endpoint. Avoid sensitive personal/player data in file names and notes.

**Import prior field manifest** checks exact immutable original source/branch, only pending states, unique case identities, correct original paths, byte and owner-rights SHA-256 shapes. Such claims are initially labeled **RESELECT ORIGINAL**, **not** counted as source-verified or human accepted. To restore a pending record after importing, the operator must select the media and rights files again; WebCrypto hashes must match both prior original SHA values. Different originals become a **BLOCKED custody conflict**; there is no automatic winner or overwrite.

### Handoff of actual source files for offline verification

The browser's A24-compatible JSON contains:
- \`format=GomokuA24FieldOriginalIntake\`, \`version=24\`, exact original A9 SHA \`fca45816ed7d3a95bae550b9aa644e29053875f6\`, exact parent A23 SHA \`d36610bc49aa0cee03f3a649108fda98e99094ee\`, \`humanOwnerApproval=NOT_OBTAINED\`, \`releaseState=NO_GO\`, \`physicalCasesAccepted=0\`;
- media original SHA, normalized expected \`originalFile\` path, claimed device/hardware/OS/browser/assistive technology, observation, operator and UTC time;
- a separate \`ownerRightsIntakeSha256\` calculated from supplied file bytes **without granting actual rights**.

Copy each separately protected media original to the appropriate custody directory and independently compare that SHA with the browser's unsigned handoff. Then execute the *existing* production-safe A24 CLI:

\`\`\`bash
node analysis3/a24-field-intake.cjs --mode field \
  --manifest /private/originals/field-a24.json \
  --root /private/originals/media-custody \
  --out /private/originals/field-no-authority.json
\`\`\`

**Do not** create or store genuine user-private/player files in GitHub branches, Issues, PR comments, CI artifacts or public cloud folders.

### Separate hosted source and rollback input

The browser can export an **empty** eight-response A24 HTTPS manifest after checking the dedicated isolated \`https://name.vercel.app/\` URL scope. **No GET or network request is performed.** Actual external capture requires separate authentic owner permission and independently governed operator original-custody rights. Metadata fields deliberately remain \`null\`; the server-response body must be preserved unmodified at \`captured/<A9 asset path>\`. Use the A24 original-byte importer and verified A9 static files after a human provides valid capture evidence:

\`\`\`bash
node analysis3/a24-offline-intake.cjs \
  --manifest /private/originals/host-capture.json \
  --capture-root /private/originals/host-bodies \
  --original-root /private/verified-a9-static \
  --out /private/originals/host-no-authority.json
\`\`\`

Likewise the browser's **A24-compatible rollback JSON** can be independently reviewed against \`sw/before.bin\`, \`sw/updated.bin\`, \`sw/reverted.bin\` and \`prior/previous-stable.bin\`. Original bytes may match without ever executing an actual installed PWA update, same-origin reversal, saved player-data restore or previous deployed stable cutover. Those real-world gates remain OPEN.

### A25 cross-source handoff assembler (actual source bytes)

**\`analysis3/a25-handoff.cjs\`** imports a verified partial A24 physical/accessibility manifest and its original binary directory, optional actual separately supplied eight-host-asset manifest/body/A9 original static root, optional distinct rollback originals, and an optional previous A25 review. It calls the real A24 original byte verifiers and **additionally reads and byte-SHA-verifies each separately retained rights source original**, without mistaking a SHA for legally approved rights; emits exact remaining cases, authenticated-*only-as-bytes* receipts and a review checklist of the actual remaining gates. A previously recorded case, host asset or rollback original changing SHA between handoffs is flagged **BLOCKED_INDEPENDENT_ORIGINAL_REVIEW**, with no automatically selected winner.

Example:

\`\`\`bash
node analysis3/a25-handoff.cjs \
  --field-manifest /private/originals/field-a24.json \
  --field-root /private/originals/media-custody \
  --rights-root /private/originals/media-custody \
  --host-manifest /private/originals/host-capture.json \
  --host-root /private/originals/host-bodies \
  --a9-root /private/verified-a9-static \
  --rollback-manifest /private/originals/rollback-a24.json \
  --rollback-root /private/originals/rollback-custody \
  --previous /private/originals/earlier-handoff.json \
  --out /private/originals/NEW-a25-handoff-no-authority.json
\`\`\`

\`--field-manifest\`, \`--field-root\`, \`--rights-root\`, and \`--out\` are required. Host and rollback flags must be supplied in complete groups. Every review output is a **0600-protected no-overwrite JSON** with original hashes, case IDs, blockers, conflicts, \`NO_GO\` and **zero real physical accepted cases**. It never includes media bytes or claims actual provider/human authentication. In a truly independent custody model, external signatures, source provenance and owner approval must still be independently verified; recomputable local SHA alone **does not authenticate the person or the server**.

### Independent signer/global replay, human release and postrelease handoff

A25 does not provision keys, alter an original external ledger, resolve a compromised signer or sign a cutover. It records independent signer/global replay provenance as **missing** unless valid external original custody is truly supplied and separately adjudicated by a human. Precutover staging/owner review differs from an actually executed separately approved A12 production cutover; postrelease operational closure additionally requires authentic 24–72 hours of A13 P20 telemetry, physical follow-up and owner signoff. The A23 original-source receipt review contracts remain default-deny. Operators must obtain real separately scoped permission **before** hosted requests, physical captures involving private data, or any release-impacting operation.

## Exact missing real-world acceptances

- Authorized original dedicated hosted HTTPS server and genuine independently witnessed eight-response provenance: **none**. A9 **CI bytes** are verified; no real hosted server approval or live observation.
- A11 physical Chrome **0/7**, Samsung Internet **0/6**, installed Android PWA **0/5**; seven real assistive-technology/accessibility originals and human witness decisions unapproved.
- No actual same-origin SW update/revert, separate true previously deployed original backup, saved player-state recovery or witnessed operator restoration.
- No independently provisioned real human owner/reviewer signing roots and revocation custody or true independently operated global replay/nonce service; A11 human approval missing.
- No separately authorized/executed **A12 production cutover**, merge, deployment, tag, migration, publication or player-data modification.
- No genuine **A13 24–72h** production monitoring/incident physical handoff and later real human owner closure.

## CI and real browser evidence (limited scope)

A25 runs existing A24 source tests and **new adversarial source-file handoff tests** using actual original public A9 CI archived bytes and explicitly **synthetic** external media. Real localhost Chromium desktop/mobile-emulated tests perform actual binary and rights source hashing, export browser-produced A24 field + rollback manifests, run them through A24 CLIs on preserved synthetic bytes, import/reverify and block mismatched bytes. Browser no-external-network, keyboard, 200% zoom and NO_GO assertions are retained. No screenshot goldens changed. GitHub Actions is read-only, immutable SHA pinned; retained artifacts contain **no private original media**.

## A26 — Original Evidence Acceptance UX & Authentic Human Witness Handoff

**Implementation status: NOT STARTED.** Next: real operator-received evidence reconciliation and custodian/source conflict review, safer protected media retention and consent workflows, practical source/UI defect repair, owner-approved hosted/source/device original case handoff, signer/global-replay incident disposition, and separately governed cutover versus postrelease acceptance. Further synthetic governance should only follow a demonstrated need. Never infer real-world consent from passing CI.
