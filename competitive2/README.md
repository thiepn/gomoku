# Gomoku 1.6 — Competitive Play 2.0

v1.6 does not replace the existing competitive engine. V9.7, ranked matchmaking, tournaments and multiplayer remain authoritative.

The release fixes the product-level seam between **competitive series** and **v1.5 Post-Game Experience 2.0**.

## Changes

- explicit competitive-series progress under the existing match strip
- accessible progress semantics for game number and score
- post-game result handoff becomes series-aware
- unfinished series → **Next game** is primary
- finished series → **New competitive match** is primary
- **Review this game** remains available as the secondary learning path
- v1.5 can no longer overwrite the competitive next-game wording/state
- paused competitive clocks keep the existing Resume clock path

## Preservation boundary

No changes to:
- rules or Renju foul handling
- clock accounting
- Swap2 / Taraguchi-10 mechanics
- AI
- ranked ratings or matchmaking
- tournament operations
- multiplayer protocol
- saved-game formats
- Guided Review evidence
- v1.5 generic post-game behavior outside competitive series
