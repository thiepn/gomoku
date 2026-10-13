# Gomoku Bot Elo E7 — Verified Progression, Milestones & Intelligent Practice

**State:** source implementation in a separate E6-child draft PR; **NOT_TESTED**; not merged, migrated, or deployed.

**Exact E6 parent:** \`68718349e9e631ce922286bac6a1e7eaf6fe3702\`, draft PR #95, branch \`feat/gomoku-bot-elo-e6-integrity-recovery\`. E5 #94, E4 #93, E3 #92, E2 #91, E1 #90 remain preserved and unmerged.

## What E7 adds

- **Actual verified practice statistics:** completed/won/drawn/lost counts are derived at render time only from the newest 30 records returned by the existing authenticated E2 history endpoint. A record must identify the original known bot, have an original-server-verified owner/integrity flag, an original result and a valid match ID. Active or abandoned practice is never counted as a draw, game win or Elo result. Deduplication is by authoritative match ID; no browser-written match or simulated games are accepted.
- **Seven evidence-derived practice milestones:** first completed game, five completed games, two stone colors, three native opponents, first verified win, wins against two different opponents and ten completed games. These are presented as *observed within loaded history*, not permanent achievements, certification or points. No persistent awards or secondary profile tables.
- **Authentic native-opponent ladder:** the original eight bot IDs and ascending native difficulties appear with owner-verified win/draw/loss observations. The player may select any level through the *existing* E2 selector; no new AI moves or client game-state writer.
- **Concrete practice session guidance:** a recorded loss or draw suggests replaying that opponent; two consecutive verified wins against the same level suggest the next native difficulty; otherwise E7 suggests consolidation. Colors and recent results drive qualitative focus prompts. Recommendations never estimate player skill, opponent Elo or mastery from practice.
- **Actual board review queue:** independently selectable losses, draws, wins or all recent completed records. Per-match prompts avoid pretending to know the tactical cause or grade a move. *View verified board* calls E2's existing authenticated match loader, not a new replay engine. Older or unavailable history is explicitly disclosed.
- **Ledger-only trajectory:** totals, first/last observed ratings and changes are derived solely from the existing E4 owner-scoped immutable rating events (up to the latest 50 returned); never from rating targets or inferred results. E5 retains the original SVG graph. If events are not loaded, E7 shows an unavailable state.
- **Account transition and source continuity:** E5 exposes a narrow owner-checked read-only snapshot to the E7 display and emits a local read-model notification. A response fetched before a THIEPN Account switch cannot later become the current owner's history. E7 retains no account ledger or progress in storage; opening a different account clears its private view and local display preferences.

## Exact source touchpoints

- \`bot-elo/training-e7.js\`: all E7 derivations, milestones, goal prompts, opponent ladder, review queue and accessible mobile interface.
- \`bot-elo/experience-e5.js\`: owner-scoped, success-verified history read model for E7; reject stale account-switch responses; signal refresh.
- \`bot-elo/embed-e7.py\`: reproducible E6/E2/E4/E5 canonical embed refresh plus the E7 script, preserving the existing standalone application.
- \`index.html\`: embedded original E5 with owner-safety fix and standalone E7 script.
- \`bot-elo/E7-IMPLEMENTATION.md\`: this handoff.

## Boundaries, remaining limitations and release gate

- Original E2/E6 match custody and native Renju/AI legality decide the game; original E4 SQL alone settles official rating. E7 is **display and navigation only**. It never infers victories, stores a practice profile, issues rated bonuses, writes mastery, modifies PVP, changes account access or activates calibration.
- E3 measured and independently reviewed calibration is unavailable, so **Bot Elo remains inactive**. E7 contains no release switch.
- The E2 history currently fetches up to 30 most recently started matches; these do **not** prove lifetime records. E4 rating history currently fetches up to 50 genuine events, likewise not necessarily a lifetime trajectory.
- No engine-backed move diagnostics, position-specific causality, certifications, account-wide achievement history or persistent session goals are claimed. The current training guidance is explainable heuristic sequencing based on recent verified outcomes, not an adaptive machine-learned skill model.
- **NOT_TESTED:** no tests, runtime/browser checks, builds, GitHub Actions, migration execution or hosted two-account acceptance was performed for E7. These are real source changes, not a production readiness claim.
- No merges, database writes, deployment, production changes, ratings awarded, credentials, paid services or modifications to existing older draft PRs.

**Possible E8:** progressively replay positions within the existing authenticated E2 board and integrate genuine original analysis handoffs, with only source-grounded problems/feedback and explicit uncertainty. First qualify E6/E7 in a separately authorized environment before any rated activation.
