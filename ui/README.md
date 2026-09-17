# Gomoku Studio — Tournament Table

Visual release 1.0.0, September 17, 2026. An implemented presentation redesign of the existing game, not a separate prototype.

## Research and chosen direction

The research used primary product and accessibility documentation available in 2026. The objective was not to imitate a particular game's brand or assert that every current game shares one visual trend.

- Riot Games, **VALORANT Patch Notes 12.04**, March 3, 2026: a reorganized end-of-game experience with Summary, Timeline, and Progression. Borrowed the separation of match information from progression, not its graphical assets. https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-04/
- Riot Games, **VALORANT Patch Notes 12.07**, April 14, 2026: clearer settings categories and parent/child relationships. Borrowed the hierarchy principle: match mode, opponent strength, then optional details. https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-12-07/
- Chess.com, **How does Game Review work?**, accessed September 17, 2026: distinct Review, Retry, Best, and contextual explanatory actions. Kept the existing Guided Review's action clarity and made its visual language match the main game. https://support.chess.com/en/articles/8584089-how-does-game-review-work
- Supercell, **March Update 2026**, February 23, 2026: more direct mode access and changes to visual consistency. Borrowed direct mode selection, not progression or monetization systems. https://supercell.com/en/games/clashroyale/blog/release-notes/march-update-2026/
- Microsoft, **Xbox Accessibility Guideline 101: Text display**: readable, scalable text and controlled hierarchy. Used as a design/testing reference, not a claim of certified compliance. https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101

The selected identity is **Tournament Table**: charcoal navigation, a restrained vermilion accent, pale mineral surfaces, birch/ash board material, and graphite/porcelain stones. Custom vector chapter signatures use the actual visual language of intersections and lines. System typography avoids network font loading. The redesign adds no third-party game artwork or fonts.

## Audit findings and decisions

1. **Play was not limited to play.** Chapters 9–14 could appear after the game on Play and Library. All 14 original backing cards now live together in Learn, remain available to their original scripts, and are represented by a single visible catalog. No course data was removed.
2. **Course entry points had incompatible layouts and hardcoded theme colors.** The catalog now has one hierarchy, actual task counts/progress, three skill filters, and accessible chapter actions. Later chapters resume through the original saved-location handler.
3. **The board and surrounding controls competed visually.** Replaced the strong yellow material/woodgrain and ornate mark with a quieter board, new stone rendering, actual player-turn cards, and a grouped match inspector. Canvas dimensions, intersection positions, coordinates, move handling, and rules are unchanged.
4. **A cosmetic wrapper could silently break existing settings.** Explicitly retained focus mode, daylight/night/slate, large text, high contrast, and reduced motion; repaired specificity conflicts rather than hiding the settings.
5. **Later lesson boards faded their disabled occupied intersections.** Stones and grid lines now remain opaque even where a cell cannot be clicked. Desktop board-based later lessons use side-by-side text and board; mobile retains scrollable content and reachable bottom actions.
6. **Review and general dialogs looked disconnected.** Guided Review, new-game setup, menu, settings, and lesson dialogs use the same surfaces and typography. Review judgments, candidate search, retry logic, and game history are untouched.
7. **Mobile confirmation covered neighboring controls.** The placement-confirmation bar now occupies space in the board layout rather than floating over other actions. The original select-then-confirm interaction is preserved.

## Implemented scope

- Single desktop navigation; safe-area-aware fixed bottom navigation on mobile.
- New original geometric identity and matching PNG app/PWA icons, generated deterministically without image dependencies.
- Quieter board material, graphite/porcelain stones, active-player state and contextual last-six-move record.
- Difficulty selection with a passive strength indicator; optional opponent details stay secondary.
- Guided Review entry for the current game, preserving all recorded moves.
- One course catalog: 14 chapters, 655 original tasks, live completion counts, Foundations / Tactics & strategy / Advanced filters.
- Practice opens the choice screen instead of silently starting a task.
- Existing later-course continuation semantics, native game mode controls, specialist tools and library workflows retained.
- Native theme setting drives the quick toggle; saved user preferences and storage formats are not migrated.

## Implementation and build

The deployed `index.html` stays self-contained. Source is maintained separately:

- `studio.css`: the shared visual system and component states.
- `studio.js`: presentation adapters over existing public APIs and real controls.
- `board-material.js`: the permitted canvas material/stone-renderer replacement.
- `build.py`: guarded, repeatable embedding and manifest/cache synchronization.
- `build-icons.py`: deterministic original icon rendering with Python's standard library.

Run from repository root:

```sh
python review/build.py
python ui/build.py
python ui/build-icons.py
node --check ui/studio.js
node review/test-core.cjs
python ui/test-integrity.py
python review/test-browser.py
python review/test-recovery.py
python ui/test-ui.py
```

Browser tests need Playwright and Chromium. Set `CHROMIUM_PATH=playwright` for Playwright-managed Chromium. Set `UI_URL` and `REVIEW_URL` for tests against a hosted HTTP origin. Local `set_content` runs explicitly emulate localStorage; they do not establish native storage or PWA behavior. Hosted CI uses a real localhost origin, and the deployed check uses the live origin in an isolated browser profile. The UI integrity manifest records the approved release hashes for all inline modules plus game logic outside the material renderer. The Renju center-first repair intentionally updates the rules-engine and game-app hashes; unrelated modules remain unchanged. Any later intentional engine/course change must update that invariant explicitly.

## Verification scope

The new UI suite exercises 80 assertions, including the Renju center-first interaction: all chapter entry/return flows; real answer/progress; later-course resume; route isolation; filters; focus mode; real theme settings; no move mutation; library; local setup; review entry; high contrast and large text; desktop and 390/360/768-pixel responsive layouts; bottom navigation; original touch selection/confirmation; console errors.

The existing Guided Review suite has 18 deterministic tactical checks, 31 browser interaction checks, and 9 recovery checks. These are targeted regressions, not proof of perfect Gomoku play, exhaustive validation of 655 exercises, or full accessibility certification. Native screen readers, Safari/Firefox, installed Android/iOS behavior, and physical-device performance need separate checks.

Screenshots and JSON reports are CI artifacts, not production assets. Do not publish test fixtures as a user's actual game or progress.

## Post-release regression audit

The full-app audit after the center-opening hotfix intentionally changes rule-input validation, legacy-study handling, review pass context, game/training backup integration and chapter-storage recovery. The approved integrity manifest now covers that repaired implementation, not an assertion that every original module is still byte-identical. All original lesson content is checked separately. See `../audit/README.md` and `../audit/approved-module-changes.json` for reproductions, approved changes, tests and scope limits.
