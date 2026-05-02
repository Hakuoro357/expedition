All six prior concerns are closed. The revisions are responsive and substantive — immutable-state prerequisite, `OnMoveApplied` callback, split steps 5a/5b and 6a/6b, expanded QA checklist, domain-aware economy. Good iteration.

---

## New Concerns Introduced

**[MINOR] Prior-concern-not-closed: "NO controller touches sprites" claim contradicts dragController's described responsibility**

(1) The API section states: *"NO controller touches sprites or save directly — they only produce new state and emit it."* But `dragController.ts`'s described responsibility is *"Pointer pipeline: down → preview → drop."* Drag preview inherently requires following the pointer with a sprite, hit-testing drop zones against pile positions, and animating invalid drops back to origin. This is sprite manipulation. The claim is aspirationally inaccurate.

(2) More importantly, this isn't just a wording issue — it's a design ambiguity. The plan doesn't specify whether the drag visual feedback (ghost cards following cursor) lives in `DragController` or stays in `GameScene`. If in the controller, the controller is heavily Phaser-coupled and the claim is wrong. If in `GameScene`, the controller is lighter but GameScene retains more lines. Either way, the plan should be explicit.

(3) **Suggested fix:** Adjust the claim and add a brief note to step 6b: *"DragController's pointer→card and pointer→pile hit-testing plus drag-preview sprite tracking are Phaser glue. On extraction, separate the deterministic 'which card, which target' resolution into a pure `resolveDragTarget(pointer, sprites, piles) → { card, target }` helper function — guaranteed for drag, not conditional. The Phaser glue (sprite follow, snap-back animation) stays in the controller class."* This makes the pure-helper extraction a planned step, not a fallback.

---

**[MINOR] New-concern-introduced: Auto-complete's interaction with `onMoveApplied` is unspecified**

(1) `autoCompleteController` performs sequential moves (each calls `moveExecutor.applyMove` → triggers `onMoveApplied`). Each callback invocation presumably triggers `renderBoard()` + save. But auto-complete might want to: (a) animate each move with a delay, (b) only persist the final state, (c) suppress intermediate win-detection until all moves complete. The plan doesn't specify whether `onMoveApplied` handles all of this or whether auto-complete needs a different callback variant.

(2) This could surface as a subtle bug: GameScene's `onMoveApplied` calls `save.updateCurrentGame(newState)` after every move, causing 5-6 rapid cloud-sync calls during auto-complete. Or win-detection fires on the first foundation move before the board is fully cleared.

(3) **Suggested fix:** Add one sentence to the `OnMoveApplied` contract: *"Auto-complete calls `onMoveApplied` per step for rendering; GameScene's callback accepts an optional `{ animate: boolean, persist: boolean }` options bag (default `{ true, true }`) so auto-complete can suppress intermediate persistence and win-detection."* Alternatively, auto-complete could use a different callback — but the options-bag is simpler.

---

## Verdict

Both remaining issues are MINOR polish with concrete fixes. The plan has closed all prior MAJOR/CRITICAL concerns, the architecture is sound, the migration path is careful, and the verification strategy is pragmatic for a solo developer. The core seam (`MoveExecutor`) is well-designed and the split-step ordering reflects real risk management.

**NO SIGNIFICANT CONCERNS**
