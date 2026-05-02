# Decision log — round 2

Reviewer: qwen. Verdict: CONCERNS REMAIN. Prior 8 closed. 6 new: 3 MAJOR + 3 MINOR.

## [MAJOR] applyMove return type ambiguity — ACCEPTED
Committing to immutable contract: `applyMove(state, card, target): GameState`
returns a new state object. Prerequisite: `core/klondike/engine.ts` is already
pure (engineMoves.test.ts confirms). Calling out in the plan that this depends
on engine purity, and that GameScene's existing `applyState(newState)` callback
already replaces in-memory state — so the model is consistent.

## [MAJOR] State→visuals pipeline missing — ACCEPTED
The crucial "what runs after applyMove" wasn't specified. Resolution: GameScene
provides an `onMoveApplied(newState)` callback that controllers invoke. That
callback drives existing `renderBoard()` + animations + `save.updateCurrentGame`
+ win-detection — all stays in GameScene. Adding this to the contracts so the
input→validation→output pipeline is end-to-end explicit. No separate `BoardView`
abstraction (overengineering for solo project) — just the callback hook.

## [MAJOR] Step 5 is risky in the middle — ACCEPTED
Splitting step 5 into 5a (MoveExecutor extracted with tests, wired into drag
pipeline only) and 5b (tap pipeline rewired through MoveExecutor). Each step
is a single small PR with controlled blast radius.

## [MINOR] Step 6 extracts drag+tap together — ACCEPTED
Splitting step 6 into 6a (tapController extracted alone — simpler, fewer
lines, validates seam) and 6b (dragController extracted). If 6a fails, the
failure exposes residual coupling we didn't see. Better signal than a coupled
mega-PR.

## [MINOR] Manual QA checklist incomplete — ACCEPTED
Expanding from 6 to 10 items: drag-to-foundation, drag-tableau-to-tableau,
tap-stock, tap-to-tableau, hint, auto-complete, undo, restart, coin-balance
after hint, invalid-move rejection. Still ≤ 60 sec.

## [MINOR] gameEconomy is generic guard — ACCEPTED
Giving it domain awareness: exporting named functions `chargeForHint(save)`,
`chargeForUndo(save)`, `chargeForRestart(save)` that own their cost constants
internally. Earns its module status; callers no longer pass cost numbers.
