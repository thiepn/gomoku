# Gomoku 1.8 — Opening Study & Repertoire 2.0

v1.8 gives the existing opening tools one coherent entry point. It does not create a new opening book, theory database, protocol engine, or repertoire store.

## Product goal

Gomoku already has four mature opening capabilities, but they are reached separately:

- Opening Lab for Swap2 / Taraguchi-10 / Soosõrv-8 / RIF procedures and local-library continuation evidence
- source-based Opening database for imported/local game records
- Repertoire rehearsal for branches explicitly stored in the current study
- Chapter 11 + Learning Intelligence evidence for opening shape and flexibility

Opening Study & Repertoire 2.0 composes those systems instead of replacing them.

## What changes

Whenever Opening Lab is opened, a compact Opening Study home appears above the existing laboratory.

It shows:

- current ruleset and move number
- current opening-skill evidence from v1.1 Learning Intelligence
- one context-aware next action
- direct routes to Opening Lab, Source database, Repertoire, and Opening concepts
- direct access to the existing Learning Intelligence skill map

## Recommendation rules

- an ordinary early-game position already on the board → explore matching continuations first
- no meaningful opening-learning evidence yet → build the Chapter 11 concepts first
- weak opening evidence → revisit the Chapter 11 concepts
- otherwise → rehearse the repertoire already stored in the current study

These recommendations are navigation only. They do not claim that a move, line, frequency, or observed result is theoretically best.

## Evidence boundary

Continuation frequencies and results remain evidence from the user's local Library or imported source corpus. Repertoire rehearsal continues to test only explicitly stored study branches. The existing application remains authoritative for protocol legality, symmetry handling, source indexing, game validation, review scheduling, and chapter/skill evidence.

## Preservation boundary

No changes to:

- Gomoku / Renju legality
- Swap2, Taraguchi-10, Soosõrv-8 or RIF procedures
- Opening database import/index/query semantics
- repertoire cards or spaced-repetition scheduling
- saved game, study, database, or backup formats
- AI search or analysis
- Learning Intelligence scoring
- Course 2.0 content
- online / ranked / tournament systems
- post-game or competitive-series behavior

No new storage key, network request, third-party opening corpus, or engine dependency is introduced.
