# GameScene decomposition (techdebt)

**Status:** parked / not scheduled. Recorded 2026-05-02 after Qwen project review.
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
behaviour clusters into pure modules under `src/features/board/`:

| Module | Responsibility | Test surface |
|---|---|---|
| `boardLayout.ts` | Pure: card positions, fanning gaps, hit areas. | snapshot tests |
| `boardRenderer.ts` | Phaser-rendering: paints cards/piles given layout + state. | thin wrapper |
| `dragController.ts` | Pointer pipeline: down → preview → drop. Pure state machine. | unit tests |
| `tapController.ts` | Already partly isolated (ghostClickGuard). Move full state machine here. | unit tests |
| `hintController.ts` | Compute hint highlight, manage timers, sound feedback. | unit tests |
| `autoCompleteController.ts` | Win-detection + sequential auto-foundation animation. | unit tests |
| `gameEconomy.ts` | Coin-cost actions (hint/undo/restart), wraps SaveService. | unit tests (already partial) |
| `GameScene.ts` (after) | Wires the controllers, owns Phaser scene lifecycle, scene transitions. | integration test only |

Target line count for GameScene after split: ≤ 400 lines.

## Migration path (incremental, not big-bang)

1. Extract `dragController` first — biggest win for testability, well-bounded
   state. Keep behaviour identical, snapshot a current playthrough as regression
   anchor before starting.
2. Extract `hintController` — small, self-contained, easy validation.
3. Extract `autoCompleteController` — already isolated by overlay flag.
4. Extract `boardLayout` — pure functions, trivially testable.
5. Migrate remaining 5 Phaser-Canvas elements to DOM (separate sub-task, listed
   in PUBLISH_YANDEX.md feedback).

Each step ships independently; only proceed to next if regression-free.

## Triggers to actually start

- A bug report involves cross-cluster interaction (drag breaks hint, tap-on-stock
  conflicts with auto-deal animation) — pain forces decomposition.
- Major new gameplay feature (Vegas mode, undo limits) — adding to monolith vs.
  extracting first becomes a real choice.
- Test coverage push — currently 0 tests on GameScene because Phaser is hard
  to mock; extracted controllers would push coverage.

## Non-goals

- Not introducing ECS / new framework. Plain TS modules + dependency injection
  via constructor params is enough.
- Not reaching 100% test coverage of GameScene — only of extracted controllers.
- Not breaking the 1-file PR rule for sensitive layout — boardLayout extraction
  ships separately from boardRenderer.

## Risk

GameScene is the most-touched file. A bad extraction lands as a stealth
regression in drag/tap that's hard to A/B against. Mitigation: snapshot a
recorded playthrough (Playwright?) before each extraction step, replay after.
