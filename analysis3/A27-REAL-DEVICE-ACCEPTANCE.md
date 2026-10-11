# A27 - Real Device, Hosted-Origin and Human Witness Acceptance

Status: **Engineering only, source-only, nondeploying. RELEASE NO_GO.** Base A26 draft PR #86 exact head 407bfb88430539932ab6bf07df1b33ae7b86829c. Seven A26 exact-head jobs completed successfully; five retained ZIPs independently verified with SHA-256 and ZIP CRC. All consecutive heads/bases in PRs #60–#86 match. **No A27 actual physical/human/host test has been conducted.**

## Operating distinction

- The local worksheet is not a hosted PWA, device simulator, approval service or release pipeline.
- Each of 25 cases starts NOT TESTED. PASS/FAIL are **operator-reported physical observations only**, never actual independently human-certified acceptance. A PASS with verified originals is still NOT human signed.
- Source SHA does not establish device authenticity, consent, legal rights, signer identity, provider or production approval. No standalone release qualification follows from CI or locally entered data.
- The only valid claims are PASS, FAIL and NOT TESTED for a genuine manually observed case. If not executed, leave NOT TESTED. When an actual defect is observed, record FAIL and its reproduction even if original media is not preserved yet. Such failures require triage.
- Do not store private media, human names, original player data, credentials, signing keys or observations in GitHub PR comments, Issues, source, CI or public sites.

## One case at a time: case 1 of 25

**Android Chrome / fresh-launch** is the only currently proposed hands-on test.

**Prerequisites — these MUST be separately approved before actually opening a hosted page:**

1. Owner permission for a dedicated isolated non-production HTTPS preview, with exact origin and appropriate rights. Production aliases and personal/player accounts are prohibited.
2. Actual Android device with Chrome and its genuine model, OS and browser versions.
3. Permission to preserve original capture/rights and independent witness source files if recording a PASS.
4. An independent human authorized by the owner to validate identity, consent, original custody and observed findings. No credentials should be passed to A27.

**After explicit authorization:**
1. Exit Chrome completely on the real phone and reopen Chrome.
2. Manually navigate to the owner-authorized isolated HTTPS preview. The offline worksheet never fetches it.
3. Confirm a fresh load, the visible playable board, responsive touch controls and primary game navigation. Record exact reproducible issues if present, without touching protected production data.
4. If a genuine physical success was observed AND original device-media, rights/intake and witness files were already preserved in the A26 custody workflow, the local desk can record operator-reported PASS after SHA recheck. This still carries zero independently certified physical approval. Record a genuine failure as FAIL; if you did not conduct the test, leave NOT TESTED.
5. Export the private report, reverify against original files with the A27 offline CLI and hand original evidence to a separately authorized human reviewer.

Only after this individual case is actually observed, proceed to the next case through the worksheet.

## Categories and counts

- Android Chrome: fresh-launch, rules-renju, review-proof, training, offline-reconnect, resume, accessibility — 7
- Samsung Internet: fresh-launch, rules-renju, review-proof, training, offline-reconnect, resume — 6
- Installed Android PWA: install-preview, standalone-launch, offline-launch, saved-data-relaunch, service-worker-update — 5
- Accessibility: screen-reader, keyboard-or-switch, zoom-200, reduced-motion, focus-order, contrast, offline-state-persistence — 7

**Current genuine observations: 0 PASS, 0 FAIL, 25 NOT TESTED; 0 independently human accepted.** No case-specific PASS/FAIL may be manufactured from desktop Chromium, synthetic source files or saved metadata.

## Local offline desk

Open analysis3/a27-one-case-desk.html only on a private authorized workstation. It has a restrictive CSP, no external requests, no persisted browser state and manual, one-case navigation. The private export retains observations and may contain sensitive notes, so protect it appropriately. It never contacts the typed HTTPS host.

### A27 offline Node verifier

For an empty NOT TESTED manifest, or an actual FAIL without retained originals, run:

    node analysis3/a27-field-intake.cjs --observations /private/a27-observations.json --out /private/NEW-a27-NO_GO.json

For a source-backed PASS (or FAIL with originals), independently rehash all three original files against the A26 pending-only receipt:

    node analysis3/a27-field-intake.cjs \
      --observations /private/a27-observations.json \
      --a26 /private/a26-pending-handoff.json \
      --media-root /private/originals \
      --rights-root /private/originals \
      --witness-root /private/originals \
      --out /private/NEW-a27-NO_GO.json

The CLI uses canonical private custody paths, rejects altered or symlinked source files, duplicate cases, future observed times, unsupported origins, malformed or unauthorized claims, and refuses overwrite. Its JSON output uses mode 0600 and contains no original binaries or detailed private observation notes. No actual independent human acceptance can be granted by CLI.

## Genuine hosted HTTPS source provenance — not yet obtained

Use the existing A25 blank eight-asset capture worksheet and A24 importer only once separate real owner permissions are obtained. An actual independent operator would need to preserve all eight original HTTP response bodies and trusted request/response metadata and provider witness. A9 CI originals and localhost tests do not qualify as live-host observations. The existing A24 scope is dedicated isolated *.vercel.app; a Cloudflare Pages host is not automatically A24-compatible, and a separate authorized source-scope adaptation would be needed. A27 itself performs **zero GET/POST or any other remote request**.

## Real independent human / recovery handoff — not yet obtained

Original media, legal rights, informed consent, actual physical hardware observations, independent signer identity, revocation, global replay and owner A11 approval must be authenticated by a separately governed human/operator process. A27 cannot provision signing keys, grant consent, certify any test, or adjudicate conflicting custody alone.

Real same-origin installed PWA service-worker update/revert, distinct previously deployed stable original, off-device backup and saved player-state restoration remain NOT TESTED; never clear live storage to simulate them. Owner-approved A12 cutover is a distinct later decision. A13 24–72h actual production monitoring cannot occur before an authorized deployment.

All source changes stay unmerged and nondeploying. No owner-approved hosted request, release workflow dispatch, merge, tag, deployment, DNS change or production-data operation is implied by this runbook.
