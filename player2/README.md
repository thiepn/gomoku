# Gomoku 2.0 — Player Journey & Home 2.0

Gomoku 2.0 turns the mature V1.x systems into one coherent player journey.

The V1.x stack already contains strong specialist systems: Learning Intelligence, Course 2.0, AI 2.0, post-game review, competitive play, online competition, opening study and Library & Archive 2.0. The remaining product-level problem is orchestration: users still need to know which subsystem to open next.

R1 preserves a secondary **Player journal** reached through More and one evidence-driven loop:

**Play → Review → Learn → Practice → Play again**

## R1 — Game-first route and accessible journal

**Play opens first**: the board is no longer hidden behind a dashboard.
Primary navigation remains **Play · Improve · Library**. The journal is
available through **More → Player journal**, with all evidence preserved.
The journal provides:

- one context-aware next action
- current learning-evidence strength, without inventing a rating
- review work waiting
- practice due
- saved Library count
- a visible four-stage improvement cycle
- opening-study status
- active local competitive-series status
- active online-room status

## Authority boundaries

V2.0 does not create a new learning model, review model, training scheduler, opening model, rating, Library, or online state.

It composes:

- `GomokuStudio.journey()`
- `GomokuLearningV11`
- `GomokuLibrary2`
- `GomokuOpening2`
- `GomokuCompetitive2`
- `GomokuOnline2`
- `GomokuPostGame2`

Existing systems remain authoritative.

## Next-action priority

1. return to an active online room
2. continue an active local competitive series
3. respect an unfinished current-game / review / practice Journey action
4. review stale or incomplete saved-game evidence
5. follow Learning Intelligence's current prescription
6. handle due practice
7. continue opening work when due
8. play a new game

No new persistence key or network dependency is introduced.

## Major-release boundary

R1 reverses the dashboard-first decision. The existing three main
destinations remain first-class, and More contains the Player journal.

Journal cards are reconciled by route identifier instead of destroyed on
every refresh. Keyboard focus survives both event-driven and periodic
updates; text only changes when evidence changes. Opening the journal moves
focus to its labelled heading and announces the section in the live region.
No new persistence key, server dependency or data migration is needed.
