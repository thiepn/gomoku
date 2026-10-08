# R2 — Runtime and performance consolidation

R2 optimizes the existing 2.0 portable Gomoku PWA without modifying the 1.0 frozen release or inventing a second state authority.

## Changes

- Online Competition 2.0: workbench-scoped mutation reaction, 400 ms → 4000 ms fallback verification, and no background-tab polling. Genuine `gomoku:room`/`gomoku:result` updates still render immediately.
- Course 2.0: 2500 ms → 10000 ms active-Improve verification; no polling hidden tabs; only redecorate all chapter dialogs when course evidence or DOM structure changes. Transfer changes remain event-driven.
- Learning Intelligence: 2500 ms → 8000 ms active-Improve fallback; no hidden-tab recomputes; the existing mistake and transfer change events still refresh immediately.
- Player journal: suppress background recap recomputation on every game move when journal is closed. Keep a visible-journal 8-second safety refresh and immediate event-driven updates. Opening the journal always reads authoritative data.
- Existing one-file `index.html` stays authoritative and offline-capable, with module source embedded reproducibly. No network dependency, broken app-shell cache or deferred startup request is introduced.

## Performance evidence

CI records desktop/mobile Chromium **observed** local cold boot to core + UI ready, and tests the real board, online focus-preserving rerender, course dialog identity across idempotent refreshes and 35 learning skills. The 16-second boot and 3.5-MB HTML budgets are conservative regression ceilings, **not** claimed performance improvements or network transfer sizes.

The module timers reduce at least 4.0 Hz of avoidable default *potential* background work per open window; actual CPU savings depend on user route, state, hardware and browser. Further R2 stages could split optional code into separately cached PWA assets, but only after preserving bundled offline-fallback behavior and measuring parsed/transfer cost on actual phones. No such split is claimed here.

Release boundary: R2 remains on the 2.0 development stack. Physical Android R0 evidence is required before frozen 1.0 may ship.
