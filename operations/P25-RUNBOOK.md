# P25 — Product UX, Accessibility & Final Quality Pass

P25 is the final product-facing quality pass before burn-in and stable-release certification. It is evidence-driven rather than a broad redesign.

## Audited journeys

1. First launch.
2. Play home.
3. Local move commit and post-move guidance.
4. Improve catalog.
5. Representative learning dialog.
6. Library.
7. Settings.
8. New game.
9. Guided Review.
10. High-contrast + large-text mode.
11. Narrow mobile Play.
12. Narrow mobile Improve.

Each accepted state is stored as a full-page screenshot in `p25-audit-output/`.

## Accessibility target

P25 targets the automatable WCAG 2.2 A/AA baseline while preserving explicit evidence limits.

The gate uses `@axe-core/playwright` 4.13.0 with WCAG 2.0 A/AA, WCAG 2.1 AA and WCAG 2.2 AA tags. Critical and serious violations block release.

Additional checks require:

- visible actionable controls in audited states to be at least 24×24 CSS px;
- a 40-step keyboard focus walk to keep focus visible and inside the viewport;
- a focus outline at least 2 CSS px wide;
- keyboard board navigation and commit to remain functional;
- built-in high-contrast and large-text modes to remain functional;
- no audited state to emit an uncaught page error.

WCAG 2.2 Target Size (Minimum) uses 24×24 CSS px as the baseline unless an exception applies. P25 intentionally uses a simple stronger rule for the audited controls rather than trying to infer every spacing exception automatically.

## UX priority order

P25 does not redesign for novelty. Fixes are prioritized as:

1. blocked or misleading primary action;
2. unclear recovery/error state;
3. accessibility blocker;
4. keyboard/touch reachability;
5. responsive/reflow problem;
6. inconsistent hierarchy/copy;
7. visual polish.

P24 already owns browser/device/network compatibility.

## Evidence

`audit/p25-product-quality.mjs` emits ordered screenshots plus `p25-audit.json` containing axe findings, target-size evidence, keyboard-focus evidence, page errors and limits. GitHub Actions retains the evidence for 14 days.

## Deployment qualification

Pull requests run on a local HTTP origin. On `main`, `p25-deployed-quality` waits until the public `index.html` at `https://thiepn.dev/gomoku/` exactly matches the committed hash, then repeats the same audit against the public deployment.

## Evidence limits

Passing P25 is not a claim of complete WCAG conformance. Automated axe cannot fully prove screen-reader speech output, cognitive usability, speech input or physical assistive-technology behavior.

Physical-device claims remain governed by P24's explicit deferred matrix.

## Release boundary

P25 stays outside P16's Supabase admission ledger because it is a client/product-quality gate. Final stable-release certification can require both backend/security evidence and deployed P22/P24/P25 client evidence.


## Measured fixes

The consolidated P25 pass carries only defects reproduced by the audit:

- the keyboard skip link now moves actual focus to the board and makes that focus visible;
- SPA Play / Improve / Library route changes are announced through a polite live region without stealing focus;
- dialogs without an authored accessible name inherit one from their first heading;
- the Play mode selector is exposed as a semantic group;
- chapter-1 puzzle intersections use native labelled buttons inside a labelled group instead of an incomplete ARIA grid/gridcell hierarchy;
- chapter-1 progress text was darkened after axe measured a 4.49:1 contrast ratio against the 4.5:1 AA threshold;
- compact competitive scope tabs now retain at least a 28px control height;
- course-number artwork contrast is strengthened in desktop and mobile layouts.

The older parallel P25 branches are superseded by this consolidated branch and should not be merged independently.
