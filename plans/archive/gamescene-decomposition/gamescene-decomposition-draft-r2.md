# GameScene decomposition (techdebt)

**Status:** parked / not scheduled. Recorded 2026-05-02 after Qwen project review.
Round 2 revision: re-ordered migration, introduced `MoveExecutor` seam, dropped
`boardRenderer`, replaced Playwright aspiration with concrete two-track verification.

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

## Proposed split

Aim: keep `GameScene` as **scene shell** (lifecycle + sub-coordinator), extract
behaviour clusters into pure modules under `src/features/board/`. The central
seam is `MoveExecutor` — it owns the canonical "can this move happen / apply
this move" pair that drag and tap both call into. Without this seam, drag and
tap remain coupled through scene state regardless of which file holds them.

| Module | Responsibility | Test surface |
|---|---|---|
| `boardLayout.ts` | Pure: card positions, fanning gaps, hit areas. | snapshot tests |
| `MoveExecutor.ts` | Pure: `canMove(card, target)` validation + `applyMove(card, target)` state delta. Wraps engine logic. | unit tests |
| `dragController.ts` | Pointer pipeline: down → preview → drop. Calls `MoveExecutor`. | unit tests with mock pointers |
| `tapController.ts` | Tap state machine + ghost-click guard. Calls `MoveExecutor`. | unit tests with mock pointers |
| `hintController.ts` | Compute hint highlight, manage timers, sound feedback. | unit tests |
| `autoCompleteController.ts` | Win-detection + sequential auto-foundation animation. | unit tests |
| `gameEconomy.ts` | Atomic `chargeAndApply(cost, action)`: balance check → deduct → persist via SaveService. Single place for hint/undo/restart cost handling. | unit tests |
| `GameScene.ts` (after) | Wires the controllers, owns Phaser scene lifecycle, scene transitions, owns DOM overlay coordination (see Non-goals). | integration test only |

`boardRenderer` was considered but dropped — a wrapper around `this.add.*` calls
still needs the Phaser scene reference and offers no test surface. Phaser
rendering calls stay inline in `GameScene`; only position math (boardLayout) is
extracted.

Target line count for GameScene after split: ≤ 400 lines.

## API contract sketches

Concrete enough that the future-me cannot re-derive different boundaries by
accident.

```ts
// MoveExecutor — the heart of the decomposition. Pure given current state.
export interface MoveTarget {
  pile: PileId;        // tableau-3, foundation-clubs, etc.
  position?: number;   // for tableau, the card index it lands on top of
}
export interface MoveExecutor {
  canMove(state: GameState, card: Card, target: MoveTarget): boolean;
  applyMove(state: GameState, card: Card, target: MoveTarget): GameState;
}

// DragController — input adapter. Owns pointer state, no game logic.
export class DragController {
  constructor(
    scene: Phaser.Scene,
    moveExecutor: MoveExecutor,
    onMoveApplied: (newState: GameState) => void,
  );
  enable(): void;
  disable(): void;
}

// TapController — symmetric input adapter. Reuses MoveExecutor.
export class TapController {
  constructor(
    scene: Phaser.Scene,
    moveExecutor: MoveExecutor,
    onMoveApplied: (newState: GameState) => void,
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

// gameEconomy — atomic cost transactions.
export function chargeAndApply(
  save: SaveService,
  cost: number,
  apply: () => void,
): { ok: true } | { ok: false; reason: "insufficient_coins" };
```

## Migration path (incremental, low-risk first)

Each step ships independently; only proceed to next if regression-free.

1. **`boardLayout`** — pure position math (card x/y, fan gaps, hit areas). Zero
   regression risk, immediately testable, validates extraction pattern.
2. **`hintController`** — small, self-contained, well-bounded state.
3. **`gameEconomy.chargeAndApply`** — extract the `if (coins >= cost) { -cost;
   action(); save() }` triad currently duplicated for hint/undo/restart.
4. **`autoCompleteController`** — already isolated by overlay flag, easy lift.
5. **`MoveExecutor`** — extract pure move validation + application. **Both drag
   and tap continue to live in GameScene at this step**, but they now both call
   `moveExecutor.canMove/applyMove`. This is a refactoring-in-place, not an
   extraction — but it creates the seam.
6. **`dragController` + `tapController` together** — final coordinated extract.
   Both depend on `MoveExecutor` from step 5; extracting both at once keeps the
   shared-state surface small and prevents partial-extraction tangles. Riskiest
   step intentionally last when the testing pattern is proven and the seam is
   in place.
7. **DOM-migration of remaining 5 Phaser-Canvas elements** — separate sub-task
   tracked in PUBLISH_YANDEX.md feedback. Independent of the controller split.

## Verification strategy (no Playwright dependency)

The canvas-game ecosystem doesn't lend itself to cheap visual regression. Two
tracks instead:

**Pre-extraction (per step):**
- Write unit tests for the to-be-extracted module *first* with mock pointer
  events / mock Phaser scene context. Tests stay green when the code moves —
  failures point at behaviour drift.
- For `MoveExecutor` specifically: every existing engineMoves test becomes a
  consumer of `MoveExecutor` rather than calling engine functions directly.
  This proves the seam preserves semantics.

**Post-extraction (per PR):**
- Manual QA checklist (≤ 30 seconds): drag a card to foundation; tap stock;
  trigger hint; trigger auto-complete; undo last move; restart deal. Same
  checklist after every step. If a step breaks any item, revert.

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
- DOM overlay coordination (createCanvasAnchoredOverlay calls, bottom action
  bar wiring, pause/menu modals) **stays in GameScene** — it's tied to scene
  lifecycle (create / SHUTDOWN / resize) and extracting it adds indirection
  without test value.
- Not reaching 100% test coverage of GameScene — only of extracted controllers.
- No 1-PR mega-refactor: each numbered step ships independently and reverts
  cleanly if needed.

## Risk

GameScene is the most-touched file. A bad extraction lands as a stealth
regression in drag/tap that's hard to A/B against. Mitigation:

- Low-risk-first ordering means the riskiest step (drag+tap) happens when 4
  prior steps have validated the pattern and `MoveExecutor` is already in place.
- Manual QA checklist is the cheap regression net; unit tests on extracted
  modules are the durable one.
- Each step is a single small PR. If verification fails, revert is trivial.
