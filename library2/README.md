# Gomoku 1.9 — Library & Archive 2.0

v1.9 turns the existing local Library into a coherent archive and review handoff without replacing its storage, filtering, import/export, or Review Center systems.

## Product goal

The Library is already a primary navigation destination, but the mature capabilities behind it are fragmented:

- transactional IndexedDB / compatibility localStorage storage
- saved games and studies
- folders, tags and search grammar
- result / rules filters
- Review Center freshness and key-moment digests
- statistics
- full backup / restore
- JSON / SGF import and export

Library & Archive 2.0 composes those systems into one clear archive surface.

## What changes

The Library receives a compact archive home with:

- saved-entry count and storage capacity
- study count
- games needing a current review
- current reviewed games with flagged key moments
- one context-aware next action
- first-class search, rules and result filters that proxy the existing authoritative filters
- direct routes to Review Center, Statistics, Backup and Import

## Recommendation rules

- empty Library + active board → save the current game/study
- empty Library + empty board → play a game
- stale or incomplete review evidence → open Review Center
- current reviewed game with flagged decisions → reopen its strongest available key moment
- otherwise → reopen the most recent saved entry

Review digests are computed from the existing Review Center API. V1.9 does not create a second review status model.

## Performance

Review status is scanned in bounded asynchronous chunks when the Library revision changes. Rendering the Library itself never loops synchronously through all 2,000 possible entries.

## Preservation boundary

No changes to:

- Library database schema, limits, transactions or conflict handling
- saved game / study formats
- folder or tag semantics
- search grammar
- result or rules filtering
- Review Center analysis/freshness semantics
- backup / restore payloads
- JSON / SGF import or export
- AI, rules, analysis, learning, course, opening or online systems

No new persistence key, network dependency, cloud storage or duplicate archive database is introduced.
