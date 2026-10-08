# Analysis 3.0 — product and engineering contract

Status: **R4 foundation only**. This is a stacked development branch above `phase/r3-ai-reliability`; **do not merge into the frozen 1.0 `main`**. The current Analysis 2.1 runtime remains unchanged by R4.

## Product goal

Make Gomoku review a credible tactical and learning tool, not a decorative estimate. Every recommendation must explain **what is verified, what is estimated, and what remains unknown**, while staying usable on mobile and preserving fully offline play.

The existing Analysis 2.1 includes a WebAssembly native search backend, independent VCF/VCT proof verification, MultiPV estimates, forcing-four defense screening, and a browser-local mistake bank. Keep these assets. The observed remaining problem is an **incomplete threat and evidence pipeline**, not an absence of an analysis engine.

## Non-negotiable correctness contracts

1. **Rules first.** All candidates, continuations, proof branches and board overlays must obey the selected variant (freestyle, exact-five, Renju practice), player color, move number, center-opening migration, and pass state. Illegal moves never enter ranked recommendations.
2. **Proofs require an independent check.** An engine's `status: proven`, a principal variation, or a high heuristic score alone is not a proof. A certificate is scoped to the exact board/rule/attacker and validated before being shown as a guaranteed outcome.
3. **Loss after a move ≠ avoidable blunder.** A verified opponent strategy after a played move proves the resulting position loses; it does not prove any legal alternative survives. The word *blunder* requires separately justified evidence of a better attainable result.
4. **Defense against one attack ≠ safety.** Interrupting a known verified attack says only that this particular proof no longer applies. Other VCF/VCT attacks, quiet wins, and longer strategic outcomes may remain unknown.
5. **Unknown stays unknown.** Search timeout, node limit, unsearched remote defense, incomplete proof coverage or interrupted analysis never imply a draw, win, or safe defense.
6. **Scores are not probabilities.** Root-relative engine centipawn-like units (if defined), incomplete bounds, confidence bands and exact game-theoretic outcomes require distinct labels. Do not display synthetic "win %" or "accuracy %" without calibration.
7. **Cancelled and stale searches cannot overwrite current analysis.** Worker requests are keyed by exact board, rules, side, context, settings and analysis engine generation; incremental messages need request IDs.
8. **Preserve player history.** Existing saved games, SGF imports, studies, locally saved mistake cards and review exports stay readable. Version search evidence independently; migrate/reanalyze stale assessments rather than deleting recall events.
9. **Offline-first.** No required account, paid LLM API, internet calls or external engine downloads at startup. A future optional larger engine must not break the portable/offline build. Rapfi's GPL-3.0 licensing and redistribution requirements must be evaluated before any source/weight integration.
10. **No fake release status.** Desktop automated checks do not certify mobile hardware, other browsers or playing strength.

## Milestones and implementation order

### A0 — Evidence contracts and evaluation harness (R4)
- Implement a tiny **independent claim gate** that checks exact board, side, rule and proof validity before presenting win/loss claims.
- Create adversarial tests for forged certificates, stale positions, side/rule mismatch, lost-after-move vs avoidable mistake, unknown cases.
- Run the proven Renju move-40 J6 regression with the actual engine and capture complete budget/telemetry report, not Elo.
- Initial R4 cannot change the built `index.html`, service worker, or runtime behavior.

### A1 — Tactical reliability
- Make VCF and VCT distinct verified pipelines with legal all-defense proof trees; handle attack/defense dual search, distant blocks, forbidden moves, passes, immediate counter-wins and symmetric boards.
- Reuse verified certificates only after independent validation against the **complete resulting board**. Bound verification and proof size, never silently truncate certificates.
- Exhaustively check legal replies only where this is feasible and reported as complete; otherwise visibly retain uncertainty.
- Promotion gate: all previous tactical regressions, plus 40+ curated adversarial positions across all variants, must pass without a proven-loss move outranking a verified safe/winning alternative.

### A2 — Search strength and MultiPV
- Iterative-deepening alpha-beta/PVS, transposition-table reuse, smart move ordering, threat extensions, aspiration windows when stable, and separate tactical verification budget.
- Re-search displayed root alternatives to comparable completed depth; show `incomplete` where not comparable. Include the played move even if outside the current top-N.
- Add configurable 1–8 principal variations, analysis depth, nodes, elapsed time, stability and backend. Avoid claiming strength from node count alone.
- Evaluate specialist engine integration **only after** measuring current native WASM vs candidate engine; guard bundle size, browser support and licensing.

### A3 — Analysis workspace redesign
- Dedicated board-first desktop/tablet/mobile Review workspace, not a generic analytics dashboard.
- Hover/tap legal threat overlays; colored best-move arrows; explicit opponent forcing lines; sequence numbers; heatmap only for *measured evaluated candidates* (never invent evaluation of all 225 squares).
- PV board explorer with next/previous, alternative defense branches, pinned compare lines, original-game return and undo-independent experiments.
- Side panel: Candidate lines · Threat inspector · Why? · Engine details, accessible with keyboard and screen reader labels.
- Progressive results must preserve scroll/focus and never freeze the board.

### A4 — Full-game diagnosis
- Game timeline with positions, candidate score differences only when comparable, key moments and uncertainty gaps.
- Categorize verified tactical wins, forced defenses, missed immediate wins, avoidable mistakes, estimates and unscored moves separately.
- 'Why was this bad?' compares **played vs best alternative** in equal-context legal lines and explicitly states evidence limits.
- Whole-game reviews can pause, resume, export and navigate with incomplete positions.

### A5 — Learn from games
- Practice from mistakes with independently rechecked correct alternatives; separate verified and heuristic exercises.
- Theme clustering: forced-block blindness, double threats, forbidden Renju moves, missed win, opening fundamentals, defense timing.
- Due-practice schedule preserves existing stats/event IDs and never advances on inconclusive/hinted answers.

### A6 — Runtime/performance hardening
- Dedicated worker protocol, cooperative cancellation, retained search transpositions where safe, exact-request deduplication, bounded caches, stale result guards.
- Device-aware budgets and measurable interaction responsiveness on entry-level mobile; test memory, cold start, pause/return and offline PWA.
- Deterministic portable embedding; no runtime dependency on optional CDN, account service or paid AI.

### A7 — Strength and product acceptance
- Tactical suite across freestyle/exact-five/Renju, both colors and eight board symmetries; test VCF, VCT, quiet threats, passes and forbidden defenses.
- Run fixed time-control matches with confidence intervals against the prior engine, with colors and openings balanced. Label strength gains only when measured.
- Browser/device/accessibility/visual QA, regression tests, rollback plan and physical Android acceptance before tagging a new release.

## Evidence labels in the interface

| Label | May be shown when | Must never imply |
|---|---|---|
| Verified win | Independent certificate covers required opponent replies from exact position | Shortest forced win or globally optimal opening |
| Verified losing continuation | Independent opponent certificate valid after specific move | Loss was avoidable or original move was sole cause |
| Blocks known threat | A verified root attack fails after chosen defense | No other winning attack exists |
| Search estimate | Completed legal candidate comparison under a named budget | Calibrated winning chance or proof |
| Unknown | Incomplete, omitted, timed out or unsearched | Draw, safety, or proven no win |

## Acceptance and source of truth

Each milestone gets a focused PR stacked on the active v2 branch, deterministic tests and CI. No forced merging into `main`. Preserve `review/build.py → ui/build.py → analysis/build.py` reproducibility. The generated portable file remains authoritative only after rebuilding, checking byte-identical output on repeat builds, and passing the existing analysis/review/PWA tests.

Research reference: [Rapfi](https://github.com/dhbloo/rapfi) uses alpha-beta + classical/NNUE evaluation and the Piskvork engine protocol. Its features are *research comparisons*, not code already integrated here; GPL-3.0 requirements must be respected.
