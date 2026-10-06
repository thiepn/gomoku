# Gomoku 2.0 — Unified Player Journey

Gomoku 2.0 is the first release that treats the mature V1.x systems as one product instead of a collection of powerful destinations.

## Why 2.0

V1.1–V1.9 built the learning model, course, AI, game feel, post-game loop, competitive play, online competition, opening study, and archive. The remaining product-level problem is routing: the app still opens into Play and expects the player to know which subsystem should come next.

2.0 adds a first-class **Home** destination that composes the existing authoritative state into one player journey.

## Home

Home presents four connected layers:

1. **Next move** — the existing Journey planner's current recommendation.
2. **30-minute session** — the existing Journey plan, in order, with direct actions.
3. **Development** — Learning Intelligence summary plus Course 2.0's next useful chapter.
4. **Around the board** — Library & Archive, Opening Study, and competitive/online context.

The UI is intentionally Gomoku-specific. It is a player desk, not a generic dashboard.

## Authority boundaries

2.0 does not create a second learning model or persistence layer.

- current-work routing comes from `GomokuStudio.journey()`
- mastery comes from `GomokuLearningV11`
- curriculum state comes from `GomokuCourse2`
- archive state comes from `GomokuLibrary2`
- opening context comes from `GomokuOpening2`
- local competitive continuity comes from `GomokuCompetitive2`
- online identity/room context comes from `GomokuOnline2`

## Navigation

Primary navigation becomes:

**Home · Play · Improve · Library · More**

For migration safety, the existing Play route remains the initial launch surface in 2.0. Home is the first navigation destination and can be opened without mutating any user data. A later release can change startup behavior after real-device acceptance without destabilizing the mature board-first flows.

## Preservation boundary

No changes to:

- rules or legality
- engine/search policy
- learning/mastery scoring
- course task content
- review analysis/freshness semantics
- Library storage or saved formats
- opening corpus/repertoire semantics
- competitive match rules
- online room/ranked/tournament mechanics
- backup/restore formats

No new storage key, account dependency, network request, cloud database, rating system, or duplicated recommendation evidence is introduced.
