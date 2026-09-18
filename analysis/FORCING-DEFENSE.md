# Analysis 2.1 — forcing-defense verification

## Reported regression

`fixtures/renju-move40.json` reconstructs the user screenshot before White E14, move 40. Black has 20 stones; White has 19. The previous quick review preferred J6 and described E14 as positional. A separately verified Black continuous-four attack after J6 is B11, A11, E14, F15, A10 (the last two may be interchanged). B11 creates a legal four–three.

The placements A11, B11, A10, E14 and F15 interrupt this particular attack. The new full-board test establishes that each other legal placement, and a first pass, permits the verified combination. These five are local defensive candidates, not a claim that all five draw or win against every alternative attack.

## Engine behavior

1. Search for a verified opponent continuous-four threat before the ordinary positional search spends its budget. An opponent-to-move proof here is hypothetical and is not evidence that the current side has already lost.
2. Replay a found proof against actual after-positions with the independent rule verifier. Include the entire board and pass when time permits. Remote counter-wins, legal winning endpoints and forbidden Black moves matter; a coordinate dependency shortcut is insufficient.
3. Inject unrefuted defensive endpoints into the native root candidate set, including distant squares that positional candidate pruning can omit.
4. Refine the displayed recommendation, recorded move and leading alternatives with additional actual-position opponent searches. Reuse newly verified proofs against previously considered candidates.
5. Rank rule wins and verified winning plans first. A positional score cannot override a verified forced loss. Refuted candidates have `bound: verified-loss`, no comparable heuristic score and a legal proof continuation.
6. Explain what the evidence establishes. `Losing move` proves the after-position loses but does not assert the loss was avoidable. `Defensive move` interrupts a checked forcing attack but is not a proof of safety. Only complete coverage of all legal choices can establish an already-lost decision through this screen.

## Uncertainty and scope

The defensive pass searches continuous fours (VCF), not every possible quiet continuous-three sequence (VCT). The existing native search and own-side tactical solver remain available; the native WASM, rules engine and other baseline modules are unchanged. Failure to find a proof, reaching the time/depth limit, or failing to replay an old proof leaves the result unresolved. It never becomes a safety certificate.

This release strengthens a demonstrated tactical failure class. No Elo estimate, universal best-play claim or promise that all four–three attacks are detected at every budget is made. Tests cover the supplied position, all eight board symmetries, adversarial candidate pruning, JavaScript fallback, counter-wins, forbidden moves, pass termination and proof tampering.

## Review and data migration

Analysis/runtime/review evidence generation is 2.1.0. Position IDs deliberately retain their existing namespace so learning history remains associated with the same position. Historical 2.0 review envelopes retain variations and navigation but their scores are invalidated. Historical mistake cards keep events and recall statistics; current-generation evidence replaces stale evidence even when the stale search used a larger budget. The service-worker cache generation is updated. Saved games are not cleared or rewritten.

The best-move card distinguishes a defensive candidate from a verified winning plan. Opponent proof buttons open the actual losing variation, not the recorded game position. Compact precomputed proof lines are used in routine UI rendering rather than walking the verifier again on the main thread.

## Verification

Run:

```sh
python review/build.py
python ui/build.py
python analysis/build.py
python review/ux/test-integrity.py
python ui/test-integrity.py
python analysis/test-integrity.py
node review/test-core.cjs
node analysis/test-core.cjs
node analysis/test-proof-coverage.cjs
node analysis/test-forcing-defense.cjs
```

Serve the repository on a real HTTP origin for native storage and Worker tests. Set `CHROMIUM_PATH=playwright`, `ANALYSIS_URL`, `REVIEW_URL`, `UI_URL`, and `WORKSPACE_URL` to that origin, then run the existing review/browser/recovery/UI/workspace tests and `analysis/test-forcing-defense-browser.py`.

The browser regression tests actual Worker messages, J6 proof exploration, E14 explanations, mobile overflow/exit, stale high-budget review invalidation, preserved variations and recall events, native IndexedDB migration, main-thread responsiveness and cancellation. Its explicit `set_content` fallback is useful locally but does not certify native persistence or a physical phone.

The existing 40-module analysis integrity manifest stays unchanged. Only the intentionally changed guided-review embedding and approved review severity core hashes are updated in their separate UI integrity manifests. Build reproduction must leave `index.html` and `sw.js` byte-identical.
