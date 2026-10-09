# A10 — Isolated HTTPS preview and real-device qualification

**Repository:** `thiepn/gomoku`  
**Implementation branch:** `phase/a10-https-preview-device-qualification`, stacked on A9 PR #69.  
**Upstream qualified source:** `fca45816ed7d3a95bae550b9aa644e29053875f6` from successful A9 Actions run [37922288752](https://github.com/thiepn/gomoku/actions/runs/37922288752).  
**Immutable A9 ZIP SHA-256:** `186765f892cc245f198f3bef8c32b853e6c53f0d8727bdc347c7db17fd943275`.

This workstream is a **candidate preview**, not the production release. No A10 action updates `main`, `gomoku.thiepn.dev`, a Supabase production backend, the frozen 1.0 tag, or existing local player records.

## What A10 has implemented

The normal A10 GitHub Actions workflow (`.github/workflows/verify-analysis3-a10.yml`) has **read-only repository permission**. It downloads the artifact from the *specific passed A9 run*, verifies the original CI run ID/source SHA, checks that every original A9 stage passed, and compares the ZIP SHA-256 and individual hashes of all eight static application files. It then extracts exactly those eight files to a private CI directory, runs 16 adversarial preview-host/hash tests, and tests the package on a true Chromium localhost origin at 390, 768, and 1440 px, including simulated touch, service-worker install/control, offline refresh, icon/manifest availability, route isolation, and reconnect. It uploads the generated unmodified preview shell and report as a private GitHub Actions artifact. This operation **does not create an HTTPS site**.

A second workflow, `.github/workflows/a10-isolated-https-preview.yml`, is **manual only** and gated by the exact confirmation text `I_APPROVE_A10_ISOLATED_PREVIEW` plus the protected GitHub Actions environment `gomoku-a10-preview`. It will *fail closed* unless a dedicated, otherwise unlinked **Vercel project named `gomoku-a10-preview`** is explicitly configured and the deployment uses the specified THIEPN team. It packages **only** the previously verified eight files into static Vercel Build Output API v3; it does not rebuild the source code or touch production. It uses `vercel deploy --prebuilt --yes` **without `--prod`** to create a unique HTTPS preview URL. It then downloads all eight assets from that URL, compares their live bytes with the A9 SHA-256 manifest, and runs browser/PWA smoke tests on the actual HTTPS origin.

**As of initial A10 implementation, the connected Vercel team has no Gomoku preview project.** This means there is currently no preview deployment or verified HTTPS URL. Do not invent a URL or claim Android devices have been tested.

## Required preview hosting setup (one-time)

In the Vercel team `THIEPN's projects` (`team_LVo30en2fIX29vZH3gnYxmoi`), create a **separate project** named exactly `gomoku-a10-preview` **without a Git repository link or custom production domain**. It should contain no production environment variables, production deployment, database, or external API secrets. There is no reason to connect an online Gomoku backend or alter DNS; the A9 package is self-contained.

In GitHub repository settings, create environment `gomoku-a10-preview` with **required reviewers** and permitted deployment branch `phase/a10-https-preview-device-qualification`. Configure:

| Name | Type | Purpose |
|---|---|---|
| `A10_VERCEL_ORG_ID` | GitHub environment variable | Exact THIEPN team ID |
| `A10_VERCEL_PROJECT_ID` | GitHub environment variable | **New, dedicated** Gomoku preview project ID |
| `A10_VERCEL_CLI_VERSION` | GitHub environment variable | Reviewed, exact Vercel CLI semver (not `latest`) |
| `A10_VERCEL_TOKEN` | GitHub environment secret | Short-lived least-privileged access to this dedicated preview project |

Never paste the token into chat or commit credentials to GitHub. The workflow verifies Vercel project identity via authenticated API and aborts if it detects a Git link to another repository. It never runs `vercel --prod`, `vercel promote`, or a Git push.

**GitHub workflow-dispatch availability:** GitHub normally requires a manually dispatched workflow to exist on the repository's default branch before it can be dispatched from an alternate ref. Because A10 is still a stacked review PR, this hosted-publication workflow is currently *prepared, not necessarily dispatchable*. Do not merge the full candidate into production merely to make the preview button appear. A separate approved secure deployment workflow on the default branch (or equivalent authorized operator process) is required if dispatch is unavailable.

## Manual physical-device matrix — 18 human-only cases

`analysis3/a10-device-packet.py` generates an initially untested worksheet from the exact A9 CI hash receipt; this is a preparation aid, **not proof of a device pass**:

```sh
python analysis3/a10-device-packet.py \
  --candidate analysis10-test-output/a10-verified-preview.json \
  --url https://YOUR-ISOLATED-PREVIEW.vercel.app/ \
  --out analysis10-test-output/a10-physical-worksheet.json
```

The URL must already be real, HTTPS, and byte-matched by `a10-preview-integrity.cjs`. Record tester, timestamps, Android OS, browser version, device model, screenshots and observations for *every* required item. Avoid recording tokens, private account information or personal library contents.

### Physical Android Chrome (7 distinct cases)

1. **Fresh launch** on the **exact preview URL**, not on live production. Confirm fresh app boot, functional board and no fatal browser errors.
2. **Rules and Renju**: play Freestyle, Exact-Five and Renju; verify placement, win detection, forbidden-move behavior and input response.
3. **Verified analysis**: open completed game Review; verify ranking, proof navigation, before/after views and return to the original game without mutating history.
4. **Practice**: save a legitimate eligible mistake, enter the trainer, attempt, check due/review history, export a practice backup.
5. **Offline/reconnect**: install/cache online, disconnect all network access, reload, continue local interactions, restore connectivity without losing stored progress.
6. **Background/resume**: background/suspend the browser, return and verify the same game and learning records; force-close and relaunch for persistence.
7. **Accessibility**: touch target responsiveness, portrait and landscape, no horizontal overflow, text scaling, clear labels and functional accessible controls.

### Physical Samsung Internet (6 distinct cases)

Repeat fresh launch, variants/Renju, analysis/proof, saved practice, real airplane-mode offline/reconnect, and background/resume **in Samsung Internet itself**. Chrome emulation is not an acceptable substitute. Capture browser version and describe any Samsung-specific PWA or IndexedDB difference.

### Installed Android PWA (5 distinct cases)

1. **Install from the actual preview origin** via the browser install flow.
2. **Standalone launch** via installed icon; verify independent app window, correct URL/scope and responsive UI.
3. **Cold offline launch**: fully terminate the installed app, enable airplane mode and relaunch from the icon.
4. **Preserve saved data after process restart**: saved game, variations, practice events and review dates remain intact.
5. **Service-worker update**: under an independently approved preview update, install the new cache and prove the previous saved records survive. An update test requires a *controlled second preview version*; do not mislabel same-version reload as an update.

Each case requires an observed result of `passed`, a concrete observation, device information and tester attestation. Leave unsupported cases `not_tested` until completed.

## Post-device readiness check

Given a completed original A9 CI receipt, a filled physical worksheet and `a10-https-probe.json` obtained **from the same HTTPS host**, run:

```sh
node analysis3/a10-device-assessment.cjs \
  analysis9-test-output/rc9-candidate.json \
  analysis10-test-output/a10-physical-worksheet.json \
  analysis10-test-output/a10-https-probe.json
```

The result remains `awaiting-physical` until **all 18 test cases** pass, and `awaiting-owner` until approval matches the source and index hash. Even full documentary qualification reports `canMerge: false` / `canDeployProduction: false`: a **separate, explicit owner-authorized release** is required.

## Status and handoff to A11

- **Automatable:** verify original A9 provenance; stage immutable static assets; synthetic Chrome responsive, SW and offline tests; fail-closed URL/project checker; prepare manual preview and signoff workflow.
- **External prerequisites:** protected GitHub environment and a dedicated Vercel preview project, explicit publication authorization, physical Android Chrome/Samsung/PWA tests, preview-update fixture and owner approval.
- **Production:** unchanged, no A10 merge or deploy.

**A11 — Physical Acceptance Closure & Production Promotion Readiness** should verify these outstanding items, reconcile evidence and prepare an approved, reversible release. It must not claim physical-device or production success without evidence.
