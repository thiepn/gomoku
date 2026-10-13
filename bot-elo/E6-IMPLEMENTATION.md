# Gomoku Bot Elo E6 — Match Integrity, Recovery & Fairness

**IMPLEMENTATION FIRST · SOURCE COMMITTED · NOT_TESTED**  
Stacked directly on E5 draft PR #94 (exact parent \`cf33e186214851989fd3dcca9936f444626b6ea3\`). E1–E4 PR #90–#93 stay unmerged and unchanged. Main/production, human PvP, THIEPN Account and original Studio AI remain separate and untouched.

## Real implementation

**Atomic verified player commands.** Instead of the E2 single \`last_command_id\` check followed by an independent REST \`PATCH\`, \`gomoku_bot_e6_commit_action\` locks the original owner-private \`gomoku_bot_matches\` row and checks the complete command envelope, expected revision, immutable transcript prefix, original E2 policy, player turn, expected player/bot appended moves, final status and any already-applied command receipt **inside one PostgreSQL transaction**. The command journal contains only immutable receipt identities, SHA-256 request fingerprints and applied revisions. It is not a second game store and cannot create Elo. The E2 game record remains the single authoritative transcript.

**Idempotency across subsequent turns and concurrent tabs.** \`(match_id, command_id)\` is unique. Once a command has committed, any later retry with identical fingerprint returns the current server-owned match plus the original applied revision; a different payload with that ID is rejected. A stale revision returns an explicit conflict and authoritative current game, never creates another bot decision or overwrites moves. Server-side prior-receipt lookup avoids unnecessary time-budgeted bot search for confirmed repeats. If concurrent requests race, the database row lock/receipt check makes their ordering authoritative.

**Replay and custody seal.** E6 adds a canonical SHA-256 transcript digest covering owner, match identity, bot configuration/policy, ruleset, original server seed, player color and append-only moves. Newly created matches are sealed; each human+bot turn group is resealed. Owner-visible reads verify the stored digest then replay legal moves using the **existing** native and online Renju kernels. Older E2 matches that have no digest are explicitly labeled \`legacy-unsealed\` and are still fully legally replayed; they are not falsely presented as cryptographically sealed. Terminal results are compared by reason/winner, not JSON object property order. This checks custody integrity, **not** independently reproducible time-budgeted AI choices.

**Practice expiry without fabricated Elo.** The SQL source defines 30-day server-idle expiry for *unrated* active games; preserved history closes with a distinct \`idle-expiry\` reason rather than a fabricated draw. Owners may explicitly leave an unrated practice match; the server retains moves with \`user-abandoned\`. A previously **rated-admitted** active match cannot use the practice abandonment/expiry escape; it remains resumable or must end by a trusted result/resignation. E4 settlement accepts only completed/resigned, never abandoned, and its calibration activation remains OFF. There is no silent network-outage defeat and no invented Elo forfeiture.

**THIEPN Account ownership.** New routes still require \`verifiedAccount\` and derive the owner UUID from the original authenticated session. The existing \`GomokuCompetitionBridge.account()\` now also returns its known \`session.user.id\` solely for **client-side session isolation**; no new login, access token, owner setter, secret or profile store exists. On account changes, the UI clears the previous private match and rating snapshots. The server rejects other owners' IDs regardless of client-side state.

**Browser move continuity.** \`bot-elo/command-continuity-e6.js\` preserves only **one unacknowledged human command envelope** (account UUID, original match ID, action, index, command ID, revision) in \`sessionStorage\`. It NEVER persists an authoritative board/result/rating or automatically resubmits an uncertain action. On network loss, the original E2 board is locked for moves. The user can query the owner-only server receipt and either accept the already-applied result, discard a stale command upon observing an authoritative advanced revision, or explicitly retry the same command ID if the server confirms it is unknown. Pending commands remain recoverable even when a missing response was the *terminal move*; resume looks up the original game ID first. Commands can never cross to another account.

**Settlement recovery is transparent.** An authenticated read-only \`GET /api/bot-rating/recovery\` lists only actual completed/resigned, rated-admitted owner games with \`rating_settled_at IS NULL\`. The original \`POST /api/bot-rating/recover\` is the only retry mechanism and calls the existing idempotent E4 PostgreSQL settlement RPC. The UI exposes a retry control only when that verified pending set is nonempty. Recovery never writes client-provided rating values or activates an unapproved E3 release.

**UI.** The same E2/E5 match interface provides clear command-uncertainty/confirmed/conflict messages, keyboard-accessible check/retry buttons, practice-leave controls, account-transition behavior, and honest expired/abandoned labels and owner-private match history. Original mobile board scroll and roving keyboard focus remain unchanged. No second board/game engine or fake Bot Elo history.

## New source contracts

- \`POST /api/bot-matches/:id/action\`: server validates a single human action and calls \`gomoku_bot_e6_commit_action\`. Returns authoritative \`match\`, \`status\` (\`applied\`, \`already-applied\`; \`conflict\` or \`command-mismatch\` with HTTP 409), and E4 settlement status only for a true completed/resigned outcome.
- \`GET /api/bot-matches/:id/commands/:commandId\`: owner-only command receipt and current authoritative match. Supports \`applied\` / \`unknown\`.
- \`POST /api/bot-matches/:id/abandon\`: explicitly closes only unrated practice. Rated-admitted game requests receive \`rated-resignation-required\` without mutation.
- \`GET /api/bot-rating/recovery\`: owner-only pending E4 settlement summary, with no mutation.
- Existing \`GET /api/bot-matches/active\`, history, individual match and creation endpoints now apply owner-specific idle expiry where needed and provide verified/sealed replay details.
- E6 SQL RPCs: \`gomoku_bot_e6_commit_action\`, \`gomoku_bot_e6_expire_idle\`, \`gomoku_bot_e6_abandon_practice\`.

## Schema and privacy

\`supabase/migrations/20261013_gomoku_bot_elo_e6_integrity_recovery.sql\` is an **unapplied** migration requiring the earlier E2 and E4 migrations. It extends the existing \`gomoku_bot_matches\` custody table with optional transcript digest and abandonment timestamp. Only the immutable \`gomoku_bot_match_commands\` *receipt* table is new. Its client grants are revoked, RLS enabled and service-role-only reads/inserts enforced. Existing \`gomoku_bot_rating_profiles\`, \`gomoku_bot_rating_events\`, E4 release control, human PvP tables and global Account objects are not changed.

No idempotency receipt ever mutates a user's Elo. Rating settlement remains in E4's database authority, guarded by its original UNIQUE(match_id) event ID and the still-disabled calibrated-release control. E3 produced a tournament framework but no measured bot strength; E6 neither claims nor activates measured Elo.

## Limitations and release dependencies

1. This branch's migration is NOT applied and no E6 backend is deployed. The UI may show unavailable APIs until later explicit rollout approval. Existing production remains unchanged.
2. Search decisions use original time-budgeted native AI. SHA-256 custody checks prove a stable stored transcript against accidental changes, **not** that every bot move is bit-for-bit reproducible across hardware or independently proven fair.
3. Explicit abandonment is allowed only for practice; a rated-admitted game stays resumable until trusted terminal/resignation. A future tournament policy for rated prolonged inactivity requires a separate fair-play decision and implementation; E6 deliberately does not silently forfeit anyone due to outages.
4. A session-scoped pending command is a transport continuity hint, **not** offline queued game progression. Missing storage APIs degrade to current-session memory, not invented persistence. The browser will never automatically replay uncertain commands.
5. Command receipt history is immutable and append-only. A future retention/privacy program must consider its account-owned records alongside the original E2 match history, subject to owner deletion/account lifecycle policies.
6. Authentication, owner IDs, source rights and original native AI stay with their original E2–E5 authorities. E6 does not use credentials, paid services or additional engines.
7. Source code has NOT been compiled or exercised. Transactional and UI correctness cannot be certified until separately authorized focused testing and migration/deployment work.

**NOT_TESTED — no tests, builds, CI, audits, migrations applied, deployments, merges, credentials, paid services or production changes.**

## Next phase

**E7 — Progression, Achievements & Intelligent Training:** source-owned opponent recommendations based only on actual reviewed bot strengths or verified practice history; legitimate personal milestones, meaningful match review handoffs and trend explanations. No fabricated skill/mastery, Elo bonuses, duplicate learning state or external AI service. Keep the rated gate OFF until independently approved E3 calibration and later release authorization.
