# Gomoku 1.7 — Online Play 2.0

v1.7 consolidates the product experience around the existing online systems. It does **not** add another network protocol, rating system, tournament engine, social graph, or room implementation.

## Changes

- the online workbench opens with one clear **How do you want to play?** launcher
- direct routes to:
  - Ranked
  - Tournaments & players
  - Private room
  - Live rooms
- the existing online tool is renamed to **Play online**
- active rooms gain a compact, consistent context line:
  - ranked
  - tournament
  - direct challenge
  - private room
  - spectator state
- completed online games gain concise mode-specific metadata beside the existing post-game controls
- the authoritative room / ranked / tournament / challenge actions remain unchanged

## Preservation boundary

No changes to:
- room protocol or server endpoints
- ranked rating calculations or matchmaking
- tournament lifecycle / brackets
- direct challenge lifecycle
- account identity or trust systems
- reconnection / persistence
- chat / undo / draw behavior
- result recording
- Guided Review
- v1.6 local competitive series
