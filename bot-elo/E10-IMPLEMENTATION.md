# Gomoku Bot Elo E10 — Advanced Tactical Exploration & Personalized Training

**Status:** implementation-first source phase; **NOT_TESTED**, not merged or deployed.

**Exact parent E9:** \`456b5bc4326edefa305a37287ba98fb6e7115acb\`,
\`feat/gomoku-bot-elo-e9-progressive-decision-journeys\`, draft PR #99.
All previous E1–E9 stacked drafts and production remain preserved.

## Concrete learner-facing functionality

1. **Native-rule counterfactual sandbox.** A visually and semantically distinct \`What-if sandbox\` renders a disposable copy of the exact authenticated E8 source position. Learners select and explicitly submit decisions for **both Black and White** (no fabricated opponent AI), to a limit of six plies. Undo / restart, pass where the original rules permit, full 15×15 board controls, touch targeting and keyboard arrow/Home/End navigation are provided. Moves are checked exclusively by the existing Studio \`createEngine('renju-practice')\` / \`legalMove\`; after a confirmed terminal five, two passes, board fill or six local plies, the line cannot advance. This local presentation never reaches the genuine E2 game, source transcript or E4 rating ledger.
2. **Legitimate native position inspection.** Before placing an exploratory move, learners inspect its exact legality and immediate-win status; Black double-three, double-four, overline, occupied and forced center opening are identified using native results. Exact immediate legal five counts for both colors are computed by filtering the native \`winningMoves\` through the same \`legalMove\`. A single chosen move may show **how many** exact immediate legal fives the opposing color would have afterward; no unrequested bot move or multi-ply adversarial strategy is generated. Original four/three shapes are named as heuristic information only.
3. **Separate authentic-source comparison.** A factual comparison view shows the next up-to-six real server-recorded human/bot plies alongside the learner's current what-if choices, explicitly noting that observed bot moves are responses to the **actual** human game choices and cannot validate a counterfactual variation.
4. **Independent historical reconstruction.** A different mode progressively reveals up to four recorded source moves. At each step, the learner tries to remember the actual coordinate or pass, then compares the answer with original E2/E6 record without an automated proficiency judgment. Advancement uses the **authentic next source position**, never the learner's mistaken or guessed branch; a "Reveal actual move" route is separately identified from a comparison attempt.
5. **Explicit personalized practice priorities.** The learner can focus on original human decisions, native-detected immediate-fives, single-square direct defenses, opening center discipline, Renju legality or historical reconstruction. This filters genuine verified human checkpoints, not fabricated tactics. One click opens the **existing original E9 journey/E8 replay** through a narrow checked \`focusVerifiedDecision\` handoff; there is no new record authority. A temporary per-session observation map prioritizes previously uninspected or factually mismatched recall/objective checks without awarding achievements.
6. **Session continuity without a competing store.** The E10 view retains up to twelve **ephemeral in-memory** per-source-ply sandbox/reconstruction snapshots while moving around one source match. Changing match or THIEPN Account purges all details. Refreshing the page loses this volatile state. No localStorage, IndexedDB, server account write, additional achievement/mastery profile or rating update.
7. **Integrated standalone source.** \`bot-elo/embed-e10.py\` composes original E6→E9 embedding then inserts E10 after E9 into the original large \`index.html\`. All original game, workspace and rating scripts stay in place.

## Exact source files

- \`bot-elo/exploration-e10.js\`: real authenticated position explorer, native source-fact inspection, original-record recall, learner-prioritized queue and volatile session continuity.
- \`bot-elo/journeys-e9.js\`: narrow original human-turn \`focusVerifiedDecision\` handoff, reusing the original guarded E8 replay and existing E9 journey.
- \`bot-elo/embed-e10.py\`: canonical E10 standalone embed.
- \`index.html\`: embeds updated E9 plus new E10 module on the original standalone app.
- \`bot-elo/E10-IMPLEMENTATION.md\`: source and authorization boundaries.

## Limitations and release status

- E10 can establish **exact legality and one-move immediate wins** from the original Renju kernel. Heuristic shape counts are not a ranking, proof of a multi-ply forced win or general move-quality assessment. All multi-ply sandbox choices are explicitly human-directed local branches; no simulated opponent responses are represented as authentic.
- The original E2/E6 owner-verified match history still limits source availability to the existing latest-record window. Historical reconstruction only compares against those original records. Session priorities are not persistent achievements, measured proficiency or career totals.
- Original E4 PostgreSQL rating ledger remains the only Bot Elo authority. E3 calibration/release gating remains unresolved; rated Bot Elo is OFF. No extra evaluation service, account integration, credentials, deployments or third-party spend.
- **NOT_TESTED.** This phase intentionally performed no tests, browser/mobile runs, builds, CI, independent qualification, database migrations, merges or deployments. Source commits are implementation, not runtime or production-readiness certification.
- Prior draft PRs, main, hosted production and human PvP behavior remain untouched.

**Suggested E11:** additional original source-backed independent tactical reconstruction, accessible review flow refinement and source-based review navigation. Focused runtime qualification should be separately authorized before production release.
