# Bot Elo E9 — Progressive Native Decision Journeys

**Status:** substantial learner-facing source implementation, **NOT_TESTED**.
**Exact E8 parent:** \`94583e48b87bb91af2d6aa5be50ebe0db58a3055\`, \`feat/gomoku-bot-elo-e8-interactive-native-review\`, stacked draft PR #98.
Original E1–E8 draft stack, main, live Gomoku and all human PvP systems remain unchanged.

## Working source changes

1. **Linked genuine decisions.** E9 opens inside E8's original owner-verified replay and selects up to three real human-turn checkpoints from the authenticated E2/E6 match transcript. The First/Previous/Next/Last board, single authoritative transcript and match ownership remain the E8/E5 read model. At every step E9 moves E8 to the exact original ply using a guarded *presentation-only* \`seekVerifiedPly\` API; E8 displays the position and supplies the selected square. No duplicate board or independent game continuation exists.
2. **Independent → guided learning.** The default independent task asks for a selected move and optional written reasoning. Guided mode permits two staged hints. Answers and reflections live only in current JavaScript view memory; no browser/database persistence, new mastery/achievement/profile writer or official grade.
3. **Four meaningful source-based tasks.** Center-first Black opening, a legal immediate five, a lawful direct block of an opponent's unique immediate-five point, and independent source-record comparison when no exact tactical conclusion can be established. Every claimed target is computed from the existing *original Studio Renju kernel* \`createEngine('renju-practice')\` and its \`legalMove\`/\`winningMoves\`; for Black, geometric winning points are filtered by exact legality. There is no invented tactic, solution key, best-move grading or engine-optimality claim.
4. **Authentic multi-ply evidence.** The next step follows the actual historical human choice and genuinely recorded bot move(s); the source clearly distinguishes an observed reply from any hypothetical response to the learner's alternative. Reveal provides the recorded move, original native classification (legal five and native four/three shape counts), and—only when applicable—the number of immediate legal human wins after the actual bot's next turn. Shape scores remain heuristic, not proved move quality.
5. **Targeted corrections.** Distinct responses for occupied cells, non-center Black opening, forbidden overline, double-three/double-four, legal but nonwinning choices, direct-block omission, an objective-satisfying immediate five and record-only alternatives. One-move exact facts are distinguished from unsupported multi-ply tactical proof.
6. **Temporary adaptive sequencing.** The current browser view keeps only \`Map\` observations about chosen *source ply* and whether an exact one-move objective was missed, checked or not yet inspected. Session-level unresolved objectives and as-yet-uninspected decision points are prioritized over previously examined source positions. These are transient interaction details, never a persisted mastery or achievement score. Sign-out/account switch and switching original matches immediately clear them.
7. **Source-only single HTML delivery.** \`bot-elo/embed-e9.py\` composes the inherited E6 → E7 → E8 embed helpers, inserts the canonical E9 script after E8, and preserves existing standalone \`index.html\` code and native kernel.

## Exact files

- \`bot-elo/journeys-e9.js\` — learner-facing multi-step journeys, native one-move checks, meaningful feedback and short-lived queue
- \`bot-elo/review-e8.js\` — owner-verified \`seekVerifiedPly\`, read-only board-selected square and position-change notification
- \`bot-elo/embed-e9.py\` — deterministic source embed extension of E8
- \`index.html\` — refreshed original E8 and new E9 canonical inline sources
- \`bot-elo/E9-IMPLEMENTATION.md\` — this handoff

## Hard limitations

- E9 never writes to match custody, E4 rating SQL, owner-private game history, practice milestones, PvP or original Account. E3 bot calibration remains unmeasured/unapproved; rated Bot Elo stays OFF.
- Native tactical checks cover only exact move legality and single-move wins/blocks. Following subsequent original records **does not** establish a forced line under adversarial play, the quality of a hypothetical move, or that the historical human decision was optimal.
- Existing history API is limited to recent 30 owner-visible matches. No fabricated full-career assessment. If a source/replay/kernel/owner check fails, E9 disables itself rather than creating a fallback evaluator.
- No server-based learning persistence, leaderboard, grading, badges or rewards introduced. Volatile session observations are not called measured performance.
- **NOT_TESTED:** no tests, builds, CI, database migrations, browser acceptance, independent review, merges, deployments, paid services or credentials. Code is source-implemented but not qualified as operational or production-ready.

Possible E10: native-source original-review organization, explicit learner-created practice priorities and constrained position exploration using existing legitimate kernel, while maintaining one match/rating/store authority. Formal verification should be separately authorized before release.
