# Review Workspace 2.1 — clear decisions, safe exploration

Implemented in `thiepn/gomoku` on top of Analysis 2.0. Baseline commit:
`1b2622d8206166f6d515388345e6a2d15e849351`.

## Research and the actual problem

The design uses the official Chess.com product documentation, accessed September 17, 2026:

- Game Review: https://support.chess.com/en/articles/8584089-how-does-game-review-work
- Free Analysis: https://support.chess.com/en/articles/8583757-how-do-i-use-game-analysis

The useful patterns are an overview before detailed review, distinct guided and self-directed analysis, contextual explanations, explicit retry/best actions, move navigation and settings disclosure. This is not a clone of Chess.com's branding, assets, proprietary scoring, or interface. No comparative user study was performed, so this release does not claim demonstrated usability superiority.

The existing Gomoku flow was captured using the actual baseline HTML and a synthetic game. It presented engine strength, refinement, game statistics, training, coaching, multiple alternatives and evidence together. The board became secondary to the controls. More seriously, the main verdict still described the original recorded move while a different move was being tested. Returning from a long explanation could leave the verdict out of view. These were interaction and information-hierarchy problems, not a need for more engine settings.

## The new journey

**Overview → Guided review → Free analysis.** The views share one board and one workspace. Proof and retry are explicit submodes, not extra navigation destinations.

Overview shows the actual result, final board, eligible key decisions, honest strong/unresolved counts, and one clear review-start action. No synthetic Elo, accuracy percentage or calibrated win probability is invented. Already-lost positions are not counted as fresh mistakes.

Guided review shows the selected move, its classification and evidence status, a concise concrete explanation, played-versus-best comparison, and a retry action. Full explanations and detailed engine evidence remain accessible but are not expanded by default. A separate every-move navigator is distinguished from next-key-moment navigation. The final key moment leads to a recap rather than silently wrapping. When there are no key moments, the tour goes through every recorded move.

Free analysis starts **before the selected move**, making it explicit which decision an alternative replaces. Candidate numbers on the board correspond to the list, including text classifications; poor candidates are not all colored as good. Hover and keyboard focus preview an intersection without changing the game. Clicking a candidate or legal board point starts a separately labeled test line. Every new test move and best reply updates its own assessment. Undo/redo, saved variations, suggested continuations, deeper test-move analysis and return-to-review are available.

Retry conceals candidate markers, alternative buttons and their detailed numerical evidence. Revealing the best move is a deliberate action. The existing independent attempt evaluation is retained. Escape first exits options, retry, a proof or a test line; explicit Close exits the workspace. The personal mistake library remains available from Overview/Options and Learn.

## Responsive and accessible interactions

The desktop header combines navigation into one row. The board remains visible while longer coaching text scrolls independently; the move record stays at hand. The selected move is brought into view without scrolling the whole page. On standard-height mobile portrait screens, the board stays visible while the explanation scrolls. The persistent bottom action offers retry, a best reply or return to review as appropriate. Export and the mistake library are available under Options rather than competing with primary mobile actions. Short landscape windows use one continuous content scroll.

Touch input previews a selected intersection and asks for confirmation before placing an analysis stone. Keyboard users can navigate the board, tabs and timeline with arrows/Home/End. Focus states, labels, reduced-motion handling and the existing daylight/night/slate, large-text and high-contrast settings are retained. These are implemented accommodations, not full accessibility certification.

## Preserved invariants and build

The pure Guided Review classification core is byte-identical to the baseline. The Analysis 2.0 engine, threat verifier, worker runtime, training system, game rules, original course data and storage schemas are not replaced. Review and training cache versions remain `2.0.0`; `GomokuReview.workspaceVersion` is `2.1.0`. The original moves/study tree are never rewritten by exploration. Only the approved review UI module hash changes in the UI integrity manifest.

Source: `review/review.js` and `review/ux/workspace.css`. The maintained CSS is embedded into the existing portable HTML by `review/build.py`. All build scripts use the same new service-worker cache tag.

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
python review/test-browser.py
python review/test-recovery.py
python ui/test-ui.py
python analysis/test-browser.py
python review/ux/test-workspace.py
```

Set `CHROMIUM_PATH=playwright` to use Playwright-managed Chromium. Hosted test runs use `WORKSPACE_URL`, `REVIEW_URL`, `UI_URL`, and `ANALYSIS_URL`. The local `set_content` fallback explicitly emulates localStorage; it does not certify native persistence or PWA updates. CI runs real HTTP-origin regressions, then verifies exact deployed HTML/service-worker hashes and tests the public site in an isolated profile.

The workspace suite covers the guided journey, move/variation context, no-spoiler retries, undo/redo, scroll restoration, keyboard navigation, mobile confirmation, short landscape, themes, no-key-moment games and game-data preservation. Existing analysis, proof, UI, recovery and native-storage suites remain in place. Screenshots use synthetic fixtures, never a user's actual game or progress. Physical devices, other browser engines, screen readers and all possible positions are not exhaustively certified.
