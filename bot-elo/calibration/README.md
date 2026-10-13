# Gomoku Bot Elo — E3 calibration pipeline

**Source implementation only. No calibration matches have been run. None of the provisional E1 numeric targets is measured, calibrated, or published.**

## Source-of-truth boundaries

- \`../rating.js\`: canonical eight native bot IDs and E1 **uncalibrated design targets** (not measurements).
- \`e2-policy.mjs\`: one immutable policy contract used by both \`gomoku-room/bot-matches.ts\` and the E3 runner. It pins exact E2 native search options, search budget cap, seed calculation, normal balanced personality, and rule variant.
- \`../../supabase/functions/gomoku-room/native-bot-engine.js\`: byte-for-byte mirror of the existing Studio search kernel. \`bot-elo/extract-native-engine.py\` is its only maintenance path; E3 does not fork a search algorithm.
- \`run-tournament.mjs\`: manually executable, source-fingerprinted, resumable all-pairs tournament; 8 real bot levels, 28 unordered pairings, original rules legality, original E2 engine decisions, varied legal center-first opening prefixes and equal Black/White assignments. \`--openings 16\` schedules **896** games. The default processes up to 8 and may resume.
- \`analyze.mjs\`: rejects missing/inconsistent evidence, source/hash changes, duplicate game IDs, invalid move transcripts and unscheduled opponents. Fits regularized relative Bradley–Terry ratings with a shared color advantage, resampling *paired opening groups* for confidence estimates. Draws count as half a point.
- \`assignments.mjs\`: explicit, human-reviewed, versioned proposal export only. It refuses low-coverage/imbalanced/wide-interval evidence, and cannot activate ratings, replace E1 targets, write databases or issue Elo.

## Manual offline workflow (not executed in this phase)

These are source usage examples only. They do not run automatically, and no tests, CI, build, deployment or paid services are part of E3.

\`\`\`sh
# Produce real games incrementally. Repeat the same command to resume.
node bot-elo/calibration/run-tournament.mjs --openings 16 --max-games 8 \
  --out bot-elo/calibration/local-evidence/games.jsonl

# After gathering games, produce a provisional evidence report.
node bot-elo/calibration/analyze.mjs --in bot-elo/calibration/local-evidence/games.jsonl \
  --openings 16 --out bot-elo/calibration/local-evidence/report.json

# Only after ALL source-matched games and independent human review:
node bot-elo/calibration/assignments.mjs \
  --evidence bot-elo/calibration/local-evidence/games.jsonl \
  --out bot-elo/calibration/local-evidence/reviewed-v1.json \
  --openings 16 --release e3-reviewed-01 \
  --reviewer "Reviewer Name" \
  --review-note "Actual evidence-based evaluation of opponent diversity, Black/White balance, opening-policy fit and numerical uncertainty." \
  --approve-reviewed --accept-relative-anchor
\`\`\`

To produce a readable Markdown interpretation from the empirical report:

\`\`\`sh
node bot-elo/calibration/render-report.mjs \
  bot-elo/calibration/local-evidence/report.json \
  bot-elo/calibration/local-evidence/report.md
\`\`\`

The report preserves raw observed wins/draws/losses, color-specific scores and opening-family breakdowns. Its \`review-candidate\` status does not mean a bot's Elo has been published.

The final example is deliberately an approval gate and **will refuse** release unless its evidence meets thresholds. It is not a command that has been executed, and the sample review note is not an actual endorsement.

## Method and uncertainties

Games are paired by the same legal center-first opening, assigned bot pair and seed, then run in both color assignments. The original search API uses a *wall-clock budget*: a schedule/seed can be regenerated, but a native move chosen on different hardware or under different runtime load **may not match**. Only recorded transcripts are exactly replayable. Provenance hashes of the native engine, rules, policy, registry and runner invalidate evidence after any relevant source change.

The fitting equation is:

\`\`\`
P(Black scores) = 1 / (1 + 10 ^ (-(R_black - R_white + colorAdvantage)/400))
\`\`\`

Black/White assignment is not conflated with skill. \`mid\` is fixed at **1400 solely as an arbitrary scale anchor**; it is not a human-rated anchor. All other bot differences and shared Black advantage are estimated. The model uses zero-centered priors on relative differences and color advantage, plus paired bootstrap confidence intervals and approximate information-matrix intervals. Treat confidence intervals as **model-dependent**, not formal guarantees of strength.

The E3 report only marks \`review-candidate\` after at least 80 usable games per bot, at least 25 per color, three distinct opponents, 24 distinct matched opening groups and a 95% interval width no larger than 360 Elo. **Every bot** must meet this, all scheduled games must be complete, and an independent human reviewer must explicitly approve the release before an assignment can claim \`reviewed-calibrated\`. Calibration proposals remain \`ratedEnabled:false\` even after approval.

## Known limitations and future requirements

1. Balanced artificial opening templates are not an empirical model of real humans' opening distribution. Additional authentic human-versus-bot games or a well-defined ranked opening policy are needed before official bot Elo.
2. Pairwise bot-vs-bot comparisons determine only *relative* strength. The 1400 anchor is arbitrary; no FIDE/human Elo comparability is claimed.
3. Source-hash and transcript validation catches inconsistent files and invalid sequences; it does **not** independently prove each time-budgeted search move or prevent tampering with locally generated evidence.
4. No results are fabricated or baked into this source. No sample data exists in the repo.
5. A reviewed calibration manifest **does not modify the E1 public registry** automatically. Applying E3 calibration to live Bot Elo requires a separately approved E4 integration and trusted account-owned settlement.
6. E2 native engine/search options may vary from local AI personalities and search budgets. E3 measures the *exact E2 server policy*, not the full local humanized difficulty.

**NOT_TESTED** — calibration commands, games, numerical fits, and approval gates have not been executed in E3 at the user's request.
