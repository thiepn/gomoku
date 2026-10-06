# Gomoku 1.7 — Competition Hub 2.0

v1.7 creates one front door for the competition systems that already exist.

## What it consolidates

- Local Competitive Play 2.0
- Ranked Renju matchmaking
- Seasons and tournaments
- Verified players and direct challenges
- Casual/private online rooms

The hub does not implement rules, ratings, tournaments, rooms or social features itself. It routes to the existing authoritative systems.

## Behavior

- the legacy **Competition** launcher and modern Tools → Competition entry open the same compact hub
- an active local competitive match is surfaced at the top
- an active online/ranked room is surfaced at the top
- local competitive play is disabled while an online room is active
- online entry points are disabled while a local competitive series is active
- ranked readiness reflects only existing account connection + public username state
- tournament/community destinations reuse the existing online competition surfaces

## Preservation boundary

No changes to:
- Gomoku/Renju rules
- AI
- clocks
- v1.6 series state
- ranked rating/matchmaking
- seasons/tournaments
- challenges/community
- online room protocol/history
- account permissions
- review/training
- saved-game formats
