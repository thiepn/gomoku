# Gomoku 1.3 — AI 2.0

AI 2.0 improves the existing local opponent without replacing the rule engine, Review/Analysis engine, or the v1.1/v1.2 learning stack.

## What changes

- **Search-budget quality:** stronger live levels spend progressively less work on MultiPV alternatives and more on the principal search. Expert/Master receive a modest time/depth/width increase. Weak levels retain enough alternatives for the existing humanized move policy.
- **Broader benchmark harness:** fixed tactical safety cases plus representative review positions report legality, tactical-floor success, depth, nodes, latency and reference-move agreement. Reference agreement is descriptive only; it is not Elo, win probability, or proof of optimal play.
- **Adaptive opponent:** opt-in and transparent. Difficulty is frozen for an entire game. Only completed, unassisted AI games can change it. At least four eligible games at the current strength are required; a weighted result >=72% may raise one level and <=28% may lower one. Each change has a cooldown and the new level must accumulate its own evidence.
- **Telemetry:** the browser retains a bounded local history of 80 AI games and 80 search summaries. No server, account, external model, or network dependency is introduced.
- **Explainability:** the opponent panel states the selected/effective strength and the evidence count; a details dialog explains adaptation and the latest search summary.

## Deliberate boundaries

AI 2.0 does **not** rubber-band during a game. Changing the difficulty explicitly remains authoritative. Arena/engine matches are not adaptively altered. Assisted games do not tune the adaptive opponent.

The specialist analysis stack remains deterministic and separate. AI 2.0 does not claim championship-engine parity, a calibrated Elo, or solved Renju/Gomoku play.

## Verification

```sh
node ai2/test-core.cjs
python ai2/build.py
python ai2/test-integration.py
node ai2/benchmark.cjs
python ai2/test-browser.py
```

The CI benchmark caps per-position time for repeatability. Full playing-strength measurement would require a much larger color-swapped match corpus against fixed engine versions and statistical confidence intervals.

## R3 — Adaptive reliability and session consistency

- Monotonic `totalGames` and per-game `seq` keep adaptation reliable beyond the 80-game local history cap. Legacy AI 2.0 saves migrate without discarding games.
- Only eligible, unassisted results **since the latest adjustment** influence promotion/easing. Results from a previously played level cannot be reused after a level change.
- Fixed and Adaptive opponents both freeze their effective level by active game ID. Difficulty changes and Adaptive toggles apply to the next game, never an in-progress match.
- No new backend, no Elo claims and no modifications to Analysis/Review search. Regression checks: `node ai2/test-r3.cjs`.
