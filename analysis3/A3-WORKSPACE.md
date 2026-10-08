# A3 — Board-first Analysis Studio

Status: implementation on `phase/a3-analysis-workspace`, stacked on A2. **Not a production release.** The pinned 1.0 `main` remains frozen.

## What changed

A3 gives **Free analysis** a dedicated, visually differentiated game workspace without replacing Guided Review or the existing real board. The left board is the focal point, with a graphite/chalk analytical surface around the existing wooden 15×15 game grid. The right panel contains actual engine evidence and a candidate comparison interface.

- **Three board overlays:** Candidates (only legal returned suggestions), Threats (reported tactical targets from A1/A2 evidence), and Variation (validated principal-variation steps). There is no invented 225-cell heatmap, fake win probability, or AI-written proof.
- **Read-only variation stepping:** Preview a candidate before making any experimental moves. Previous/Next traverses a line replayed through the existing variant-aware review core. Reset returns to the original before-move position. Read-only steps never change `GomokuStudio` game history, saved test branches, or assessed original decisions.
- **Two-move comparison:** Pin one move, select another, and inspect their labels and completed depths. When both are same-root exact completed scores, the UI describes the comparison as provisional engine evidence, not as a mathematical certainty.
- **Proof-aware candidate priority:** Existing evidence-first ordering survives. Actions are separate: **Preview** is read-only, **Explore** creates a test branch, and **Pin** is for inspection.
- **Fast-scan telemetry:** Completed search depth, returned/requested lines, search backend and evidence state are visible without requiring an additional Advanced menu.
- **Responsive and accessible:** Keyboard focus labels, select-and-step controls, touch targets, dark-studio contrast, narrow-screen layout and reduced-motion fallback. The actual rules, offline worker, account assumptions and PWA routes are unchanged.

## Architectural boundaries

`analysis3/workspace-core.js` contains pure board-coordinate, line validation, preview and overlay models; it intentionally never evaluates chess/Gomoku positions or assigns scores. `review/review.js` owns UI/session state and calls that core. `analysis3/workspace.css` owns only the Free Analysis presentation; `review/build.py` embeds the source modules into the offline application deterministically.

**Engine and review versions differ deliberately:** A3's UI is `3.0.0-a3` while the authoritative analysis engine evidence is still `3.0.0-a2`. Previous valid A2 results can be reused if their exact board/rules/side/settings match. No preserved game or practice events are deleted.

## QA and qualification

From repository root after building the portable artifact:

```sh
python review/build.py
python ui/build.py
python analysis/build.py
node --check review/review.js
node --check analysis3/workspace-core.js
node analysis3/test-a3.cjs
python review/ux/test-integrity.py
python analysis/test-integrity.py
python review/ux/test-workspace.py
python analysis3/test-a3-browser.py
```

The native/browser suites and source-matching build are required before merge. Screenshots are generated in `analysis3-test-output/`. Browser tests against `set_content` do not qualify native storage or service worker; a real HTTP origin is used in CI.

## Explicit limitations and next step

A3 improves legibility and interaction. It does **not** increase the native engine's Elo, solve unknown positions, prove that a defensive move is safe, or validate use on physical Samsung/Android devices. A4 adds full-game diagnosis, comparisons across key decisions and timeline uncertainty.
