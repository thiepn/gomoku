# P22 — Client Resilience, Offline Integrity & PWA Failure Recovery

P22 hardens the static Gomoku client after P21 completed backend capacity certification. The phase is deliberately client-focused: it fixes the service-worker failure modes that can corrupt or strand an installed/offline game without inventing another backend governance layer.

## Confirmed pre-P22 defects

The main-branch worker still used the older generic navigation strategy:

1. **navigation cache poisoning** — any same-origin navigation handled by the worker could refresh `index.html`, so visiting documentation under the worker scope could replace the cached game shell;
2. **HTTP 5xx handling** — network exceptions fell back to cache, but a real HTTP 503/500 response was returned instead of the known-good cached game;
3. **uncontained cache writes** — quota or CacheStorage failures could reject asynchronous cache work even when the network response itself was valid;
4. **over-broad same-origin caching** — arbitrary same-origin GETs could be intercepted and cached despite not being part of the Gomoku shell.

These problems were originally reproduced in stale **PR #4**. P22 does not merge that branch: it is more than 200 commits behind current main and also contains Guided Review / legacy Renju work that current Review 2.x has already superseded.

## P22 service-worker contract

The worker now derives its application scope from its own URL and recognizes exactly two shell navigation paths: the scope root and canonical `index.html`.

- Documentation and sibling navigation is never handled as the game shell.
- Only the eight declared PWA shell assets are eligible for non-navigation caching.
- Room APIs, Hub routes and arbitrary generated files bypass the worker.
- Successful shell navigation refreshes one canonical cache key: `index.html`.
- Network exceptions **and HTTP 5xx responses** may fall back to the cached shell.
- Cache writes are best-effort; quota failure cannot turn a valid network response into an application failure.
- If CacheStorage is unavailable, online shell navigation still works.
- Activation removes only older `gomoku-*` caches and preserves unrelated application caches.

The cache generation is **gomoku-v12.5.0-p22-client-resilience-analysis-2.1.0-review-ux-2.1.0**. All client generators—including `online/build-p8-client.py`, which is used by P13's post-merge publisher—are pinned to that generation so a rebuild cannot silently revert the worker to the P17 cache name.

### Generated-shell regression found during deployment

The first P22 merge exposed one additional release-path defect: after the merge, P13's `publish-generated` job ran `online/build-p8-client.py`. That generator still hardcoded the P17 cache name and created follow-up commit `f250153c...`, causing the first P22 Pages run to be superseded and deploying an old cache generation despite the corrected worker logic. P22 now treats every generator that can rewrite `sw.js` as part of the client contract.

## Regression evidence

`audit/p22-service-worker.cjs` executes the worker in a deterministic VM harness and covers:

- exact precache contents;
- documentation isolation;
- offline shell fallback;
- HTTP 5xx fallback;
- canonical shell refresh;
- API/sibling-app bypass;
- query-string asset recovery;
- quota failure;
- unavailable CacheStorage;
- cache cleanup isolation.

`audit/p22-offline-browser.py` then uses a fresh real-origin Chromium profile:

1. install and activate the worker;
2. prove the page is controlled by the expected scope and P22 cache;
3. navigate to `ui/` and prove it is not the game shell;
4. disable the network;
5. return to Gomoku and reload offline;
6. restore networking and prove normal navigation resumes.

No game saves, accounts or production multiplayer rooms are created.

## CI and deployment

The required PR job is `p22-client-resilience`.

On `main`, `p22-deployed-offline` additionally waits until GitHub Pages serves the **exact** committed `index.html` and `sw.js` hashes, then repeats the real-browser offline sequence against `https://thiepn.dev/gomoku/`.

This is intentionally separate from **P16**. P16 is the Supabase/backend admission and production-certification plane. P22 protects the static GitHub Pages/PWA artifact at its own release boundary instead of writing a meaningless client-only check into the database admission ledger.

## PR #4 disposition

P22 ports only the still-relevant PWA/service-worker repair and its executable regression evidence. PR #4 remains unmerged until its separate backup/course-storage/cross-tab/AI-preservation claims are reconciled against current main. Blindly merging the stale branch would overwrite substantial P8–P21 work.

## Non-goals

P22 does not claim physical iOS/Android certification, perfect browser storage durability under device-level eviction, or multiplayer packet-loss recovery. Those require separate targeted work rather than being inferred from an offline shell test.


## Single cache-version authority

Deployment verification exposed a broader reproducibility problem: UI, Review, Analysis, P13 and several historical contract tests each carried their own copy of the cache-generation string. P22 removes that duplication.

`client-cache-version.txt` is now the single authoritative cache generation. Every builder that may rewrite `sw.js` reads that file, while P13/P15/P16/P17 tests verify the generated worker against the same source. P22 alone pins the expected current generation. Future phases therefore advance one version file rather than synchronizing unrelated historical literals.
