# A8 — Practice Data Integrity, Recovery and Final QA Stabilization

**Status:** branch implementation, stacked on A7. Do not deploy, merge to main or claim physical Android certification on the basis of this phase.

## Root-cause analysis of the A7 release blocker

The inherited A5 Chromium test had the incorrect asynchronous predicate:
`GomokuMistakes.list().then(x=>x.length)>0`.

This compares an unresolved **Promise** object with `0`, yielding `false` indefinitely. A8 reproduced the actual flow on real localhost Chromium with persistent IndexedDB:

- `GomokuReview.saveMistakes()` returned **1**.
- `GomokuMistakes.status()` reported **`backend: indexeddb`, `persistent: true`**.
- An immediate `GomokuMistakes.list()` returned the correctly identified move-7 tactical exercise.

The issue was **the test**, not missing saved positions. It was fixed to await the resolved boolean: `GomokuMistakes.list().then(x=>x.length>0)`. On that corrected run, **16/16 A5 browser checks passed**, including desktop/mobile, assisted hints and immutable game history.

## A8 features

- `analysis3/practice-integrity.js`: pure, read-only checking of card schema, duplicate IDs, invalid or repeated recall tokens, contradictory counters, 150-position limit and nonpersistent storage fallback.
- `GomokuMistakes.audit()`: inspects the real local library and reports counts without rewriting or migrating any card, due date, score or event ID.
- `GomokuMistakes.previewImport(data)`: validates incoming schema-v2 backup and reports how many positions are new vs already stored, rejecting duplicate IDs and over-limit merges **before a database write**. The existing transactional import still preserves local recall events for duplicate positions.
- The existing training screen adds a compact **Check saved data** action and **Export backup** shortcut. No separate account/database is introduced; the public UI distinguishes IndexedDB-backed records from tab-only fallback.
- Import feedback names added/preserved counts; it does **not** imply that backups were uploaded to a server or automatically synchronized across devices.
- `analysis/build.py` embeds the new audited module before the training runtime, and the source-integrity suite checks the exact script and rebuild ordering.
- PWA cache version increments to serve the new recovery UI without replacing or deleting the original IndexedDB store.

## Verification

- **18/18 A8 audit/recovery model tests**, run in isolated JS.
- **16/16 previous A5 Chromium tests** after fixing the Promise predicate, confirmed by GitHub Actions.
- `analysis3/test-a8-browser.py`: real Chrome origin, exact move-7 practice save, persisted IndexedDB audit, read-only integrity, backup preview, reimport with preserved board/stats/events, atomic invalid-backup rejection, fresh document reload, and no changes to the original game.
- `.github/workflows/verify-analysis3-a8.yml`: targeted fast feedback, not a release gate.
- `.github/workflows/verify-analysis3-a8-full.yml`: full A0–A8 tactical, offline, accessibility, mobile-emulation, legacy review/training and deterministic build regression pipeline; generated files can be committed **only to this A8 branch** if every check passes.
- Production `main` remains unchanged. A7’s manual Android Chrome, Samsung Internet, and installed PWA qualifications and owner approval are **still required** before any merge/release.

**A8 does not claim new engine Elo, physical-device testing, or successful production deployment.**

## Remaining qualification

1. Require the A8 complete workflow to pass on a stable SHA. Read its screenshots and audit evidence, not only a green badge.
2. Collect genuine Android Chrome, Samsung Internet and installed Android PWA evidence against those exact artifacts.
3. Review the A7 rollback plan, secure owner approval for the candidate SHA and hash, and only then perform a separately authorized release.

**Next:** No additional feature phase is required for this workstream; concentrate on finishing device qualification, production promotion and smoke verification.
