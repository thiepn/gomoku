# Full-app regression audit — September 17, 2026

Baseline: `3d2f6cc6ef93fabeca3592e30ab26b169391361b` (the center-first Renju hotfix).
This is a functional/data-integrity repair of the existing app, not another redesign.

## Confirmed failures and repairs

| Area | Reproduction on the original build | Repair |
|---|---|---|
| Legacy Renju | An old off-center game passes the save validator but throws `Illegal move 1: opening-center` during full import, tree creation or Guided Review. | Carry the compatibility marker through saved studies, tree validation, SGF, shared study codes and legacy batch review. New games still enforce H8. |
| Chapter backups | Complete a real chapter task and export the full game/training backup: all 14 chapter storage keys are omitted. | Back up chapter progress and resume locations; validate before writes; replace the complete course snapshot; refresh in-memory reports immediately; preserve chapters when importing older backups that lack course data. |
| Course storage recovery | Chapter 2 throws on quota failure; chapter 6 with `tasks:null` fails when opened. | Whitelisted storage adapter retains unsaved progress in memory, preserves damaged original records, displays a recovery/export notice and accepts course-only recovery imports. |
| Cross-tab autosave | A no-op local snapshot can skip the requested Keep write. A malformed remote study can clear the conflict before failing. Storage failure can be followed by a misleading success toast. | Force an explicit Keep write; retain the conflict on failure; validate the complete incoming study before resolving a conflict. |
| Interrupted AI | Start a new game with preservation enabled while the AI owes a move; make the Library write fail. The old game remains but its AI turn is canceled and not restarted. | Resume the valid original engine turn after the failed replacement operation. |
| Passes in review | Replay `Pass, Pass` in a test line: it can keep playing. Prior-pass positions use the same analysis key, and the second pass can receive an unrelated move judgment. | Track consecutive passes and total move count; stop at a draw; assess the draw explicitly; retain Pass as a valid suggested continuation; invalidate older review caches. |
| Offline/cache regressions | Navigate to a same-origin documentation page: the old service worker can store that document as `index.html`. HTTP 503 returns an error page despite a cached app; quota errors produce unhandled rejections. | Limit shell caching to game navigation and assets; preserve the app across docs visits; serve the cached game on server errors; contain cache-write errors; keep online navigation working when CacheStorage is unavailable. |
| HTML parsing | Four escaped `\n` text fragments appear outside scripts/styles, including immediately inside `<head>`. The first fragment prematurely opens the body, moving metadata out of the head. | Convert only those four markup artifacts to real whitespace; preserve all script and lesson content. |

Additional hardening rejects malformed rule-kernel pass arguments, restores review state when opening fails, and constructs review prefixes using one validated replay instead of repeatedly replaying the same game from the start.

## Validation

Existing regression suites remain in place: 22 rule/review-core checks, 80 interface assertions, 31 Guided Review interactions and 9 recovery checks. The audit adds 32 core checks (including the actual embedded WebAssembly engine), 10 service-worker behavior checks and cross-feature browser assertions.

The new tests were also executed against the original HTML/service worker. They reproduced 9 core-check failures, 6 service-worker-check failures and 7 cross-feature browser-group failures before the fixes. These are failing checks, not a count of distinct bugs; related checks share root causes.

Coverage includes all three variants; Black/White asymmetry; rotated double-three/double-four patterns; a blocked pseudo-three; exact-five/overline precedence; pass termination; malformed moves/imports; branching SGF; old studies; share codes; compiled-engine wins/blocks/legal candidates; fallback search; clocks; round-robin scheduling; opening-protocol transitions; storage conflicts/quota; real chapter completion and backup restoration; corrupt course records; interruption/replacement of AI games; ordinary controls; and specialist-tool entry/return paths.

`approved-module-changes.json` lists intentional module-hash changes with their reasons. The original compiled engine, board geometry and lesson content were not replaced. `course-content-baseline.json` additionally proves that all 14 lesson module bodies are unchanged after removing only their explicit storage delegation and restoration listeners.

Permanent CI runs the audit browser suite on Chromium, Firefox and WebKit against a real localhost origin. Chromium also runs the original UI/review/recovery suites. After merge, the deployment job compares the live HTML/service-worker hashes with the tested commit, then runs cross-feature browser checks against the public app. Chromium verifies that visiting documentation and returning offline still loads the game.

Workflow status and uploaded JSON/screenshot artifacts—not this document's existence—are the evidence of a particular run's result.

## Reproducible build and tests

```sh
python review/build.py
python ui/build.py
python audit/build.py
python ui/build-icons.py
python ui/test-integrity.py
node review/test-core.cjs
node audit/test-core.cjs
node audit/test-service-worker.cjs
python ui/test-ui.py
python review/test-browser.py
python review/test-recovery.py
python audit/test-browser.py
```

Browser requirements: Playwright 1.55.0 and its installed browser(s), or `/usr/bin/chromium` for local Chromium. Set `CHROMIUM_PATH=playwright` for Playwright-managed Chromium, `AUDIT_URL` for the hosted origin, and `BROWSER_ENGINE=chromium|firefox|webkit`. The old suites use `UI_URL` and `REVIEW_URL`.

Local `set_content` tests explicitly emulate localStorage because navigation is blocked in the development container. They do not prove native persistence. Hosted CI uses real HTTP-origin localStorage and IndexedDB. Storage failures, external-tab events and Library transaction failures are deliberately injected in isolated profiles; no user's existing data is touched.

## Limits

This audit does not establish perfect AI play, a mathematically complete Renju implementation, exhaustive correctness of every one of the 655 exercises, native screen-reader certification, or performance on physical Android/iOS hardware. WebKit on Linux is not installed Safari on an iPhone. Multiplayer server authorization, room synchronization across real clients, and account-sync backend behavior require a separate server/integration audit; no production rooms or accounts are created by these tests. The game/training backup does not replace the separate opening-database export.

The full app retains its original architecture and public APIs; this release targets reproduced failures rather than removing specialist features to make tests pass.

### Primary references used to check behavior

- Renju International Federation, *International Rules of Renju*, definitions and §§4.2, 9.1–9.3: https://www.renju.net/rifrules/
- MDN, *Cache* and *CacheStorage*: https://developer.mozilla.org/en-US/docs/Web/API/Cache and https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage
