# Guided Review 1.0.0

A single learning workspace replaces the overlapping post-game summary, full-review and continuation dialogs. Finish a game, choose **Review game**, then navigate the key moments. **Before move**, **Played move** and **Show best found** compare the decision. Select an alternative to explore it, request a reply or enter your own line. **Return to game** never edits the recording. **Try again** hides the answer and evaluates the attempted move afresh; equally good alternatives are accepted.

## What changed

The old post-game summary showed a few decisions without their board context. Its “Open full review” path landed on the completed board, where analysis was disabled. Its coordinate formatter included I even though the board skips I. Multiple overlapping controls led to different review experiences. These were reproduced with a synthetic ten-move game before implementation.

The new interface reviews both players progressively, keeps the current move, board, explanation and alternatives together, and provides explicit navigation between recorded play, retry and experimental variations. Mobile screens show the verdict beside the board; selecting an alternative brings the board into view. Every recorded decision has a status, including queued or unscored decisions. The game-balance chart has gaps for unavailable scores and is not a win-probability chart.

Tactical feedback identifies legal wins, immediate counter-wins, blocks, two-endpoint winning threats and positions that were already lost. When a searched response gives a concrete threat, the explanation names that response and its winning endpoints. A later move in an already-unavoidable loss is not treated as a new blunder. Search-based assessments explicitly remain provisional.

Analysis runs in a cancellable worker using the existing hybrid engine. The first pass uses a 350 ms budget per decision; retries use 1,000 ms and Analyze deeper uses 2,400 ms. Candidate comparisons use the same root perspective and only comparable completed scores. Unknown moves are not assigned fictional ratings, Elo, accuracy or winning percentages. A terminal line cannot be extended. Async results are rejected after navigation, cancellation or variation undo.

Completed judgments are cached locally for up to eight exact game fingerprints, within a 2.5 MB cap. Experimental variations are session-local and included in Export review. Export contains the original game, judgments and variations; it is an archival review format, not a new game-import format. Existing game, SGF and study-tree storage formats are unchanged.

## Integration and safety

The portable `index.html` still contains all runtime JavaScript and CSS. `review/review.js` and `review/review.css` are the maintainable sources; run `python review/build.py` to embed them. The guarded build refuses unknown anchors instead of replacing unrelated code. The existing live game, AI strength, course content, saved library, and study schema are preserved. Existing advanced analysis tools remain available separately.

The build also fixes a runtime blocker found during integration: a course fallback selected the Learn navigation button instead of the course host. The label observer removed the newly inserted card, causing an endless remount loop. The fallback now targets `#v92ImproveHome`. Two course refreshers now avoid writing unchanged text into their own observed subtree. No lesson data is changed.

The service-worker cache name is bumped to `gomoku-v12.1.0-review-1.0.0` so the updated portable file can replace the previous cached build.

## Verification

```
python review/build.py
node --check review/review.js
node review/test-core.cjs
python review/test-browser.py
python review/test-recovery.py
```

Browser tests require Python Playwright and Chromium. Set `CHROMIUM_PATH` to a browser executable as needed. `REVIEW_URL` optionally runs the browser suite against a served origin instead of `set_content`.

The local run passed 18 deterministic core tests, 31 full-application Chromium integration checks, and 9 recovery checks. Coverage includes variant-specific legality, same-root score comparisons, insufficient evidence, passes, immutable history, both-color review, retry, variations, stale async rejection, navigation, keyboard handling, responsive widths 360/390/768, export-payload contents, cancellation and worker/cache failure recovery.

Local browser navigation was restricted by the execution environment. The complete HTML was therefore executed with Playwright `set_content`; no course scripts were removed from the final test suite. Recovery tests explicitly use an in-memory storage shim. Export payloads were inspected as Blobs rather than claiming a native download. Native storage, service-worker and deployed-origin checks are separate from those local results. These tests are not a claim of perfect engine play, full accessibility certification, or real-device testing.

## Audit flow and resulting health

1. Post-game entry — replaced three competing actions with one guided entry.
2. Finding a mistake — key-moment navigation and a complete classified move list; insufficient evidence remains visible.
3. Understanding the decision — board-local move marker, legal tactical explanation, takeaway and evidence basis.
4. Comparing alternatives — ranked candidates, safe variations, engine replies, and one-click return.
5. Retrying — answer hidden until an independent search evaluates the attempt.
6. Leaving/reopening — original history preserved, cancellable jobs and exact-game cached judgments.

The remaining limitation is analysis strength: this uses the existing selective Gomoku engine, not a new calibrated world-class solver. Analyze deeper can change a provisional verdict. This release makes the evidence understandable and usable; it does not pretend uncertain evaluations are proofs.
