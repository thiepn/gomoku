# A2 — Search quality, MultiPV and comparison guarantees

Status: stacked development above `phase/a1-threat-verification`. Do **not** merge directly into frozen 1.0 `main`.

## Implemented

- An explicit 1–8 line request at the Analysis workspace level. The native engine may return fewer lines; `search.requestedLines` and `search.returned` distinguish request from evidence actually supplied.
- Root analysis includes the recorded move and known defensive candidate moves even if they would otherwise be pruned from an ordinary positional shortlist.
- The current WASM/JavaScript hybrid engine remains authoritative. Deep/Maximum budgets *may* run a second focused search after first-pass discovery, but only when at least 600 ms of unused requested budget remains. This is not a new alpha-beta/PVS implementation; the engine controls its own move search and evaluation.
- Completed focused passes supersede earlier passes only when they match or exceed completed depth, and never if they discard a previously verified tactical win.
- Individual pass telemetry exposes budget, reported depth, root lines, search nodes, hash hits and backend. Aggregates count all attempted search passes; raw engine TT hit statistics do not prove transposition tables were reused across passes.
- Comparability is conservative: a numerical score comparison requires finite exact-bound evaluations returned by the same selected root search at the same completed depth, without timeout. All other candidate scores are labeled incomplete, not fictitiously precise. These remain engine estimates, not calibrated percentages or mathematical proofs.
- Proof and rule rank precedes incomplete positional bounds. A huge optimistic score from a lower-bound candidate cannot overrule a completed exact estimate, a known defended attack, or an independently verified opponent win.
- The review interface preserves the engine's tactical ranking instead of sorting a second time by raw numerical scores. It can show up to eight lines and always appends the recorded move when present, even beyond the selected line count.
- Cached search results include the MultiPV setting. A2 reviews invalidate old graded analysis evidence but preserve legacy game histories, branch navigation, local mistake records, and their recall events. The cache generation changes for PWA clients.

## Evidence discipline

A higher depth, larger node count, or more PV lines does not itself prove a stronger move or an improvement in engine Elo. The original selective engine still determines search quality. A2 adds root coverage, optional deeper refinement, and stricter evidence judgments. A3 redesigns the board-first analysis experience.

## Regression commands

Run from repository root after rebuilding the portable HTML:

```sh
python review/build.py
python ui/build.py
python analysis/build.py
node analysis3/test-evidence.cjs
node analysis3/test-a1.cjs
node analysis3/test-a2.cjs
node analysis/test-core.cjs
node analysis/test-forcing-defense.cjs
node analysis/test-proof-coverage.cjs
python analysis/test-integrity.py
```

Never call CI green until the actual Actions checks finish. The older `analysis/benchmark.cjs` is a time-budget measurement harness, not an Elo test. Browser/PWA accessibility and physical Android qualification remain additional gates.
