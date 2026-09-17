# Analysis 2.0 — Evidence, search and personal practice

Implemented in the existing Gomoku Studio application. Baseline: `3d2f6cc6ef93fabeca3592e30ab26b169391361b`, including the Renju opening repair. This is not a new standalone game or a claim that finite search has reached an absolute ceiling.

## What changed

The original review already had multiple candidate lines and the application already had a native WebAssembly search engine plus VCF/VCT threat search. The audit found that review recreated its worker for every position, discarded proof trees and most search telemetry, provided no persistent personal mistake training, and hid much of the evidence needed to distinguish a search estimate from a verified tactic.

Analysis 2.0 keeps that engine and improves how it is used and explained:

- A persistent worker retains the native engine and transposition tables during a review. Exact-position result caching includes the rules, side to move, pass count, opening policy, played move and search settings. Closing releases the worker; completed results remain cached.
- An initial quick pass reviews every decision. Up to four of the largest uncertain human decisions automatically receive a standard-budget second pass. Further key-moment refinement uses the selected budget. The review stays navigable and interruptible.
- Quick / Standard / Deep / Maximum request 0.35 / 1 / 2.4 / 10 seconds, progressively wider/deeper search, and up to five displayed candidate lines plus the played move. Rule verification and explanation generation add overhead, so these are search budgets rather than hard wall-time promises.
- Per-candidate bounds, completed depth, principal variation and comparable score loss are retained. Position telemetry includes actual backend, nodes, hash hits and search stability. These are engine units, not win probabilities, Elo, or calibrated accuracy percentages.
- A separate after-move threat probe can retain a verified opponent forcing win. This proves a losing after-position; it does **not** by itself prove that the played move caused the loss or that another move would save it.
- The proof viewer checks the certificate independently, shows real board positions, highlights finishing points, steps through forcing moves and lets users inspect alternative defensive branches. A principal variation alone is never presented as a proof covering every defense.
- Preventative defensive explanations use legal counterfactual moves: for example, occupying a point that the opponent could otherwise use to create two winning endpoints. This is concrete board evidence, not a speculative strategic label derived from a score.
- Mistake training stores real human decisions in a private local IndexedDB library. It reanalyzes each saved position and each attempted answer, accepts independently supported alternatives, tracks hinted answers separately, and never advances recall on unresolved evidence.

## Use

Finish a game and open **Review game**. Start with **Next key moment**. Use **Try again** before revealing an alternative, or open **Why the best move wins / Show opponent’s winning threat** when a verified certificate exists. **Return to game** restores the recorded decision.

Choose **Practice mistakes** for this game's eligible positions. **Mistake library** opens all saved positions. The same library is available under **Learn → Your mistakes**. Hints mark an attempt assisted; one position can receive only one scored recall per training session. Due dates are suggestions, never access locks. Export the library to transfer it to another browser/device.

## Correctness and storage

The live game, current Renju rules, AI opponent behavior, course content and original game storage are not replaced. Historical off-center Renju records retain their explicit replay context. Two consecutive passes terminate a variation and are evaluated as a draw, not as if a further opponent reply could be played.

Search-based judgments remain provisional. A certificate establishes only its verified forcing strategy and its upper bound on plies, not a shortest mate. An unsuccessful bounded proof search means **unknown**, not that no forced win exists. The selected attack search is not a complete solver for every Gomoku position.

Training excludes illegal, already-lost and unscored decisions. Imported references are historical and are reanalyzed before scoring. If a fresh search no longer confirms a saved mistake, practice becomes unscored exploration. Initial recall intervals are a transparent heuristic (1, 3, 7, 14, 30, 60 days); they are not a validated optimal learning model.

Limits are explicit: 32 in-memory analysis results, up to eight review-cache entries subject to a 2.5 MB localStorage cap, 150 personal mistake positions, 14 MB library imports, and 160 KB per retained proof tree. Oversized proof trees are not truncated into invalid proofs. Reviews that do not fit the browser cache remain available for export. IndexedDB failure falls back to tab-only storage with a warning. Imports validate the whole batch before writing; recall updates use transactions and deduplicated event IDs. Export remains important: local browser storage is not a cloud backup.

No third-party engine, neural weights, external AI API, paid service or new network dependency was added. This release does not claim parity with a specialist championship engine or a universally optimal review system.

## Verification

Run from the repository root:

```sh
python review/build.py
python ui/build.py
python analysis/build.py
python ui/test-integrity.py
node review/test-core.cjs
node analysis/test-core.cjs
node analysis/test-proof-coverage.cjs
node analysis/benchmark.cjs
python review/test-browser.py
python review/test-recovery.py
python ui/test-ui.py
python analysis/test-browser.py
```

Set `CHROMIUM_PATH=playwright` for Playwright-managed Chromium. Set `ANALYSIS_URL`, `REVIEW_URL`, and `UI_URL` to test a hosted origin. Without an origin, the local analysis browser harness explicitly emulates localStorage and reports that native IndexedDB persistence was **not** tested. CI uses a real HTTP origin, tests fresh-document persistence and concurrent tab writes, and repeats the analysis flow against the exact deployed build.

Proof tests include a genuine branching VCT strategy, missing/duplicated defense rejection, alternative branch selection, all eight board symmetries, color symmetry under unrestricted rules, and unknown-search handling. The benchmark records wall time, completed depth and search statistics for four budgets on one synthetic position. It is a measurement harness, not a playing-strength rating.

Screenshots and reports use synthetic fixtures only. Browser testing is Chromium-based; physical devices, other browser engines, screen readers, every possible rule position and every course exercise are not exhaustively certified.

## Research references

- L. V. Allis, H. J. van den Herik and M. P. H. Huntjens, *Go-Moku Solved by New Search Techniques*, Computational Intelligence 12(1), 1996. Threat-space/proof-number techniques motivate the separation of selective estimates from checkable forcing strategies.
- Renju International Federation, *International Rules of Renju*, https://www.renju.net/rifrules/ — legal threats, forbidden moves, exact-five precedence and passes.
- Rapfi primary repository, https://github.com/dhbloo/rapfi — an existing specialist engine architecture considered during research. Rapfi code and networks were not incorporated into this release.

Source of truth for pass counts and the deployed revision is the CI artifact and commit, not a manually edited certification label.
