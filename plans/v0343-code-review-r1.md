[MAJOR] `GameScene.handleHintAction()` treats “no remaining unseen hints” as “no possible moves”.  
Why it matters: `getRemainingHints()` filters out hints already shown for the current board fingerprint. After the player cycles through all hints, `remaining.length === 0` can still mean legal moves exist. The modal then incorrectly says “Возможных ходов нет”.  
Suggested fix: in [GameScene.ts](C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/GameScene.ts:642), distinguish `getAllHints(this.gameState).length === 0` from “all hints already shown”. Show `noMoves` only for the first case; for the second use a separate locale key or keep a non-leaking disabled/notice state.

[MAJOR] `SettingsScene` opened from `TitleScene` exposes bottom-nav before first start.  
Why it matters: first-run users can go Title → Settings → Daily/Archive and bypass the intended prologue/start funnel. Previously `startmenu` explicitly hid nav. Daily is especially problematic because [SettingsScene.ts](C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/SettingsScene.ts:339) starts a daily game with no `prologueShown` guard.  
Suggested fix: when `returnTo === "title"` and `!save.load().progress.prologueShown`, hide `navItems` or disable/archive daily navigation. Keep only Back + settings controls.

[MINOR] Artifact resolution is now duplicated between `DetailScene` and `rewardRevealItems`.  
Why it matters: the current bug came from resolver drift. The comment in [DetailScene.ts](C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/DetailScene.ts:84) says it mirrors another file, which is a maintenance hazard.  
Suggested fix: extract a shared helper, e.g. `resolveRewardArtifactId(node)` / `resolveCollectibleArtifactForNode(node)`, and use it in both `DetailScene` and reward reveal building.

[MINOR] Some comments now contradict behavior or reference removed `startmenu`.  
Why it matters: future edits around hints/settings can easily reintroduce the old behavior. Examples: [GameScene.ts](C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/GameScene.ts:331) still describes button blocking semantics while `hintDisabled` is always false; [settingsSceneOverlay.ts](C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/settingsSceneOverlay.ts:43) still documents `startmenu`.  
Suggested fix: update comments to match v0.3.43 behavior.

[MINOR] New Title flow has only overlay string tests, not scene/navigation guard tests.  
Why it matters: the risky parts are not the HTML string but first-run gating, Continue routing, Settings return, and Daily bypass. Existing `122/122` can pass while these regressions remain.  
Suggested fix: add focused tests or scene-level smoke coverage for Title first launch, Continue enabled state, Settings returnTo `"title"`, and blocked Daily/Archive before prologue if that guard is intended.

CONCERNS REMAIN