Let me carefully compare the revised plan against all prior concerns and look for new gaps.

---

## Prior Concerns — Status

| # | Prior concern | Status |
|---|---|---|
| 1 | Playwright aspiration is speculative/heavyweight | **Closed.** Replaced with two-track strategy: pre-extraction unit tests + post-extraction manual QA checklist. Concrete and realistic. |
| 2 | `boardRenderer` extraction value is low | **Closed.** Explicitly dropped; rendering calls stay inline. |
| 3 | drag↔tap boundary underspecified | **Closed.** `MoveExecutor` seam introduced with typed interface; both controllers become consumers. |
| 4 | No mention of DOM overlay coordination | **Closed.** Explicitly called out in Non-goals as staying in GameScene. |
| 5 | `gameEconomy` is a passthrough | **Closed.** Now owns atomic balance-check + deduct + persist with a return value (`ok/reason`), which is real logic. |
| 6 | No API contract definitions | **Closed.** API sketch section with typed interfaces added. |
| 7 | Migration order starts with riskiest step | **Closed.** Reordered: `boardLayout` → `hintController` → `gameEconomy` → `autoComplete` → `MoveExecutor` → `drag+tap`. Low-risk first. |
| 8 | Trigger-based start risks indefinite deferral | **Closed.** Proactive trigger added (line count >2000 or 3+ clusters touched in one PR). |

All eight prior concerns are addressed. Good revision.

---

## New Concerns Introduced

**[MAJOR] `MoveExecutor.applyMove` returns `GameState` — implies immutable state model, but existing code almost certainly mutates in place**

(1) The contract says `applyMove(state, card, target): GameState`. This is either an immutable-return pattern (returns a new object) or a lie (returns the same mutated reference). The existing GameScene code almost certainly mutates a single state object in place — that's standard for Phaser game scenes. If MoveExecutor must return immutable state, that's a foundational change to the entire state management model, far beyond what this plan scopes. If it mutates and returns `this`, the `GameState` return type is misleading and callers won't know whether to use the return value or the original reference.

(2) This ambiguity will surface at step 5 (MoveExecutor extraction) and could stall the entire migration if the team (you) discovers the state model needs rearchitecting first.

(3) **Suggested fix:** Make the contract explicit. If mutation-based: `applyMove(state, card, target): void` (mutates in place) or `applyMove(state, card, target): GameStateDelta` (returns a description of what changed, applied by the caller). If immutable: call out that this plan *depends on* a state-immutability refactor as a prerequisite. Don't leave it ambiguous.

---

**[MAJOR] State→visuals pipeline is unaccounted for — who updates Phaser sprites after `MoveExecutor.applyMove`?**

(1) After a move is validated and applied (state updated), someone must: move card sprites to new positions, trigger flip animations, update z-order, cascade auto-flip for face-down tableau cards, update score display, trigger sound effects, handle win detection. This "apply to visuals" pipeline is the actual hard part of the extraction, and neither `MoveExecutor` nor `DragController`/`TapController` contracts address it.

(2) Currently this is all inline in GameScene's drop handler. After extraction, if `DragController` calls `moveExecutor.applyMove()` and then... what? Does it call back into GameScene via `onMoveApplied(newState)` and GameScene re-renders everything from state? Or does the controller know about sprites? This is the core architectural question that determines whether the extraction actually decouples anything.

(3) **Suggested fix:** Add a `BoardView` (or `Renderer`) contract to the plan — even if it stays inline in GameScene initially. E.g.:
```ts
interface BoardView {
  applyStateDelta(delta: GameStateDelta): void; // animate cards to new positions
}
```
Then `onMoveApplied` in DragController/TapController triggers the view update. Without this, the contract sketches are incomplete — they describe input→validation but not validation→output.

---

**[MAJOR] Step 5 (MoveExecutor extraction) is a hidden-risk step that touches the most coupled code**

(1) The plan says step 5 is "refactoring-in-place, not an extraction" — drag and tap stay in GameScene but redirect through `moveExecutor.canMove/applyMove`. This means step 5 requires modifying the drag-drop pipeline and the tap-to-move pipeline *in the same file* to call a new interface. These are precisely the lines of code the plan identifies as the highest coupling risk.

(2) If step 5 introduces a regression (e.g., a subtle ordering change in how validation interacts with state updates), it will be hard to spot because both pipelines changed simultaneously in a single 1800-line file. The "low-risk-first" ordering philosophy doesn't apply to step 5 — it's medium-to-high risk positioned in the middle.

(3) **Suggested fix:** Acknowledge step 5's risk explicitly. Consider splitting it: 5a = extract `MoveExecutor` with tests, but only wire it into *one* pipeline (drag first, tap stays as-is). 5b = wire tap through `MoveExecutor`. Two smaller PRs, each easier to verify.

---

**[MINOR] Extracting drag+tap together in step 6 contradicts the decoupling premise**

(1) The whole point of `MoveExecutor` is to decouple drag from tap. But step 6 extracts them as a single coordinated PR. If they're truly decoupled by MoveExecutor, they should be extractable independently. If they can't be extracted independently even with MoveExecutor, the seam isn't complete.

(2) Extracting two modules in one PR doubles the review surface and makes revert coarser. It also suggests there's residual coupling beyond MoveExecutor that hasn't been identified.

(3) **Suggested fix:** After step 5, attempt to extract `tapController` alone first (it's simpler, fewer lines). Then extract `dragController`. If they truly share no state beyond MoveExecutor, this works. If it doesn't work, the failure tells you exactly what additional seam is needed.

---

**[MINOR] Manual QA checklist doesn't cover all extracted modules**

(1) The checklist is: "drag a card to foundation; tap stock; trigger hint; trigger auto-complete; undo last move; restart deal." Missing: drag between tableau piles, tap-to-move between tableau piles, coin balance after hint/undo/restart (gameEconomy), invalid move rejection (drag back to origin), ghost-click guard (tap double-fire).

(2) A checklist that doesn't exercise `gameEconomy` or tableau↔tableau tap misses the two most common real-world interactions.

(3) **Suggested fix:** Expand to ~10 items covering each module's happy path and one edge case. Still under 60 seconds of manual QA.

---

**[MINOR] `gameEconomy` API — `apply: () => void` makes it a generic guard, not domain-aware**

(1) The sketch shows `chargeAndApply(save, cost, apply)` where `apply` is an opaque callback. This means gameEconomy doesn't know whether it's paying for a hint, an undo, or a restart — it's just "check balance, deduct, call callback." At ~10 lines, is this worth a separate module?

(2) The plan previously justified extraction as "single place for hint/undo/restart cost handling." If it doesn't handle the *domain* of those actions, only the *billing*, it's a thin utility function, not a controller. Could be a single exported function in a `utils/economy.ts` rather than a named module at the controller level.

(3) **Suggested fix:** Either (a) acknowledge it's a small utility and name it accordingly (`src/features/board/utils/charge.ts`), or (b) give it domain awareness (it knows about hint cost constants, undo cost, etc.) so it earns its module status. Either is fine — just be intentional.

---

## Alternative Approaches

No new alternatives proposed — the revised plan's `MoveExecutor` seam addresses the main architectural concern from round 1. The two alternative approaches from round 1 (event bus / MoveEngine) are now subsumed by the MoveExecutor contract. The plan is converging well; the remaining issues are about contract completeness and risk acknowledgment, not fundamental direction.

---

CONCERNS REMAIN
