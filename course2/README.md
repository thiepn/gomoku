# Gomoku 1.2 — Course 2.0

v1.2 upgrades the existing 14-chapter / 655-task course without replacing it.

## Product goal

The original course remains the complete structured curriculum. Course 2.0 adds a shared teaching layer so important patterns are not explained only with static text.

Every chapter receives:

- a short animated board walkthrough;
- step-by-step coach copy;
- a transfer check using a different position;
- first-try / assisted / retry evidence;
- direct integration with v1.1 Learning Intelligence.

The full course stays open. Transfer checks do not lock later chapters and are not required to browse any content.

## Learning loop

Course 2.0 follows:

**See → explain → retrieve → transfer**

A learner first watches a concept change on the board, then solves a related position that is deliberately not identical to the demonstration.

Clean transfer evidence is weighted more strongly than course exposure. Assisted solves still count, but contribute less. Failed attempts remain useful evidence and raise future practice priority.

## Animation policy

Motion is instructional rather than decorative:

- new stones enter with a short placement motion;
- important points pulse;
- threat/connection lines trace in teaching order;
- autoplay advances one conceptual frame at a time;
- reduced-motion preferences disable nonessential animation while preserving every explanation.

## Data

Transfer evidence is stored locally under gomoku.course2.transfer.v1.

The record is append-only at the attempt level (bounded to the latest 400 attempts). v1.1 reads these events and recomputes mastery deterministically.

No analytics endpoint, LLM API, or new cloud service is introduced.

## Release dependency

release/v1.2-course-2 is stacked on release/v1.1-learning-intelligence.

v1.2 should not be merged independently ahead of v1.1. Once v1.1 is released, this branch can be rebased/retargeted onto the then-current main and qualified as the next product release.
