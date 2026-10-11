# U2 — Precision Arena approved presentation foundation
Owner selection: **A — Precision Arena**, approved 2026-10-11.
Status: ISOLATED DRAFT, NOT MERGED, NOT DEPLOYED, source/browser qualification pending. Release NO_GO.

## Source custody
- U1 PR #88 exact `5bf968102d3f5bcb75ed73523eb6d5b461cbee76`, 3 commits ahead of A27; U1 P19/P20/P21/P23 exact-head CI all successful. U2 is independently branched directly from U1.
- A27 PR #87 exact `d5bdc0f4639b429722298c55906fc3d43d15bae8`, A26 #86 `407bfb88430539932ab6bf07df1b33ae7b86829c`; immutable ancestry.
- Frozen main at preflight `5ab04aee304b00a999aa0a703c2867a273f6ee29`. No main or production changes.

## What U2 actually implements
- `ui/arena.css`: owner-selected dark graphite, vermilion action color, warm original board material, modern information hierarchy, desktop 102px left rail, layout with dominant board and match inspector; mobile safe-area-aware four-item bottom navigation and spacious board-first layout.
- `ui/arena.js`: four semantic destinations **Play · Analyze · Learn · Library**, bridged to existing original `play/improve/library` routing and `study` subroute. No rewrite of game, course state, scoring, saved content, engine, or persistence. Analyze uses actual Study position route. Renames only the display and accessible name of Improve to Learn while retaining the original `data-v92-route`.
- `ui/build.py`: deterministic, idempotent inline embedding of new modules in disposable built index, early body class and PWA/theme color sync. Existing Tournament Table sources and board renderer unchanged. The full >3MB committed generated `index.html` could not be safely retrieved via connector; **no generated index is committed**, and no production artifact is asserted to match this new source yet.
- `ui/test-arena.py` and SHA-pinned read-only `verify-u2-precision-arena.yml`: rebuild transient candidate, preserve existing legacy/source hashes, test actual localhost Chromium desktop/tablet/mobile, record screenshots and original reports. No browser requests to production required.

## Explicit exclusions / gates
No changes to 15×15 board geometry, freestyle/exact-five/Renju legality, AI, analyses, account, multiplayer, PWA service worker semantics, saved game records, 14 chapters/655 tasks, storage and import/export contracts. U2 changes metadata color only in generated candidate. Existing high-contrast, large-text, reduced-motion and keyboard modes remain required test contracts. Old visual screenshot goldens are never changed or weakened.

### Release status
All original Android Chrome 0/7, Samsung Internet 0/6, PWA 0/5, accessibility 0/7 are still **NOT_TESTED**, A11 approval **NOT_GIVEN**, A12 cutover **NOT_EXECUTED**, A13 live monitoring **NOT_TESTED**, and release **NO_GO**. Do not dispatch privileged release workflows, modify auth/DNS, merge or deploy.

### U3 proposal — Gameplay Experience Detail
Not started. After U2 visual/runtime qualification: redesign the real move controls, player handoff, AI configuration and result feedback, and verify physical visual interactions without changing game rules.
