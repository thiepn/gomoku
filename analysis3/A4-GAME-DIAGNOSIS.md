# A4 — Full-game diagnosis and evidence-aware turning points

Status: **A4 source implementation; acceptance pending GitHub CI**. Stacked on A3, A2, A1 and R4; the pinned 1.0 `main` release remains untouched.

## User experience

A4 adds a whole-game review section on the Overview tab, powered by the existing per-move analysis:
- Analyzed position coverage, verified tactical **issues** (not all victories), provisional search-estimated mistakes, and unknown/pending decisions. The default focus is the human player in AI games; both-player and per-color filters are available.
- Evidence filters: key decisions, every move, verified events, estimated mistakes, unresolved positions.
- A chronologically ordered event list with plain-language reasoning, certainty, move position, and **Review / Compare** actions. Compare opens the existing A3 study board without modifying the recorded game.
- A move-level Played vs Best found comparison showing *rule-legal continuations from the exact same board and side to play*. Both lines may be partial. Missing candidate depth/bound evidence suppresses any numeric difference.
- A game timeline showing score traces **only** when the A2 search reports valid same-root comparisons; gaps are preserved. Separate verified/unknown dots do not represent scores or win probabilities.
- Expanded JSON export includes the evidence-qualified diagnosis alongside the pre-existing game, result and variations schema. Scans remain pausable/resumable; incomplete positions stay in the report.

## Evidence and language rules

The implementation explicitly distinguishes:
- A **legal immediate win** from a longer heuristic attack.
- A **missed immediate win** from a move that is proved to lose.
- An **opponent's immediate legal finish** after a move from a proved **avoidable** mistake.
- A **verified opponent forcing win after the played move** from proof that any alternative survives.
- A **pre-existing lost position** from new culpability.
- A **known blocked threat** from complete safety.
- A **verified winning alternative** from proof that the played move is lost.
- **Provisional mistakes** with exact finite same-root, same-depth completed search scores from guessed/blurry labels.
- **Unknown** from a draw, a safe defense or a zero error count.

Cached tactical certificates are checked against exact board, rule, attacker, pre/post move state, **then independently verified again through the existing analysis proof verifier**. A missing, mismatched, timed-out or invalid certificate is never promoted to a verified game-level claim. A WeakMap avoids re-verifying the same certificate on every screen repaint.

A4 has no calibrated probability, fabricated engine strength/Elo gain, arbitrary accuracy score, or 'this move lost the entire game' conclusion inferred from unverified heuristic scores.

## Modules and preservation

- `analysis3/game-diagnosis.js`: pure classifier, legal candidate comparison, chronological event summary, filtered views.
- `analysis3/game-diagnosis.css`: scoped overview/decision presentation.
- `review/review.js`: UI navigation, filters, proof-gated event presentation, export.
- `review/build.py`: deterministic offline embedding before the review script, both JS and CSS.
- Browser local caches: UI generation `3.0.0-a4`; engine evidence stays `3.0.0-a2`. Previous A3/A2 review navigation and mistake history remain readable; newer results are only reused when the exact position, side and generation match.

## Verification

Manual source-level JavaScript tests performed: **22 A4 diagnosis tests + 11 A3 workspace-model tests passed**. The scripts parse and the new build insertions were statically inspected.

Required full gate before merge:
```sh
python review/build.py
python ui/build.py
python analysis/build.py
python review/ux/test-integrity.py
python analysis/test-integrity.py
node analysis3/test-evidence.cjs
node analysis3/test-a1.cjs
node analysis3/test-a2.cjs
node analysis3/test-a3.cjs
node analysis3/test-a4.cjs
python analysis3/test-a3-browser.py
python analysis3/test-a4-browser.py
python review/ux/test-workspace.py
```
The dedicated A4 GitHub Action additionally exercises all legacy native tactical and browser review regressions, source parity, deterministic rebuild and guarded generated artifacts. It must pass before marking this complete. Synthetic Chromium checks do not equal physical Android hardware qualification.

**Next:** A5 — turn verified and provisional game lessons into a safe, spaced-practice learning system without damaging existing learning events.
