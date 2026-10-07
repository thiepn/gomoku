# Gomoku 2.0 — Player Journey & Home 2.0

Gomoku 2.0 turns the mature V1.x systems into one coherent player journey.

The V1.x stack already contains strong specialist systems: Learning Intelligence, Course 2.0, AI 2.0, post-game review, competitive play, online competition, opening study and Library & Archive 2.0. The remaining product-level problem is orchestration: users still need to know which subsystem to open next.

V2.0 adds a first-class **Home** destination and one evidence-driven loop:

**Play → Review → Learn → Practice → Play again**

## Home

Home is now the default route and provides:

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

V2.0 changes the root information architecture from:

**Play · Improve · Library · More**

to:

**Home · Play · Improve · Library · More**

This is intentionally the first V2 release because it changes how the whole product is entered and understood rather than adding another specialist feature.
