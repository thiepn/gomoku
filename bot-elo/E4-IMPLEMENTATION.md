# Gomoku Bot Elo E4 — Persistent Account Rating Authority (source only)

**IMPLEMENTATION_FIRST / NOT_TESTED.** All source-only changes are stacked after E1, E2 and E3. E4 does NOT activate, measure or award Bot Elo.

## What E4 adds

- A separate server-owned **Bot Elo** profile, append-only event ledger and a versioned calibration release registry. These are not the existing \`gomoku_ratings\`, \`gomoku_rating_events\`, human-ranked matchmaking, or account identity systems.
- An explicitly disabled \`gomoku_bot_rating_controls\` singleton (\`enabled=false\`, \`active_release_id=null\`). E4 seeds **no calibration release** because E3 contains no executed, independently reviewed measurements. Therefore all newly created E2 matches remain **unrated**.
- \`gomoku_bot_e4_prepare_admission\` PostgreSQL RPC: freezes authenticated owner, rules, native E2 policy, calibration release digest, starting rating, bot rating, K-factor and eligibility **before** a trusted game begins. Unavailable calibration or farming restrictions produce an unrated marker, never silently infer eligibility after a win.
- \`gomoku_bot_e4_settle\` PostgreSQL RPC: locks the owner-private completed match and rating profile, checks the pre-match admission and still-active reviewed policy, applies standard logistic Elo with 0.001-point internal precision, preserves a hard minimum of 400 and the anti-farming ceiling, appends a unique match event, updates peak/current rating and result totals, and marks the game settled in **one transaction**. Repeated calls return the original event; denied/missing/inconsistent admissions never reward points.
- Match creation and completion in the E2 handler now request their own server-only frozen admission and call the E4 settlement authority. The client **cannot** supply owner IDs, winners, bot moves, scores, release IDs or rating adjustments. Failed settlement **does not discard** a valid game; the server reports a pending recovery status.
- \`GET /api/bot-rating/me\` and \`GET /api/bot-rating/history\` use the already established \`verifiedAccount\` and service-only data access, scoped to the authenticated user ID. \`POST /api/bot-rating/recover\` retries only owner-verified completed matches with a frozen rated admission, using the same idempotent database RPC. There is no client-authoritative or second rating engine.
- The existing trusted-bot interface gains an owner-authorized profile view, placement/peak/results and real ledger history. Unknown ratings display **Not rated**—never the E1 hypothetical 1200. It uses the original \`GomokuCompetitionBridge\` and THIEPN Account connection. Account state is not duplicated in browser storage.
- \`bot-elo/e4-release-contract.mjs\`: accepts an actual independently reviewed E3 artifact and produces a **disabled, source-pinned release proposal** for a later separately authorized release review. It does not activate Elo or access any remote service.

## Files

| File | Role |
|---|---|
| \`supabase/migrations/20261013_gomoku_bot_elo_e4_rating_authority.sql\` | Separate profiles, immutable ledger, release controls, admission/settlement RPCs |
| \`supabase/functions/gomoku-room/bot-rating.ts\` | Verified account-scoped reads, admission, settlement and recovery |
| \`supabase/functions/gomoku-room/bot-matches.ts\` | Trusted E2 match lifecycle now freezes E4 admission and invokes guarded settlement |
| \`supabase/functions/gomoku-room/index.ts\` | New \`/api/bot-rating\` router without touching human PvP routes |
| \`bot-elo/account-rating.js\` | Actual player-facing signed-in Elo and history panel |
| \`bot-elo/trusted-play.js\` | Refresh original E2 match UI's account rating view |
| \`bot-elo/e4-release-contract.mjs\` | Disabled E3-to-E4 release proposal conversion |
| \`bot-elo/embed-e4.py\` | Reproducible HTML embed helper |
| \`index.html\` | Standalone app with E4 panel |
| \`bot-elo/E4-IMPLEMENTATION.md\` | This contract and technical limitations |

## Rating mathematics and placement

All stored points are \`bigint\` millipoints (\`1200000 = 1200.000\`), so concurrent browser rounding cannot corrupt an authoritative state. Existing E1 scoring conventions are preserved:

- First 10 games are **placement**, 10–19 remain provisional; K=40 for rated games 0–19.
- Games 20–99 use K=24. After 100 rated games K=16.
- Expected score: \`1/(1+10^((Bot_milli - Player_milli)/400000))\`. No unmeasured color advantage is invented.
- If a bot is at least 400 Elo below the player, or the maximum winning update would cross the bot's +400 Elo ceiling, the **whole match** is practice-only. The server fixes the decision before play. No asymmetric win clipping.
- Draw score 0.5, win 1, loss 0; K-scaled change is rounded to the nearest millipoint, with floor at 400. Rating deltas are never affected by streaks, hints, local practice or achievements.

## Release dependencies / guarantees

1. E2's **unapplied** bot-match custody migration must precede the E4 SQL migration if/when an authorized future deployment occurs. Neither has been applied here. E4 intentionally does not create a replacement bot-match table.
2. E3 has **no empirical results**. The E1 targets are still uncalibrated; the E3 random-seeded tournament and color correction are a simulation framework, not measured Elo. E4 activation remains **off**. Do not seed fake reviewed releases.
3. Calibrated bot versions must use the exact E2 search policy (\`studio-native-search/e2.1\`) and reviewed source/manifest hashes. E4 never treats provisional E3 candidates as active release permission.
4. The SQL transaction is the *only* writer of rated results. \`UNIQUE(match_id)\`, owner/room checks and profile locks make retry idempotent, even across tab/session interruptions.
5. Connection, account permissions and source rights remain with the **original THIEPN Account** / existing Gomoku server. The E4 API does not accept a user ID from the browser.
6. The release-control row is deliberately disabled. A later authorized release process must explicitly stage a real reviewed manifest and separately activate it. An E3 reviewed assignment alone never awards points.
7. Search is time-budgeted (not cross-machine bit-for-bit deterministic); E2 transcripts are legally replayable but native search results can differ across hardware. Production fair-play, retention, calibration validation and proper interruption controls remain release dependencies.

## Authorization and troubleshooting

Future deployments must apply explicitly approved migrations before their corresponding edge-function source. If E4 SQL is missing, the backend returns an error (no false rating); the original unauthenticated/local game continues unchanged. If an E4 transaction fails after a valid E2 game, the match is preserved and the idempotent recovery API can retry. A GET of the profile does **not** initialize or fabricate a profile when no trusted rated game exists.

All new Bot Elo data tables are private with RLS enabled and no client grants. The only database-writing paths are existing validated service-role operations, the admission RPC and the settlement transaction. The event table has an immutable update/delete trigger. No extra account system, human PvP writer, server game engine or achievement/review score store is introduced.

## Explicitly not executed

**NOT_TESTED**: No browser/backend tests, CI, build, audit, database migration application, certification, deployment, merge, production changes, external services or paid operations were run in E4. All implementation is source-only on a stacked development branch.
