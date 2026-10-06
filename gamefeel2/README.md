# Gomoku 1.4 — Game Feel 2.0

This release improves the tactile and visual response of the existing product without redesigning its established UI, colors, board material, navigation, or information architecture.

## Interaction improvements

- layered move impact feedback on top of the existing stone drop/ripple
- differentiated human/engine impact intensity
- compact board pulse and move-count motion
- active-player handoff state on the existing player cards
- thinking-state player treatment that complements the existing thinking pill
- tactile board-point press feedback
- undo/redo directional feedback
- new-game/rematch board reset transition
- subtle toast motion for important feedback

## Result choreography

- short board-centered result banner before the existing modal
- user-aware result copy (You win only when the human actually won)
- winning-stone highlight sequence
- restrained, board-contained celebration flecks for human wins only
- no celebratory burst on losses or draws
- existing result dialog gains compact reason/move/side metadata
- existing rematch/review workflow stays unchanged

## Audio and haptics

The existing stone, illegal-move and result sounds remain authoritative. Game Feel 2.0 adds only tiny undo/redo/reset tones so sounds do not double-fire. Haptics remain optional and tied to the existing sound/haptics preference.

## Accessibility / performance

- all new visual effects are pointer-transparent
- no new interactive target is introduced
- prefers-reduced-motion disables impact, win-point and celebration motion
- reduced-motion still communicates the result textually
- effects are short-lived DOM nodes with bounded counts; there is no continuous animation loop
- no network, canvas worker, image asset, or external animation dependency

## Boundaries

Game Feel 2.0 does not modify rules, AI search, game records, course data, learning evidence, multiplayer protocol, or the core stone renderer. The existing visual system is preserved rather than replaced.
