# Bot Elo E1 — preview-only source

- `rating.js`: versioned pure numerical model and eight native bot identities.
- `preview.js`: native new-game, sidebar, and competitive-setup previews. No account updates or result capture.
- `embed.py`: embeds these modules inside the existing self-contained `index.html`.

All eight target ratings (500–2600) are **unmeasured and provisional**. Placement is modeled as the first 10 games, provisional K=40 through game 19, K=24 for games 20–99, and K=16 thereafter. Score is expected-logistic with 400-point scale, 0.001 precision and pre-match anti-farming ceiling checks. The rating preview is **not an operational ranked mode**. The real native bot engine, online PvP rating, THIEPN Account and existing autosave remain untouched.

E2: verify reproducible server-side bot behavior. E3: calibrate target ratings with varied openings and colors. E4: add trusted idempotent persistence isolated from human PvP. No tests, builds, CI, migrations or deployments run in E1 (NOT_TESTED).
