# A9 — Immutable Release Candidate and Installable Preview Qualification

**Project:** `thiepn/gomoku`. **Stack:** A9 above A8 PR #68. `main` is still the frozen 1.0 release. This phase creates an auditable **offline PWA package**, not an approved production release.

## Purpose and deliverables

A8 has passed the full integrated A0–A8 suite, and its generated shell (`index.html` and `sw.js`) is already committed. A9 **freezes those exact app files** and checks whether the resulting static site is distributable without missing or mismatched assets.

The A9 workflow (`.github/workflows/verify-analysis3-a9.yml`) runs **read-only** with `contents: read`, and has no git push, release, DNS, Vercel or Pages deployment step.

- `analysis3/rc9-core.cjs`: pure, fail-closed audit of the source commit, PWA scope/manifest, service-worker cache version, eight static assets, seven actual CI stages, individual physical-device cases and owner approval. `canDeploy` is **always false**, even if the owner later approves the candidate.
- `analysis3/test-a9.cjs`: 26 adversarial contract tests covering stale SHAs, wrong artifacts, skipped CI stages, fake physical evidence, missing observations, wrong preview URLs and unauthorized owner approval.
- `analysis3/rc9.cjs`: CI-only candidate creation / per-stage receipt signing-by-attribution, exact artifact SHA-256 verification before each stage, final machine-readable receipt and status. SHA-256 identifies files but does **not** cryptographically attest a human device test.
- `analysis3/rc9-package.py`: deterministic eight-file offline site ZIP (includes `index.html`, `sw.js`, PWA manifest and five icons) plus source/hash identity. Fixed ZIP timestamps, sorted filenames, no symlink/traversal paths and exact per-file SHA-256 verification.
- `analysis3/test-a9-package-browser.py`: extracts the ZIP into a temporary root, launches **the extracted copy** on a real HTTP localhost origin with Chromium, tests game initialization, manifest and icons, service-worker control, then reloads while Chromium is fully offline.
- `analysis3/A9-PHYSICAL-DEVICE.template.json`: **unfilled** Android Chrome, Samsung Internet and installed Android PWA acceptance matrix. This is deliberately not pre-attested.

## Strict CI acceptance

CI stages are tied to a **single git SHA, one GitHub Actions run ID, one generated `index.html` SHA-256 and eight asset hashes**:

1. Source parity and frozen static artifacts (no workspace diff after `review/build.py`, `ui/build.py`, `analysis/build.py`).
2. Full A0–A9 model, Renju, proof, practice, cancellation, backup and rollback regressions.
3. Native engine threat benchmark on its real fixtures (not Elo).
4. Deterministic second offline build with unchanged committed `index.html` / `sw.js`.
5. Full existing A3–A8 and legacy desktop/mobile-emulated interaction suites.
6. Real Chromium service-worker install and offline reload checks.
7. Exact offline ZIP integrity and **real browser test of the extracted bundle**.

The workflow marks a stage passed **only after its corresponding commands exit successfully**; any source/build hash drift aborts the receipt. The audit report in `analysis9-test-output/rc9-candidate.json` is an artifact of the **specific CI run**, not a committed blanket certification.

### Running a package locally

After the A9 workflow is green, download its `analysis3-a9-immutable-candidate-evidence` artifact from GitHub Actions. In the extracted files, see:

- `analysis9-test-output/rc9-candidate.json` — SHA-pinned source and per-stage evidence.
- `analysis9-test-output/rc9-status.json` and `RC9-STATUS.md` — honest release hold.
- `analysis9-test-output/gomoku-analysis3-a9-offline-candidate.zip` — frozen PWA shell.
- `analysis9-test-output/a9-package-browser.json` — automated ZIP boot and offline checks.
- Native benchmark output, baseline browser screenshots and recovery logs.

**Important:** A ZIP is an offline distribution artifact, **not** an Android APK and not a publicly installed HTTPS PWA. Android installation/update must be checked from the *same byte-identical assets* on an isolated **HTTPS preview URL**. Do not label localhost Chromium as physical Android validation.

## Manual physical verification and owner approval

Use `analysis3/A9-PHYSICAL-DEVICE.template.json`, copied to a **separate local file**. Fill in exact source SHA, `index.html`/`sw.js`/`manifest.webmanifest` hashes from the A9 receipt, public HTTPS candidate URL, and actual device observations.

The matrix requires all tests on each:

- Physical Android Chrome: 7 cases, including rules, tactical proof, training, offline/reconnect, suspend/resume, and accessibility.
- Physical Samsung Internet: 6 cases with the same critical interaction families.
- Installed Android PWA: 5 cases including install, standalone/offline launches, saved progress after process restart and service-worker update.

Every physical case requires its own **pass + concrete observation**, not an undifferentiated green status. Device model, Android/browser version, tester, timestamp, attribution and tested preview URL are mandatory. Changes to the packaged app invalidate this evidence.

The owner must explicitly approve the same exact source SHA and `index.html` hash. Then, from the checked-out candidate plus the *same downloaded CI receipt*, run:

```sh
node analysis3/rc9.cjs verify-physical /path/to/completed-A9-DEVICE-EVIDENCE.json
```

The output is `analysis9-test-output/rc9-device-assessment.json`, which **still cannot deploy anything**.

## Release and rollback boundary

No A9 workflow merges stacked PRs, pushes static assets to production, signs a GitHub release, modifies PWA origins, or deletes the existing local game/training databases. If physical test or owner approval is missing, the candidate remains **`awaiting-physical`** or **`awaiting-owner`**.

Before a separate authorized production promotion, retain the last-known-good 1.0 commit and static artifacts for rollback. A service-worker update may be delayed on offline clients; do not promise an immediate switch. A bad release must be reverted with a new approved deployment, not by clearing player storage or force-pushing `main`.

**Next after A9 CI is green:** publish a separate byte-identical HTTPS *candidate preview* with explicit permission, complete physical Android/device signoff, then request approval of the exact source/hash and perform an independently authorized merge/deploy. No further feature phases should bypass these gates.
