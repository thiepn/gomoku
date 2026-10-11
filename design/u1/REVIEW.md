# U1 — Gomoku Major UI Redesign · visual options and owner review

**Status (2026-10-11): DESIGN EXPLORATION · OWNER DECISION PENDING · NO_GO.**
These are design-only deliverables. They are not an implemented UI, current-product screenshots, mobile acceptance, an approval, or a request to merge.

## Baseline verified before branching

- Parent is **A27 draft PR #87** at exact `d5bdc0f4639b429722298c55906fc3d43d15bae8`, based on A26 exact `407bfb88430539932ab6bf07df1b33ae7b86829c`. Parent is open, draft, unmerged. Its six PR workflows (A27/R4/P19/P20/P21/P23) and dedicated A27 push run completed successfully. Jobs and retained artifact listings rechecked; original artifact bytes not newly reverified in U1. No physical user/device evidence is thereby supplied.
- Inspection of `ui/README.md`, `ui/studio.css`, `ui/studio.js`, `ui/build.py`, `ui/test-ui.py`, `gamefeel2/README.md`, `analysis3/A3-WORKSPACE.md`, `analysis3/ROADMAP.md`.
- Current **Tournament Table** visual system has graphite/mineral panels, vermilion accent, timber board, three primary destinations: Play / Improve / Library; analysis/review lives within advanced flows and dialogs. On mobile `#panel-play` inspector is hidden by the theme's <=760px CSS. UI report describes 14 original chapters and 655 tasks and tests 1440/390/360/768px emulated layouts. The offline build currently embeds styling/logic in a large self-contained `index.html`.
- `main` recorded as `5ab04aee304b00a999aa0a703c2867a273f6ee29`. No deployment state inferred from this SHA.
- Source-file audit only, **no actual production screenshot capture** in this phase. Concept mockups are illustrative and not faithful screenshots of the existing app.

## Three distinct candidates

### A — Precision Arena · recommended but **not selected**
Competitive yet restrained dark tactical layout. Warm matte board is dominant; vermilion is a single decisive-action accent. Desktop: persistent thin navigation rail and narrow match room. Mobile: turn strip, large board, explicit select-then-confirm control, secondary actions below board; four-destination bottom navigation. Analysis shows verified evidence distinctly from estimates and unknowns. Benefits: high board priority, immediate mode clarity, confident visual identity. Risks: excessive darkness/density and contrast management.

### B — Scholar's Study
Editorial, quiet, warm ivory with parchment, brown/oxblood accent and serif display headlines only. Desktop: slim horizontal navigation, framed board and two spare informational rails. Mobile: notebook-like readability with a large uninterrupted board. Benefits: ideal calm learning language and timeless quality. Risks: can resemble a reader rather than a game; warm-on-warm contrast must be tested.

### C — Modern Glass
**No actual glass blur or shiny gradients required**: airy blue/steel architectural surfaces with large neutral mineral board, rational alignment, unambiguous accent. Desktop: compact top navigation and two modular utility columns. Mobile: precise tabs, generous tapping and simple type. Benefits: legible modularity and mobile density. Risks: material feels less traditional; twin rails could squeeze laptops.

## Reference boards

`visual-references.svg` is an inline, source-controlled **illustrative comparative storyboard**, not a screenshot or implementation. A separate 12-file U1 review packet (author-generated PNG/SVG desktop + mobile Play/Analyze/Learn sheets for each direction, visual explorations and owner decision document) was created in the ChatGPT conversation. The original packet is provided to the owner for inspection; do not claim its PNG files were uploaded to GitHub.

## Provisional comparative judgment (not user-study data)

| Criterion (weight) | A | B | C |
|---|---:|---:|---:|
| Board-first clarity (30%) | 5 | 4 | 4 |
| Mobile task efficiency (25%) | 4 | 4 | 5 |
| Navigation discoverability (15%) | 5 | 4 | 5 |
| Analysis/learning flexibility (15%) | 4 | 4 | 4 |
| Distinctiveness (10%) | 5 | 5 | 4 |
| Source integration simplicity (5%) | 4 | 4 | 4 |
| **Weighted subjective / 5** | **4.55** | **4.15** | **4.35** |

**Recommendation**: A plus C's generous mobile touch spacing, *not a visual reference lock*. No selection can be inferred from a recommendation.

## Functionality invariants before any U2 implementation

1. Game: preserve legal 15×15 rules for freestyle, exact-five, Renju and whatever modes are already available; AI/analysis core, pass/undo, mobile select-then-confirm, resume, saved games.
2. Analyze: retain verified proof / limited search estimate / unknown distinctions. No unsupported percentage or certainty. Review/candidate stepping should not mutate game history.
3. Learn: preserve 14 chapters, **655 existing tasks**, all saved completion, chapter resume, training/recall.
4. Library: preserve browser-local games/studies, local import/export, offline operation, settings, theme, large text, reduced motion and high contrast.
5. Architecture: protect `review/build.py → ui/build.py → analysis/build.py` deterministic embedding, existing SW/PWA, scripts, source hashes and all previous golden screenshots until genuinely approved change.
6. Security: do not change auth/RLS/privacy, release workflows, hosted origin, DNS, production data or environment secrets; A11 physical acceptance remains NOT TESTED, A12/A13 release gates NO_GO.
7. New top-level navigation proposed **Play / Analyze / Learn / Library** is a new information architecture, not implemented in U1. It must preserve old programmatic route/back-button semantics or provide tested adapters.

## Owner visual gate (required)

Owner must select **A / B / C / hybrid / revise** and explicitly confirm whether the four mobile bottom destinations, board texture, default chrome contrast and typography are acceptable. Until that choice: status = **PENDING**; no visual identity is frozen.

**Proposed U2, NOT STARTED:** New isolated draft branch stacked after U1; implement approved design tokens, actual navigation and application adapters incrementally without changing business logic. Verify 1440×900, 1280×800, 768×1024, 390×844 and 360×800 plus keyboard, offline/recovery, actual course progress, source determinism and all existing suites. No merge/deploy/production without separate authorization.
