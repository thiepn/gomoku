# P26 — Release Candidate Burn-In & Real-Device Qualification

P26 is the final defect-finding phase before Gomoku 1.0. It does **not** add product features, redesign the UI, or create another release-control system.

The release candidate is the exact P25-qualified product artifact from commit:

d7481e80a5956584ad5956e897f28e3bb04674d2

P26 control files may be added after that commit, but index.html, sw.js, manifest.webmanifest, game logic, learning content, analysis, review, online runtime, and other product files remain frozen.

## 1. Defect-only rule

During P26:

- reproduced release-blocking defects may be fixed;
- speculative refactors are prohibited;
- new features are prohibited;
- visual redesign is prohibited;
- dependency churn is deferred unless it fixes an actual release blocker;
- any product-code change invalidates the pinned candidate and requires a new candidate plus the affected P24/P25/release checks.

The P26 validation script enforces this by diffing the pinned candidate against the current commit. Only P26 control/evidence files are allowed to differ.

## 2. 24-hour burn-in

For this small personal application, P26 uses a **24-hour minimum burn-in**, not a multi-week enterprise soak.

The burn-in starts from the P25 production merge/deployment epoch recorded in operations/p26-release-candidate.json.

Existing production controls remain authoritative:

- P16 continuously certifies the production backend every six hours.
- P20 continues collecting minute-level production SLO evidence.
- P21 already certifies the controlled capacity floor and worker-restart recovery.
- P23 already owns security and abuse-resistance qualification.
- P24/P25 already own automated browser/PWA and product-quality qualification.

P26 adds a scheduled six-hour candidate-identity check. It verifies that the public Pages artifacts still byte-match the pinned candidate. It does not duplicate P16–P25.

A 24-hour clock alone never makes the release ready. Required physical-device evidence must also pass.

## 3. Physical device boundary

P24 used Chromium, Firefox and WebKit engines plus mobile emulation. Those are strong compatibility proxies, but **physical device success cannot be inferred from emulation**.

Required before P27:

1. physical Android Chrome;
2. physical Samsung Internet;
3. an installed Android PWA.

Recommended when hardware is available:

4. physical iOS Safari;
5. installed iOS PWA.

The canonical state is operations/p26-device-matrix.json.

A profile can be:

- pending_manual — not physically tested yet;
- pass — manually tested with concrete device/browser evidence;
- fail — a reproduced defect exists;
- blocked — the required hardware/test path is unavailable.

Automated CI must never turn pending_manual into pass.

## 4. Manual device protocol

For each physical browser, verify the checks listed in the matrix. At minimum this covers:

- launch from the public production origin;
- Play / Improve / Library navigation;
- actual touch placement and confirmation;
- no viewport overflow that prevents play;
- background to resume state preservation;
- offline reload or launch where the platform supports it;
- reconnect without losing the local game;
- settings and dialog reachability.

For the installed Android PWA also verify:

- install;
- standalone launch;
- process backgrounding and relaunch;
- offline launch;
- recovery after reconnect;
- update of the production shell without corrupting saved state.

When a profile passes, record at least:

- test timestamp;
- physical device;
- OS version;
- browser name;
- browser version;
- concise notes.

Screenshots or screen recordings may be stored under operations/p26-device-evidence/ when useful, but the structured matrix remains the release decision source.

## 5. Release blockers

A reproduced defect blocks P27 when it can cause any of the following:

- incorrect Gomoku or Renju legality/result;
- lost or corrupted saved game;
- online state divergence;
- inability to make or confirm a move;
- broken primary navigation;
- unrecoverable PWA/offline state;
- crash or uncaught error in a primary flow;
- serious accessibility regression;
- production artifact drift;
- critical P16/P20/P23 production state.

Purely cosmetic defects may be recorded for maintenance if they do not compromise play, learning, accessibility, persistence, or recovery.

## 6. Candidate invalidation

If a release-blocking product defect is repaired:

1. fix only the reproduced defect;
2. create a new immutable candidate SHA;
3. rerun all checks affected by the changed files;
4. rerun P24/P25 when client behavior changed;
5. reset the P26 candidate identity and burn-in start;
6. repeat the affected physical-device checks.

This prevents a tested candidate from silently becoming a different build.

## 7. Commands

Validate that the repository still represents the pinned candidate:

node operations/p26-release-candidate.mjs validate

Verify the exact public Pages artifacts:

node operations/p26-release-candidate.mjs deployed

Print current burn-in and physical-device readiness:

node operations/p26-release-candidate.mjs status

Strict P27 readiness gate:

node operations/p26-release-candidate.mjs release-ready

The strict gate exits non-zero until the 24-hour minimum has elapsed and all required physical profiles are explicitly marked pass.

## 8. P26 completion

P26 is complete only when:

- the pinned product artifact remains unchanged;
- the public deployment exactly matches it;
- the 24-hour minimum burn-in is complete;
- existing production certification remains healthy;
- no release-blocking defect remains open;
- every required physical profile is explicitly pass.

Only then should **P27 — Gomoku 1.0 Stable Release & Maintenance Handoff** begin.
