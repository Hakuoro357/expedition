# GameScene decomposition (techdebt)

**Status:** parked / not scheduled. Recorded 2026-05-02 after Qwen project review.
Round 3 revision: explicit immutable contract, end-to-end input→validation→output
pipeline, split high-risk steps, expanded QA checklist, domain-aware gameEconomy.

**Priority:** medium — recognised debt, not blocking release; revisit when next major
gameplay feature lands or when a regression in GameScene becomes hard to localise.

## Problem

`src/scenes/GameScene.ts` ≈ 1850+ lines and growing. It owns:

- Phaser scene lifecycle (`create` / `SHUTDOWN`)
- Board layout & rendering for tableau/foundations/stock/waste
- Drag-and-drop pipeline (pointerdown → preview cards → drop validation → applyState)
- Tap-to-move detection (`installTapDetection`, `tapCandidate`, ghost-click guard)
- Hint system (`hintHighlightTimer`, `shownHintKeys`, blink animation)
- Auto-complete flow (DOM overlay + sequential moves + win detection)
- Coin economy actions (hint cost, undo cost, restart cost)
- Pause/menu navigation, dev-preview screens
- Save persistence on every applyState (now via SaveService.updateCurrentGame)
- Bottom action bar (DOM overlay) wiring
- Game-end flow (won → RewardScene, lost → no-moves modal)

Symptoms of monolith:
- Hard to write unit tests — every new behaviour requires mocking Phaser
- Drag-and-drop fixes risk breaking tap-to-move and vice versa
- 5 elements still rendered on Phaser Canvas instead of DOM (text smoothing
  inconsistencies on mobile)

## Prerequisite

The `MoveExecutor` seam below assumes **immutable state semantics**:
`applyMove(state, ...)` returns a new `GameState` object, never mutates the
input. This is consistent with how `core/klondike/engine.ts` already works
(verified by `engineMoves.test.ts` calling pure functions and asserting on
returned states) and with how GameScene's existing `applyState(newState)`
callback already replaces the in-memory state via
`SaveService.updateCurrentGame(newState)`. **If a future audit shows hidden
mutation in any path, that audit must complete before step 5.**

## Proposed split

Aim: keep `GameScene` as **scene shell** (lifecycle + sub-coordinator), extract
behaviour clusters into pure modules under `src/features/board/`. The central
seam is `MoveExecutor` — it owns the canonical "can this move happen / apply
this move" pair that drag and tap both call into. Without this seam, drag and
tap remain coupled through scene state regardless of which file holds them.

| Module | Responsibility | Test surface |
|---|---|---|
| `boardLayout.ts` | Pure: card positions, fanning gaps, hit areas. | snapshot tests |
| `MoveExecutor.ts` | Pure: `canMove(state, card, target)` + `applyMove(state, card, target) → newState` (immutable). Wraps engine logic. | unit tests, every existing engineMoves test redirected through it |
| `dragController.ts` | Pointer pipeline: down → preview → drop. Calls `MoveExecutor`, then `onMoveApplied`. | unit tests with mock pointers |
| `tapController.ts` | Tap state machine + ghost-click guard. Calls `MoveExecutor`, then `onMoveApplied`. | unit tests with mock pointers |
| `hintController.ts` | Compute hint highlight, manage timers, sound feedback. | unit tests |
| `autoCompleteController.ts` | Win-detection + sequential auto-foundation animation. | unit tests |
| `gameEconomy.ts` | Domain-aware cost handlers `chargeForHint(save)`, `chargeForUndo(save)`, `chargeForRestart(save)`. Each owns its cost constant and the atomic balance-check + deduct + persist. | unit tests |
| `GameScene.ts` (after) | Wires the controllers, owns scene lifecycle, scene transitions, owns DOM overlay coordination, owns the `onMoveApplied` callback that drives `renderBoard()` + animations + save + win-detection. | integration test only |

`boardRenderer` was considered but dropped — a wrapper around `this.add.*` calls
still needs the Phaser scene reference and offers no test surface. Phaser
rendering calls stay inline in `GameScene`; only position math (boardLayout) is
extracted.

Target line count for GameScene after split: ≤ 400 lines.

## API contract sketches

End-to-end pipeline: input event → `MoveExecutor` validation → state
delta → `onMoveApplied` callback → GameScene renders + persists.

```ts
// MoveExecutor — pure functions over GameState. Immutable contract:
// applyMove returns a NEW GameState, never mutates input.
export interface MoveTarget {
  pile: PileId;        // tableau-3, foundation-clubs, stock, waste, etc.
  position?: number;   // for tableau, the card index it lands on top of
}
export interface MoveExecutor {
  canMove(state: GameState, card: Card, target: MoveTarget): boolean;
  applyMove(state: GameState, card: Card, target: MoveTarget): GameState;
}

// Callback that controllers invoke after a successful applyMove. GameScene
// owns this callback and uses it to: re-render via existing renderBoard(),
// trigger flip / move-to-foundation animations, persist via
// save.updateCurrentGame(newState), check win condition. NO controller
// touches sprites or save directly — they only produce new state and emit it.
export type OnMoveApplied = (newState: GameState) => void;

// DragController — input adapter. Owns pointer state, no game logic.
export class DragController {
  constructor(
    scene: Phaser.Scene,
    moveExecutor: MoveExecutor,
    onMoveApplied: OnMoveApplied,
  );
  enable(): void;
  disable(): void;
}

// TapController — symmetric input adapter. Reuses MoveExecutor + same callback.
export class TapController {
  constructor(
    scene: Phaser.Scene,
    moveExecutor: MoveExecutor,
    onMoveApplied: OnMoveApplied,
  );
  enable(): void;
  disable(): void;
}

// HintController — purely advisory, no state mutation.
export class HintController {
  constructor(scene: Phaser.Scene, sound: SoundService);
  show(state: GameState): HintHighlight | null;
  clear(): void;
}

// gameEconomy — domain-aware atomic cost transactions. Each function knows
// its own cost constant; callers never pass numbers. Returns a discriminated
// union so callers can show "not enough coins" UX without re-checking balance.
export type ChargeResult =
  | { ok: true; balanceAfter: number }
  | { ok: false; reason: "insufficient_coins"; balance: number; cost: number };

export function chargeForHint(save: SaveService): ChargeResult;
export function chargeForUndo(save: SaveService): ChargeResult;
export function chargeForRestart(save: SaveService): ChargeResult;
```

## Migration path (incremental, low-risk first, with split high-risk steps)

Each step ships independently; only proceed to next if regression-free.

1. **`boardLayout`** — pure position math (card x/y, fan gaps, hit areas). Zero
   regression risk, immediately testable, validates extraction pattern.
2. **`hintController`** — small, self-contained, well-bounded state.
3. **`gameEconomy`** — extract domain-aware cost handlers. Replaces the
   `if (coins >= cost) { -cost; action(); save() }` triad currently duplicated
   for hint/undo/restart with three named functions.
4. **`autoCompleteController`** — already isolated by overlay flag, easy lift.
5. **`MoveExecutor` (split)**
   - **5a:** Extract `MoveExecutor` with full unit-test coverage. Wire it into
     the **drag pipeline only** — drag's drop handler calls
     `moveExecutor.canMove/applyMove`. Tap pipeline still uses inline engine
     calls. This isolates the new seam to one half of the code first.
   - **5b:** Wire the tap pipeline through `MoveExecutor`. Both pipelines now
     route through the same validator. Identical-output tests on engineMoves
     prove no semantic drift.
6. **`tapController` + `dragController` (split, simpler one first)**
   - **6a:** Extract `tapController` alone. Smaller, fewer lines. If MoveExecutor
     truly decouples them, this works on its own. If extraction fails, the
     failure points at residual coupling we didn't see — that's a useful
     signal, not a setback.
   - **6b:** Extract `dragController`. With tap already extracted and proven,
     the seam is validated.
7. **DOM-migration of remaining 5 Phaser-Canvas elements** — separate sub-task
   tracked in PUBLISH_YANDEX.md feedback. Independent of the controller split.

## Verification strategy (no Playwright dependency)

The canvas-game ecosystem doesn't lend itself to cheap visual regression. Two
tracks instead:

**Pre-extraction (per step):**
- Write unit tests for the to-be-extracted module *first* with mock pointer
  events / mock Phaser scene context. Tests stay green when the code moves —
  failures point at behaviour drift.
- For `MoveExecutor` specifically: redirect every existing `engineMoves` test
  through `MoveExecutor.canMove/applyMove`. If they all stay green, the seam
  preserves semantics by construction.

**Post-extraction (per PR) — manual QA checklist (≤ 60 sec):**
1. Drag a card from tableau to foundation
2. Drag a stack between two tableau piles
3. Tap stock to deal next card
4. Tap a card from waste/tableau to auto-target
5. Trigger hint (verify highlight appears + coin deducted)
6. Trigger auto-complete on a finishable board
7. Undo last move (verify coin deducted)
8. Restart deal (verify coin deducted, board reshuffled)
9. Attempt invalid move (drag back to origin / wrong target — must reject cleanly)
10. Tap stock rapidly twice (ghost-click guard must prevent double-deal)

If a step breaks any item, revert.

If a controller's behaviour proves untestable without Phaser glue (e.g.,
animation sequencing), extract the deterministic *logic* into a pure helper and
keep the Phaser-touching glue inline in the controller.

## Triggers to actually start

- **Proactive (forcing function):** GameScene line count crosses 2000 OR the
  next feature requires touching 3+ responsibility clusters from the table
  above in a single PR. Either condition = extract before shipping the feature.
- **Reactive:** Bug report involves cross-cluster interaction (drag breaks
  hint, tap-on-stock conflicts with auto-deal animation). Pain forces work.
- **Reactive:** Test coverage push — currently 0 tests on GameScene because
  Phaser is hard to mock. Extracted controllers would push coverage.

## Non-goals

- No ECS / new framework. Plain TS modules + dependency injection via
  constructor params is enough.
- No separate `BoardView` / renderer abstraction. The `onMoveApplied(newState)`
  callback is the only contract — GameScene's existing `renderBoard()` is
  invoked from inside that callback. Adding a `BoardView` interface would be
  premature for a solo project of this scale.
- DOM overlay coordination (createCanvasAnchoredOverlay calls, bottom action
  bar wiring, pause/menu modals) **stays in GameScene** — it's tied to scene
  lifecycle (create / SHUTDOWN / resize) and extracting it adds indirection
  without test value.
- Not reaching 100% test coverage of GameScene — only of extracted controllers.
- No 1-PR mega-refactor: each numbered step (and sub-step) ships independently
  and reverts cleanly if needed.

## Risk

GameScene is the most-touched file. A bad extraction lands as a stealth
regression in drag/tap that's hard to A/B against. Mitigation:

- Low-risk-first ordering means the riskiest step (drag+tap) happens when 4
  prior extractions have validated the pattern and `MoveExecutor` is already
  in place and tested.
- Steps 5 and 6 — the highest-risk extractions — are split into sub-steps so
  one PR touches one pipeline at a time.
- Manual QA checklist is the cheap regression net; unit tests on extracted
  modules are the durable one.
- Each step / sub-step is a single small PR. If verification fails, revert is
  trivial.
