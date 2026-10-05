# Gomoku 1.2 — Course 2.0

v1.2 upgrades the existing 14-chapter Gomoku course without replacing its authored task corpus.

## Product changes

- **Guided Journey** above the full chapter library. It recommends a chapter while every chapter remains directly accessible.
- Four chapter states: **Learn → Practice → Verify → Mastered**.
- Checkpoints combine existing course completion with v1.1 Learning Intelligence evidence.
- **42 animated teaching scenes**: three per chapter, rendered with board choreography, threat/scan lines and highlighted decision points.
- A short **transfer check** for every chapter. These checks test the principle in different wording but do not pretend to be real-game transfer evidence.
- Existing chapter dialogs receive a compact mastery strip with course %, skill evidence, clean evidence, real-game transfer evidence and direct access to the animated concept.
- Reduced-motion support disables animation while preserving all teaching content.
- The original 655-task course remains the authoritative practice corpus and full Library view.

## Mastery policy

Course 2.0 does not make chapter completion synonymous with mastery.

- **Learn**: course exposure is incomplete.
- **Practice**: enough course exposure exists, but clean mixed retrieval still needs work.
- **Verify**: study evidence is strong, but v1.1 still lacks adequate real-game transfer.
- **Mastered**: course exposure, clean retrieval, skill score, and game-derived transfer all have supporting evidence.

The transfer check inside the animated concept is deliberately *not* counted as real-game transfer. It is only a comprehension check.

## Architecture

Course 2.0 is additive:

- `course2/core.js` — pure chapter/journey/checkpoint/demo model.
- `course2/runtime.js` — integration with Learn and the existing chapter dialogs.
- `course2/course2.css` — journey, checkpoint and concept-studio presentation.
- `course2/build.py` — idempotent embedding into the portable single-file app.

It consumes the public v1.1 `GomokuLearningV11` snapshot and the existing `GomokuCourseChapter1…14` reports. It introduces no server, tracking endpoint, LLM dependency, or duplicate course database.

## Release boundary

v1.2 is stacked on `release/v1.1-learning-intelligence`. It must not merge to production before v1.1 itself is qualified and merged after the protected 1.0 release boundary.
