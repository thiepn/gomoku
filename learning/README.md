# Gomoku 1.1 — Learning Intelligence

v1.1 turns the existing course, Academy, Guided Review and mistake training into one evidence-based learning loop.

## What it adds

- A 35-skill graph spanning board vision, tactical shapes, defense, calculation, strategy, Renju rules and opening play.
- Mastery that distinguishes **exposure**, **clean retrieval** and **real-game transfer**. Course completion contributes at most 35 points by itself; repeated drills in one session can make a skill strong, but cannot make it mastered without independent game-derived evidence.
- Evidence from the existing 14 course chapters, Academy session attempts, flagged-decision practice and Analysis 2 mistake cards.
- Recency-aware evidence without silently deleting older learning history.
- Due Analysis 2 mistake positions and due Academy reviews feeding the priority model.
- Prerequisite-aware recommendations so advanced weak skills do not displace reachable fundamentals.
- A Learn-page focus card with a single useful next action.
- A full skill-map dialog with mastery, evidence, confidence and due state.
- Skill evidence surfaced on each existing chapter tile.
- Guided Review prescriptions that identify which learning skills the current game's key moments implicate.
- Skill-specific one-click continuation into the existing course, Weakness Review, due mistake practice, or the Review Center when a strong skill still needs real-game transfer evidence.

## Evidence policy

v1.1 intentionally does **not** claim that finishing a chapter equals mastery. It also does not invent Elo-like learning ratings.

A chapter can establish up to 35% of a skill's mastery estimate. Independent evidence from clean practice, decision retries and mistake recall establishes the remaining portion. Assisted attempts count less. Repeated misses and newly reviewed mistakes lower the estimate and raise priority.

A high numerical estimate is not sufficient for the **Mastered** state. Mastery additionally requires enough clean evidence, at least two independent learning contexts, and positive transfer evidence from reviewed game decisions or recall of positions originating in the player's games. This prevents a burst of same-session repetition from being mislabeled as durable mastery.

Due review routing is skill-specific: a recommendation for Remote defense opens only due mistake cards mapped to that skill rather than every due card in the library.

The model is a product heuristic, not a psychometric certification. It is designed to make the existing learning systems coherent and actionable while keeping the underlying evidence inspectable.

## Data and privacy

No new cloud service or tracking endpoint is introduced. v1.1 reads existing local data:

- course reports exposed by the 14 chapter modules;
- `gomoku.studio.academy.v4` practice history;
- the private Analysis 2 mistake library.

It writes no separate learning database. Future account sync can therefore synchronize the existing source records and recompute mastery deterministically on every device.

## Release boundary

Development lives on `release/v1.1-learning-intelligence` until Gomoku 1.0 has passed P26/P27 and shipped. Merging v1.1 before that would invalidate the frozen 1.0 product candidate.

## Browser acceptance

The v1.1 workflow also runs the full application in Chromium. It verifies the 35-skill surface, direct skill actions, real chapter routing, live recomputation from a due Academy review, targeted Weakness Review launch, mobile layout, touch-target size and absence of page errors.
