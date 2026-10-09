# A5 — Personalized learning from games

**Branch**: `phase/a5-personalized-practice` (stacked on A4). Not a release; do not merge to frozen v1.0 `main`.

## What works

A5 turns evidence-qualified A4 positions into exercises in the **existing** Mistake Library rather than creating a new store, identity, API or billing dependency.

The game overview generates a study plan from original positions and current A2 analysis. Provisional bad moves require an *exact, same-root, completed-depth* comparison; missed immediate winning moves and immediate replies use rule facts. The existing `analysis/core.js` card schema and position IDs stay authoritative. Already-lost positions and incomplete comparisons do not generate new false-blunder exercises. Every saved exercise is independently checked again on opening.

**Seven tactical themes**: Finish the win; Urgent defense; Double threats; Renju legality; Forcing calculations; Opening fundamentals; Position judgment. The topic categorization is a practice aid, not a proof of its outcome.

The trainer now presents a due-first study panel, numbers due/saved/lapsed, a theme filter, Due Today shortcut and evidence qualification. It keeps all saved positions accessible. Its previous/next navigation, hints, solution reveal, undo-independent board, import/export, original JSON schema and private IndexedDB store are preserved.

Attempt scoring is conservative:
- A true one-move win may pass as a verified rule fact. A forcing certificate must pass independent validation by the existing tactical engine.
- A verified-win task **cannot** be completed with a merely favorable `Good`/heuristic move. Only independently supported alternatives count.
- Other correct decisions require same-root comparable search evidence. These remain provisional engine estimates, not mathematical proof.
- Unscored or stale references cannot record a successful recall or false lapse.
- Hints and revealed answers remain **assisted**, never unassisted successes.
- Scheduling (1, 3, 7, 14, 30, 60 days for clean successes; 10-minute miss retry) and existing `GomokuMistakes.record(id, verdict, runId:cardId)` event IDs are not changed. Opening/previewing/filtering does not create recall events. Historical events, streaks and due dates are not migrated or reset.

## Modules

- `analysis3/practice-core.js` — pure task qualification, seven themes, due-first planning and conservative attempt policy.
- `analysis3/practice.css` — scoped A5 study dashboard and evidence badges.
- `analysis/training.js` — existing live practice UI and current progress storage.
- `review/review.js` — create eligible position-linked cards from the whole game, show the main study theme and launch the library.
- `analysis/build.py` — gated pure practice-core script inserted **before** training UI, plus isolated CSS. Build order unchanged: `review/build.py`, `ui/build.py`, `analysis/build.py`.

**Version**: UI `3.0.0-a5`, engine evidence remains `3.0.0-a2`. The older A4/A3/A2 navigation caches can be read; evidence is reused only after exact key/version checks.

## Qualification and limits

A5 does not use a generative AI API, invent exercises or grant mastery by reviewing a solution. Search estimates are provisional. Forced tactics are only described as verified if proof certificates are independently validated. This change does not improve the actual underlying game engine's Elo. Incomplete results never imply safety, draws or fault.

## Acceptance

Targeted tests:
```sh
node analysis3/test-a5.cjs
node analysis3/test-a4.cjs
node analysis3/test-a3.cjs
python review/build.py
python ui/build.py
python analysis/build.py
python review/ux/test-integrity.py
python analysis/test-integrity.py
python ui/test-integrity.py
python analysis3/test-a5-browser.py
python analysis/test-browser.py
```
The branch's `verify-analysis3-a5.yml` must pass **before** opening any promotion path. Chromium/browser tests are not equivalent to physical Android qualification. Generated `index.html` and `sw.js` can be committed to the A5 branch only after tests.

**Next**: A6 — worker cancellation, bounded caches, honest device budgets and offline/PWA performance.
