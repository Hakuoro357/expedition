# Decision log — round 1

Reviewer: qwen (mimo-v2.5-pro). Verdict: CONCERNS REMAIN. 8 concerns: 3 MAJOR + 5 MINOR.

## [MAJOR] Playwright regression snapshot speculative — ACCEPTED
Replacing Playwright aspiration with two-track concrete strategy: (a) controller-level
unit tests written *before* each extraction (mock pointer events into pure state
machines), (b) short manual-QA checklist (drag-to-foundation, tap-stock, hint,
auto-complete, undo, restart) run after each PR. Avoids standing up canvas
screenshot infra a solo dev won't maintain.

## [MAJOR] boardRenderer is a passthrough — ACCEPTED
Dropping `boardRenderer.ts` from the split. The testable seam is `boardLayout`
(pure position math). The Phaser `this.add.*` calls stay inline in GameScene —
extracting them only relocates coupling without test value. boardRenderer
disappears from the module table.

## [MAJOR] drag↔tap shared state — ACCEPTED (most important fix)
Introducing `MoveExecutor` as the central seam *before* extracting drag/tap
controllers. Both become thin input adapters consuming `MoveExecutor.canMove()`
and `MoveExecutor.applyMove()`. This is the real decoupling point — without it,
drag/tap extraction just relocates coupling. Adding to the migration ordering as
the prerequisite to drag/tap extraction.

## [MINOR] DOM overlay coordination silent — ACCEPTED
Adding a one-line non-goal: overlay coordination stays in GameScene because
it's tied to scene lifecycle (create/SHUTDOWN, resize handler).

## [MINOR] gameEconomy is passthrough? — ACCEPTED (clarification)
Clarifying that `gameEconomy` owns the *atomic* "validate balance → deduct →
persist" trio in one place. Without it the same triple is spread across
GameScene action handlers (hint, undo, restart). That's the real test target.

## [MINOR] No API contracts — ACCEPTED
Adding brief TS-sketch contracts for `MoveExecutor`, `DragController`,
`TapController`, `HintController` so the future-me has unambiguous boundaries.

## [MINOR] Migration order — ACCEPTED
Re-ordering: start with boardLayout (pure, zero-risk, validates pattern), then
hintController (small, self-contained), then gameEconomy (if logic is real),
then autoCompleteController. Final cluster: MoveExecutor + dragController +
tapController extracted together as a single coordinated change. Drag/tap was
listed first in r1 — moving to last is the bigger correction here.

## [MINOR] Trigger-based deferral — ACCEPTED
Adding proactive threshold trigger: "if GameScene crosses 2000 lines OR a
feature requires touching 3+ responsibility clusters in one PR, extract before
shipping the feature."
