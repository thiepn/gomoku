# A6 — Runtime, mobile budgets and offline/PWA reliability

**Branch:** `phase/a6-runtime-offline-performance`, stacked on A5. **No merge or deployment to frozen 1.0 `main` until A7 acceptance.**

## Core architecture

A6 introduces a separate pure `analysis3/runtime-policy.js` module, embedded **before** the existing `analysis/runtime.js`. The same workers and A2 Gomoku evidence engine remain authoritative.

- **Retained worker** — the native worker stays alive between completed searches and is torn down only on cancellation, timeout, worker error, or `release()`. This avoids recompiling the inline WASM initialization for every reviewed move.
- **Exact flight deduplication** — concurrent requests for the exact same board, side, selected move, rules, pass/move context, backend, MultiPV, requested budget, search generation and policy share one computation. Each subscriber gets a separately cloned result. Aborting one subscriber does not cancel others.
- **Strict cancellation and stale-result guards** — an aborted or superseded job rejects with `AbortError`; the native worker is terminated when necessary because synchronous WASM cannot be cooperatively preempted mid-search. Every worker reply carries an ID and can only settle the matching pending request. An elapsed safety watchdog terminates stuck jobs.
- **Bounded LRU results** — maximum 24 cached search positions, approximately 4 MiB serialized data (UTF-16 conservative), 45-minute TTL, deep clone at return. A result exceeding the budget is not cached. Verify-only calls never cache tactical verdicts.
- **Explicit device policy** — the normal full-budget mode remains unchanged. An opt-in **Adapt to device** setting caps the *requested* search budget at 650 ms on constrained devices and 1600 ms on balanced hardware; unrestricted desktop search retains the selected budget. It never upgrades evidence into a verified proof or falsely reports a completed higher-depth search. A6 displays actual allowed time, cache occupancy, worker restarts and cancellations.
- **Scope isolation** — neither the saved mistake library's IndexedDB name/schema, event IDs, schedule, imported games nor online multiplayer state was changed. `GomokuAnalysisRuntime.version` remains `3.0.0-a2`, corresponding to the unchanged evaluator/proof generation. Worker scheduler has independent `runtimeVersion: '3.0.0-a6'`.

## Offline shell reliability

A6 preserves the existing narrow, `/gomoku/`-scoped service worker and atomic shell installation. Navigation uses an 8-second abortable, no-store network refresh; only successful same-origin **HTML** responses can overwrite the known-good offline game shell. JSON, non-HTML errors, opaque/cross-origin login redirects and sibling websites must not poison the cache. If offline, navigation falls back to the current cached index. The service worker exposes its cache/scope version through a local `GOMOK_OFFLINE_STATUS` message, without opening external APIs or adding telemetry.

`client-cache-version.txt` invalidates the previous portable shell while preserving historical review and trainer data.

## Tests and release gate

New deterministic, isolated checks:
```sh
node analysis3/test-a6.cjs
node analysis3/test-a6-sw.cjs
```
Cover exact request identities, concurrent subscriber coalescing, deep-cloned cache results, context isolation, single/all subscriber abort, worker recreation, guarded stale replies, LRU bytes/count/TTL, verified-only cache isolation, service worker origin/scope isolation, good offline fallback and poisoning resistance.

Browser qualification:
```sh
python analysis3/test-a6-browser.py
```
Uses a real localhost origin in Chromium. Measures actual worker lifecycle and cache hits, performs abort-and-retry, checks mobile viewport and reloads the installed service-worker shell while the Chromium network is disabled. The report records evidence without inventing speedups. A6 CI also reruns A0–A5 tests, native tactical checks, source parity, idempotent `review → ui → analysis` builds, postgame review and training acceptance.

## Known limitations

Browser background throttling, worker memory reclamation and mobile performance can differ across devices. The A6 Chromium checks **do not qualify a physical Samsung/Android phone**, measure engine Elo, or prove unlimited offline storage. Cancellations in the underlying synchronous search are hard worker terminations, not cooperative WASM checkpoints. Offline installation still depends on a successful initial download of the portable shell. All newly displayed numeric search estimates retain the existing A2 caveats.

**Next: A7 — independent strength, physical-device, accessibility, release and rollback qualification.**
