# Bot Elo E5 — Account-first Bot Challenge Workspace (source only)

**Status:** IMPLEMENTED IN SOURCE / NOT_TESTED / NOT DEPLOYED.  
**Stack:** E1 draft PR #90 → E2 draft PR #91 → E3 draft PR #92 → E4 draft PR #93 → E5 draft PR (stacked child of E4).  
**Activation:** E3 has not run any calibration games. E4 has no independently reviewed active release. Bot Elo remains disabled. Nothing in E5 turns it on.

## Substantial learner-facing changes

1. **Original Studio entry points** — E5 inserts an obvious Bot Challenge button into existing New Game, opponent and competitive-computer setup areas. Existing E1 example scoring remains available in a clearly labeled collapsed *simulation* section, not as an apparent real account score. No new home page, duplicate game renderer or separate game engine.
2. **Unified opponent workspace** — The original E2 trusted-game dialog now includes a server-connected status banner, a verified account rating, peak, placement stage, career win/draw/loss record, staged progress and opponent recommendation. A disconnected user can invoke the existing Online Rooms / THIEPN Account connection; guests can continue original offline practice.
3. **Honest difficulty** — the eight original native AI IDs stay unchanged. The new E5 selector displays “strength not measured” unless a reviewed calibrated release is **actively reported by the server**. The static E1 sample Elo values never appear as real opponent strength.
4. **Server-owned reward previews** — added read-only \`GET /api/bot-rating/opponents\` to the existing authenticated \`gomoku-room\` rating handler. It derives results from the original E4 profile, explicit release controls, approved calibration manifest, E1 canonical expected-score math and pending-settlement check; never from a client-provided rating. The account UI shows proposed win/draw/loss movement **only** when the active release is valid. All previews are explicitly non-binding; E4 freezes actual admission before play and PostgreSQL alone settles real changes.
5. **Real match-result screen** — the finished E2 match emits its authoritative outcome. A genuine E4 ledger event matched by \`matchId\` is the *only* permissible source of an Elo change (before/after/delta). An unrated result says “practice only”; a server-admitted but unsettled match says “pending”; a failed call shows a recovery warning. No simulated gain ever enters an account summary.
6. **Actual history and rating chart** — the workspace reads \`GET /api/bot-matches/history\` via the original THIEPN Account bridge, lists owner-private results, and allows loading a selected match using the original E2 board. The compact SVG trajectory uses only real sorted E4 ledger events and hides entirely until they exist. No fabricated sample data, progress or mastery.
7. **Evidence-aware recommendations** — while calibrated ratings are unavailable, suggestions only follow the player’s *actual verified practice match* result (win → next native level, otherwise repeat) or offer Beginner as an explicitly non-skill-assessing starting point. Once a real reviewed release is active, suggestions can use the server-derived eligible bot targets near the account rating; the UI never derives official strength from E1 sample numbers.
8. **More useful native board controls** — E2 keeps its original authoritative board presentation but adds Pass (where the rules allow), keyboard roving focus over every board cell including occupied ones, retained board focus between redraws, and mobile horizontal board access with larger touch targets. Occupied cells are \`aria-disabled\` and cannot send moves. No local game grading or undo is introduced.
9. **Account privacy** — the E4 read-only snapshot is scoped to the currently connected account and invalidated when the account changes. E5 holds only transient server responses for display; no new IndexedDB/localStorage ratings, no alternate account store, no unauthenticated ledger access.
10. **Reproducible standalone embedding** — \`bot-elo/embed-e5.py\` refreshes E2, E4 and E5 embedded sources together, preserving the original \`index.html\` single-file architecture.

## Files changed

- \`supabase/functions/gomoku-room/bot-rating.ts\` — authenticated, read-only, owner-scoped and nonbinding bot-opponent previews
- \`bot-elo/experience-e5.js\` — complete account-first Bot Challenge workspace
- \`bot-elo/trusted-play.js\` — original E2 board accessibility, signals, view-match/history integration, match-admission labels
- \`bot-elo/account-rating.js\` — owner-sensitive read-only snapshots/events for UI consolidation
- \`bot-elo/embed-e5.py\` — source-to-inline reproducible integration
- \`index.html\` — real UI embedded in existing standalone app
- \`bot-elo/E5-IMPLEMENTATION.md\` — this document

## Authoritative data flow

**Selection:** E1 bot ID → existing Studio native selector → E5 calls authenticated \`/api/bot-rating/opponents\` for honest availability → user may begin verified practice via unchanged E2 API.

**Admission:** E2 backend calls E4 SQL pre-match \`gomoku_bot_e4_prepare_admission\`. At today's inactive state, this gives \`rated:false\`; the client cannot override it.

**Game:** E2 native server policy and authoritative rules verify moves/result. E5 renders returned board and never submits a winner.

**Completion:** E4 transactional settlement is the only possible writer. E5 shows Elo deltas only after a corresponding owner-authorized immutable \`gomoku_bot_rating_events\` record is fetched. Retries and failures do not invent Elo.

**History:** E2 \`/api/bot-matches/history\` for verified matches, E4 \`/api/bot-rating/history\` for real rating events and \`/api/bot-rating/me\` for profile and placement. The two histories are distinct and their ownership is unchanged.

## Active limitations

- **No calibrated Elo exists yet.** E3 produced calibration machinery, not observed results; no review-approved release, migrations or backend deployment have been authorized. E5 never claims live Elo progress.
- Expected-win calculations are **nonbinding** and **do not include a measured color correction**; the final E4 database admission can differ, and the UI discloses this.
- Native bot search is time-budgeted and can vary between hardware; E5 makes no deterministic-search or solved-strength claim.
- The new owner-opponent endpoint, E2 match custody and E4 ledger are source-only; with no deployed backend, the UI clearly says the data is unavailable rather than displaying fake account results.
- Extended interruption handling, concurrency/fair-play recovery, retention policy and operational release validation belong to E6–E8.
- No production migration, deployment, merge, external communication, paid service or Elo activation is part of E5.

**NOT_TESTED:** No tests, browser runs, builds, CI, audits, migrations executed or production actions were performed.
