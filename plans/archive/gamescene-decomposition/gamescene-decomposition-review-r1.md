I don't have access to the actual source files in this workspace (only Temp), so my review is based solely on the plan text and the domain context provided. Let me proceed with a thorough plan-level review.

---

## Concerns

**[MAJOR] Playwright regression snapshot is speculative and heavyweight for a solo dev**

(1) The plan proposes "snapshot a recorded playthrough (Playwright?) before each extraction step, replay after" as the primary regression mitigation. This is aspirational — no Playwright infra exists in the project today, and setting it up for a Phaser canvas game (where rendering is GPU-composited and frame-timing-sensitive) is non-trivial. Canvas content is not inspectable via standard DOM assertions; you'd need screenshot comparison or custom hooks into the Phaser loop.

(2) Without a concrete regression anchor, the "incremental, not big-bang" strategy is undermined — you have no way to verify each step is behaviour-preserving.

(3) **Suggested fix:** Replace Playwright aspiration with a lighter, more achievable strategy: (a) write a few integration-style tests *before* extraction that exercise the critical paths (drag a card, tap a stock, trigger hint) using a headless Phaser instance (`new Phaser.Game({ type: Phaser.HEADLESS })`) or simply by unit-testing the extracted state machines with mock pointer events. (b) For visual regression, a simple 30-second manual QA checklist (drag Ace to foundation, tap stock, trigger hint, auto-complete, undo, restart) performed after each PR is more realistic for a solo dev than standing up Playwright.

---

**[MAJOR] `boardRenderer` will remain tightly coupled to scene — extraction value is low**

(1) The plan lists `boardRenderer.ts` as "Phaser-rendering: paints cards/piles given layout + state" and acknowledges it's a "thin wrapper." A thin wrapper around Phaser `this.add.*` calls that still needs `this.scene` (or equivalent Phaser context) is not meaningfully extractable without passing the entire scene reference, at which point it's just a relocated method, not a decoupled module.

(2) It adds indirection without testability benefit (plan itself marks its test surface as "thin wrapper" — effectively untestable without Phaser).

(3) **Suggested fix:** Skip `boardRenderer` as a standalone module. Instead, have `GameScene` directly call boardLayout pure functions to compute positions, and keep the ~50-80 lines of Phaser rendering calls inline in the scene. This avoids a module that's just a passthrough. If rendering *logic* (not just calls) is non-trivial — e.g., animation sequencing, z-order management — extract *that* into a testable function, not the Phaser glue.

---

**[MAJOR] dragController / tapController boundary is underspecified — the real coupling risk**

(1) The plan acknowledges "Drag-and-drop fixes risk breaking tap-to-move and vice versa" but the proposed extraction puts them in separate modules without specifying how they share state or how conflicts are resolved. In most implementations, tap-to-move is essentially "detect a tap on a card, then programmatically execute the equivalent of a drag-to-target." This means `tapController` depends on `dragController`'s drop-validation and state-application logic — or both depend on a shared `moveValidator`.

(2) Without a clear contract (shared `MoveValidator`? `tapController` calls `dragController.performDrop()`?), you risk extracting two modules that still call back into each other or into the scene in tangled ways, defeating the purpose.

(3) **Suggested fix:** Before extracting either, define a `MoveExecutor` interface with methods like `canMove(card, target): boolean` and `applyMove(card, target): GameStateDelta`. Both `dragController` and `tapController` become consumers of `MoveExecutor`. This is the true decoupling seam — extracting drag/tap without extracting the shared move logic just relocates coupling.

---

**[MINOR] No mention of the `createCanvasAnchoredOverlay` / DOM overlay coordination**

(1) The plan lists "bottom action bar (DOM overlay) wiring" as one of GameScene's responsibilities but doesn't address it in the proposed split. Auto-complete uses a DOM overlay, pause/menu uses DOM overlays, and the bottom bar is DOM. These DOM<→Phaser sync points are a known source of bugs (position drift on resize, z-order conflicts).

(2) After extraction, GameScene will still own all overlay wiring. If overlay coordination isn't planned for extraction, at least call it out as an intentional non-goal so future reviewers don't wonder.

(3) **Suggested fix:** Add a one-line note: "DOM overlay coordination stays in GameScene — it's scene-lifecycle-coupled and not worth extracting."

---

**[MINOR] `gameEconomy.ts` wrapping SaveService adds a layer without clear benefit**

(1) The plan says `gameEconomy.ts` wraps SaveService for hint/undo/restart costs. But `SaveService.updateCurrentGame` is already a clean API. Wrapping it in `gameEconomy` creates a service-layer-sandwich: caller → gameEconomy → SaveService. If `gameEconomy` also handles coin deduction validation (can the player afford it?), then it has real logic worth testing. If it's just "subtract coins, call save," it's a passthrough.

(2) **Suggested fix:** Be explicit about what `gameEconomy` owns beyond delegation. If it owns coin-balance validation + deduction + save in one atomic operation, that's a good extraction. If it's 20 lines of `if (coins >= cost) { coins -= cost; save(); }`, it can stay inline.

---

**[MINOR] No interface/API contract definitions in the plan**

(1) For a decomposition plan, the most valuable artifact is the contract each extracted module exposes — constructor params, public methods, events/callbacks. The plan describes responsibilities at a paragraph level but not at an API level.

(2) Without contracts, the developer (you, 6 months from now) will re-derive the boundaries during implementation, possibly making different choices each time.

(3) **Suggested fix:** Add a brief API sketch for at least `dragController` and `tapController` (the riskiest extractions). E.g.:
```ts
class DragController {
  constructor(scene: Phaser.Scene, moveExecutor: MoveExecutor, onStateChange: (delta) => void);
  enable(): void;
  disable(): void;
}
```

---

**[MINOR] Migration order could be improved**

(1) The plan starts with `dragController` as step 1 because it's the "biggest win for testability." But it's also the most complex and coupled module — the riskiest first step. Starting with risk and no regression tooling is a recipe for a stalled migration.

(2) **Suggested fix:** Start with `boardLayout` (step 4 in current plan) — it's pure functions, trivially testable, zero regression risk, and immediately proves the extraction pattern works. Then do `hintController` (small, self-contained). Then `gameEconomy` (if it has real logic). Save `dragController` and `tapController` for last when you have confidence in the pattern and can define the shared `MoveExecutor` boundary cleanly. This is a classic "low-risk first" ordering.

---

**[MINOR] Trigger-based start risks indefinite deferral**

(1) The triggers are all reactive ("a bug report involves...", "major new gameplay feature", "test coverage push"). For a solo developer in post-release stabilisation, these triggers may never fire with enough urgency to justify the work. The plan is self-aware ("parked / not scheduled") but the triggers don't provide a forcing function.

(2) **Suggested fix:** Add one proactive trigger: "If GameScene exceeds 2000 lines or the next feature requires touching 3+ of the listed responsibility clusters in a single PR, extract before adding the feature." This is a concrete, measurable threshold.

---

## Alternative approaches

### Alternative 1: Extract a `MoveEngine` instead of separate drag/tap controllers

**Rationale:** The plan's biggest risk is the drag↔tap coupling. Instead of extracting two input controllers that share implicit state, extract the *output* side — the move validation and execution logic — into a single `MoveEngine`. Drag and tap become thin input adapters that translate pointer events into `MoveEngine.execute(card, target)` calls. This is a smaller extraction (fewer files, fewer seams) but addresses the actual coupling point.

**Trade-off:** Less separation of input concerns (drag and tap stay in GameScene), but the *testable* part (move logic) is cleanly isolated. If tap-to-move grows complex enough to warrant its own module later, it can be extracted as a consumer of MoveEngine.

### Alternative 2: Use the Strangler Fig pattern with an event bus

**Rationale:** Instead of refactoring GameScene directly, introduce a lightweight `GameEventBus` (even a typed `EventEmitter`). Have GameScene emit events like `card:pointerdown`, `card:dropped`, `hint:requested`, `game:won`. New controllers subscribe to these events and own their logic. GameScene code is gradually removed as controllers take over, with the event bus as the stable contract.

**Trade-off:** Adds a pub/sub layer that can make control flow harder to trace. But for a solo developer who wants incremental decomposition without modifying existing call chains, it's a low-friction migration path. Events also naturally solve the drag↔tap shared-state problem — both emit `move:requested` and a shared handler validates/executes.

---

CONCERNS REMAIN
