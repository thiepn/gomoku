# P27 — Gomoku 1.0 Stable Release & Maintenance Handoff

P27 is the final release phase. It prepares and, only after P26 is genuinely complete, creates the immutable Gomoku 1.0.0 release.

## Release boundary

The user-facing product candidate remains the P25-qualified artifact:

d7481e80a5956584ad5956e897f28e3bb04674d2

P26/P27 add only release-control, evidence, and documentation files. They do not alter the frozen gameplay/UI/PWA artifact.

The stable Git tag is v1.0.0. The tag is created at the current main release-control commit, while the P27 release contract records the exact frozen product candidate separately.

## Hard prerequisites

P27 may create no stable tag and no GitHub Release until all of the following are true:

1. P26's 24-hour burn-in is complete.
2. Every required P26 physical profile is explicitly pass:
   - physical Android Chrome;
   - physical Samsung Internet;
   - installed Android PWA.
3. No P26 device profile reports fail.
4. The live public index.html, sw.js and manifest.webmanifest still exactly match the pinned product candidate.
5. The repository is on the current main head at release time.
6. The v1.0.0 tag and GitHub Release do not already exist.
7. The release workspace is clean.

Automated browser emulation never substitutes for the required physical evidence.

## Explicit dispatch only

P27 is intentionally not automatic.

After P26 is complete, the stable release workflow must be manually dispatched from main with the exact confirmation:

release-v1.0.0

The release job receives contents: write only for that explicit dispatch. Pull-request and normal push validation remain read-only.

Immediately before tagging, the workflow fetches origin/main and verifies that the checked-out commit is still the current main head. If main moved, the release fails rather than tagging stale code.

## Stable release actions

A successful P27 release dispatch performs this sequence:

1. validate P27 contracts;
2. run the strict P26 release-ready gate;
3. verify the exact deployed P26 product candidate;
4. run P27 preflight;
5. confirm the workflow commit still equals origin/main;
6. confirm neither v1.0.0 tag nor GitHub Release already exists;
7. create annotated tag v1.0.0;
8. push the tag;
9. create the GitHub Release with operations/P27-RELEASE-NOTES.md.

No database migration, Edge deployment, frontend rebuild, or product mutation occurs during P27 release creation.

## Maintenance mode

Once v1.0.0 exists, Gomoku leaves active feature-development mode.

Allowed work after 1.0:

- reproduced correctness defects;
- security fixes;
- compatibility regressions;
- accessibility regressions;
- persistence/recovery defects;
- dependency updates with a concrete maintenance reason;
- small quality-of-life changes that clearly justify reopening product development.

Do not continue creating numbered governance phases merely to keep development active.

Versioning after 1.0:

- patch release: backwards-compatible defect/security/quality repair;
- minor release: meaningful backwards-compatible product capability;
- major release: intentionally breaking product or data-contract change.

Every product change after 1.0 must rerun the checks affected by that change. Client/PWA changes should rerun P24/P25; online/runtime changes must continue through the existing P16–P23 controls.

## Current state

P27 can be merged before P26 completes because it contains only guarded release machinery. However, its release job must remain blocked until the strict P26 gate passes.

At the time P27 was prepared, P26 physical-device evidence was still pending and the 24-hour burn-in had not elapsed. Therefore preparation of P27 is not itself a claim that Gomoku 1.0 has shipped.

## Completion

P27 is complete only after:

- the strict P26 release-ready command passes;
- the production candidate verification passes;
- the v1.0.0 tag exists at the intended current-main release commit;
- the GitHub Release for Gomoku 1.0.0 exists;
- Gomoku is formally treated as maintenance-mode software.

Until then, P27 status is prepared/blocked, not released.
