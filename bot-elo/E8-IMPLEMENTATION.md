# Bot Elo E8 — Native Rule-Grounded Replay & Personalized Practice

**Status:** source-only implementation, draft PR stacked directly on E7 #96, **NOT_TESTED**.

**Verified exact parent:** \`a4db477c42eabc9aeb284abf829d0fe2d14251fc\` on \`feat/gomoku-bot-elo-e7-training-progression\`.
Original prior draft stack E1–E7 (#90–#96), main, hosted site, and human-vs-human ratings remain unchanged.

## Shipped source behavior

1. **Position-by-position native replay.** Open a match from E7's existing owner-scoped authenticated 30-record history via "Practice positions", or use the last-review shortcut. E8 uses *only* the existing \`GomokuBotWorkspaceE5.e7SourceSnapshot()\` read model. It refuses another owner's, unverified, abandoned, active or unsupported-rules matches. The full transcript is re-checked against the exact original \`createEngine('renju-practice').replay\` and authoritative recorded completed result / resignation. Actor turns must match the server's recorded player color; an inconsistent transcript blocks practice.
2. **Interactive 15×15 *presentation* board.** First/Previous/Next/Last, ply slider, most-recent original human-decision checkpoints, last-move indicator, keyboard roving focus, Arrow/Home/End navigation, accessible board labels, mobile horizontal scrolling. This board is never playable and cannot send moves or create a second authoritative state. Original E2 remains the real live/history board and loader.
3. **Actual grounded problem types.** The native kernel's own \`legalMove\`, \`winningMoves\` and \`tacticalProfile\` power practice prompts: opening center requirement, any exact legal immediate five, occupying an opponent's one legal immediate winning point (when lawful), and general "predict the recorded continuation" comparison. Native win candidates are filtered through original legality, including Black Renju restrictions. All prompts come from **actual positions** in the authenticated transcript. There are no hallucinated exercise positions or hidden fabricated solution keys.
4. **Guided-to-independent practice.** Independent mode begins without answer markers; Guided mode permits two escalating hints, with supported target coordinates visible only at the second level. The learner selects a coordinate before inspecting its original-engine legality or objective immediate-one-turn fact; on demand, revealing the historical next move is clearly distinguished from an optimal move.
5. **Misconception-specific feedback.** Illegal center opening, occupied points, Black overline, double-three/double-four, legal non-winning moves, direct immediate blocking and correct legal five are explicitly differentiated using genuine kernel classifications. Shape-based native fours/threes and \`tacticalProfile\` are presented as heuristics, **not** deeper proof. No general blunder labels, forced-win claims beyond the checked move, tactical accuracy scores or opponent-rating predictions.
6. **Verified-match-specific training focus.** Recent original *human decision turns* are offered as jump-to-position checkpoints, even if no tactic can be proven there. The task distinguishes original player/bot actions and recorded results, not model-inferred mistakes. E7 keeps genuine practice stats, milestone observations and Elo ledger display; E8 does not alter them.
7. **Owner continuity and ephemeral scope.** A different signed-in account closes the prior replay and clears selected board, hints and feedback; source is rechecked on render. No localStorage, IndexedDB, database writes, secrets, duplicate academic grades, ratings, mastery, achievement awards or background persistence.

## Original authority boundaries

- **Game state and outcome:** E2/E6 owner-verified match read model, plus existing native Studio Renju kernel used for client-side inspection. If the kernel is missing or replay diverges, E8 disables feedback rather than substituting a new evaluator.
- **Ratings:** E4 immutable ledger and SQL settlement remain the only source; E3 independently approved calibration is absent and Bot Elo rated activation is OFF. No ratings or wins were awarded.
- **Source embedding:** \`bot-elo/embed-e8.py\` composes existing E6/E7 source refresh and appends E8 after E7 in the original \`index.html\` single-file app.

## Exact files

- \`bot-elo/review-e8.js\` — interactive replay, exercises, genuine native-rule feedback and review controls
- \`bot-elo/training-e7.js\` — real E7-history "Practice positions" entry points and selected verified match handoff
- \`bot-elo/embed-e8.py\` — source-preserving standalone embed path
- \`index.html\` — E7/E8 canonical sources embedded in the original application
- \`bot-elo/E8-IMPLEMENTATION.md\` — source and authority disclosure

## Restrictions & evidence

**NOT_TESTED.** No tests, builds, browser/device runs, GitHub Actions, migrations, merges, deployments, paid services or credential use performed. The code is source-implemented, not independently verified to run in production. E8's feedback certifies only native exact legality, one-move terminal facts and factual transcript comparisons. The native engine's time-budgeted search is deliberately not represented as a perfect move oracle. No novel tactical corpus, engine-evaluated historical blunder labels, rated-release approval, career totals or formal learner assessment are claimed.

**Potential E9:** separately authorized focused browser acceptance of E8 replay/account isolation and regression on the original native rules, then explicit review of any source-grounded multi-ply analysis features before enabling them.
