# Gomoku 1.7 — Online Competition 2.0

This release consolidates navigation around the existing online stack. It does not create a new room, ranked, tournament, challenge, account, profile or community implementation.

## What changes

When the existing Online Renju workspace is open, a compact context-aware home appears above it.

It shows:
- current competitive identity
- active-room state
- one recommended next online action
- direct routes to Ranked
- Seasons & cups
- Rooms & history
- Competitive identity
- Community / direct challenges

## Routing rules

- active online room → return to that room first
- signed-in player with public username → ranked matchmaking is the default competitive route
- anonymous or incomplete identity → ordinary rooms remain immediately usable; account setup is only required for ranked/season/profile/community features
- tournaments, challenges, profiles and community always route into the existing `GomokuCompetition` surfaces

## Preservation boundary

No changes to:
- server endpoints or authentication
- ranked rating / matchmaking
- tournament brackets or check-in
- challenge lifecycle
- room protocol / reconnection / history
- trust & safety
- profiles, seasons or achievements
- v1.6 local competitive play
- game rules, AI, review or save formats
