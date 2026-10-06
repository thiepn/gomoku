# Gomoku 1.5 — Post-Game Experience 2.0

This release improves the handoff from a finished game into the existing Guided Review and training systems. It deliberately does **not** create another review engine, another analysis surface, or a new scoring metric.

## What changes

- the result dialog gains one concise next-step panel
- redundant `Analyze decisions` / `Review & improve` result-modal choices are visually collapsed into the existing Guided Review entry
- the recommended action adapts to current review evidence:
  - no review yet → **Review key moments**
  - partial review → **Continue review**
  - key moments already found → **Review key moments**
  - completed review with no actionable mistake established → **Play another**
- existing rematch and final-board access stay available
- existing Guided Review remains the single authoritative review workspace

## Evidence language

The post-game layer does not invent an accuracy score. It reports only concrete existing review evidence: decisions checked, key moments available, or completed review state.

## Preservation boundary

No changes to:

- Gomoku / Renju rules
- AI search, calibration or personalities
- review analysis semantics
- training evidence
- multiplayer / ranked protocol
- saved-game formats
- board renderer
- existing visual palette or navigation

## Accessibility

No additional interactive controls are introduced. Existing buttons keep their keyboard semantics and mobile target sizing. Reduced-motion behavior remains unchanged.
