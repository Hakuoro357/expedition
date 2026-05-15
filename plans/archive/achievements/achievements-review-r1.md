[CRITICAL] Progress achievements are not capped before `setProgress`.
What's wrong: `coins_500` receives raw `progress.coins`, and `daily_streak_7` receives raw `streakCount`. After max, every increase still looks like progress.
Why it matters: quota math becomes false. A player with 2,500 coins can keep sending `coins_500`, `coins_1000`, `coins_2000`; daily_7 can keep sending after day 7.
Suggested fix: store achievement metadata `{ tag, max }`; call `Math.min(value, max)` and skip if `sdk.hasAchievement(tag)` once max is reached.

[MAJOR] `tryUnlock` / `trySetProgress` cache before SDK success.
What's wrong: the service adds to `unlockedCache` / `lastProgress` immediately, while calls are fire-and-forget.
Why it matters: a transient GP failure can permanently suppress retry for the session.
Suggested fix: make SDK methods return `Promise<boolean>` or throw; update cache only after success. Track `pending` separately to prevent duplicate in-flight calls.

[MAJOR] Missing free `getProgress()` usage and release backfill.
What's wrong: `lastProgress` starts empty and no boot-time reconciliation is planned.
Why it matters: existing players with completed chapters/artifacts may never get those achievements if they already finished the content.
Suggested fix: add `getAchievementProgress(tag)` to SDK, seed `lastProgress`, then run a single `reconcileAchievements(save.progress)` after `save.init()`.

[MAJOR] Character achievement IDs are wrong.
What's wrong: plan calls `countCompletedEntriesByAuthor(..., "voronov")`, but actual `speakerEntityId` values are `leader`, `archaeologist`, `cartographer`, `quartermaster_guide`, `photographer_archivist`.
Why it matters: all character counters will stay at 0.
Suggested fix: define explicit mapping: `entries_voronov -> leader`, `entries_levin -> archaeologist`, etc. Add a test that all 30 entries are counted exactly once.

[MAJOR] Daily streak trigger does not match current code.
What's wrong: current `SaveService.claimDaily()` only sets `dailyClaimedOn` and coins; it does not update `streakCount` / `lastLoginDate`.
Why it matters: daily achievements will not progress.
Suggested fix: decide product meaning: consecutive daily wins vs login streak. If daily wins, add explicit `dailyWinStreakCount`; if login streak, trigger from login-streak update, not `claimDaily()`.

[MAJOR] Mastery data must be passed before `clearCurrentGame()`.
What's wrong: `GameScene.renderBoard()` clears currentGame before starting RewardScene.
Why it matters: RewardScene cannot reliably read `undoCount` / `hintCount`.
Suggested fix: pass `{ lastUndoCount, lastHintCount }` in `RewardSceneData` from GameScene before clear, or unlock mastery directly in GameScene before scene transition.

[MAJOR] `hintCount` can be lost through undo/history.
What's wrong: if `hintCount` is part of `GameState`, undo restores an older `previousState`; hints used after that snapshot can be rolled back.
Why it matters: `no_hint_win` can unlock falsely.
Suggested fix: gameplay counters should be monotonic session fields. On undo, preserve current `hintCount` and increment `undoCount` from current state, not restored history state.

[MAJOR] `hintCount` increment is not persisted in the proposed location.
What's wrong: plan says increment after `save.addCoins(-cost)`, but current hint flow does not call `save.updateCurrentGame()` after hint.
Why it matters: closing/restoring after a hint can reset `hintCount`.
Suggested fix: after incrementing, call `save.updateCurrentGame(this.gameState)` before `flush()`.

[MAJOR] Legacy migration is underspecified.
What's wrong: current `SaveService.init()` assigns `parsed.currentGame` directly after validation. Allowing `undefined` in validation is not enough.
Why it matters: TypeScript/runtime can keep old currentGame without normalized `hintCount`.
Suggested fix: add `sanitizeGameState()` and assign `currentGame: parsed.currentGame ? sanitizeGameState(parsed.currentGame) : null`.

[MAJOR] Triggers need strict `preview` / `returnFromDetail` / replay guards.
What's wrong: RewardScene has preview and return-from-detail paths that intentionally avoid save mutation; achievement triggers in generic RewardScene code could fire there.
Why it matters: dev preview or repeated RewardScene visits can unlock achievements.
Suggested fix: centralize trigger call behind `if (!preview && !returnFromDetail && actualWinApplied)`; explicitly allow only intended backfill triggers.

[MAJOR] `first_entry` via DetailScene can unlock too early.
What's wrong: DetailScene can be opened for a node; the plan says opening entry tab may unlock.
Why it matters: if the node is not completed, “collected entry” becomes “viewed preview”.
Suggested fix: gate DetailScene trigger with `progress.completedNodes.includes(node.id)`.

[MAJOR] Putting achievement triggers inside `SaveService` couples save to AppContext.
What's wrong: plan imports `getAppContext()` into `SaveService.addCoins()` / `claimDaily()`.
Why it matters: SaveService is currently platform/domain-clean and is initialized before AppContext is set. Tests and future reuse get more brittle.
Suggested fix: keep SaveService pure. Trigger achievements from scene/use-case orchestration or an `AchievementsReconciler` that observes save results.

[MAJOR] Dashboard registration order is risky.
What's wrong: verification says create achievements in dashboard after build/upload.
Why it matters: first QA runs can call unregistered tags, fail, then local caches may suppress retry.
Suggested fix: create dashboard achievements before runtime QA, or disable achievement calls until a dev validation confirms registration.

[MINOR] `onAchievementUnlock(callback)` is planned but unused.
What's wrong: interface grows with a listener that no phase consumes.
Why it matters: extra API surface invites listener leaks, especially after the socials lesson.
Suggested fix: omit it until there is a concrete one-global-listener use case.

[MINOR] Test file list is incomplete.
What's wrong: adding required `hintCount` breaks existing hand-built `GameState` fixtures beyond `SaveService.test.ts`.
Why it matters: build/tests fail from unrelated fixtures.
Suggested fix: update all `undoCount: 0` fixtures or add a test helper factory.

[MINOR] `first_artifact` has no backfill path.
What's wrong: it triggers only when `artifactAwarded` is newly awarded.
Why it matters: existing players with artifacts but no future artifact drops may never get it.
Suggested fix: include `first_artifact` in reconciliation: unlock if `progress.artifacts.length > 0`.

[MINOR] Epilogue trigger spec is still ambiguous.
What's wrong: table says DetailScene open OR c3n10 completion; open item says complete.
Why it matters: dashboard/story expectation can drift.
Suggested fix: make it one rule: unlock on completing `c3n10`; optionally open DetailScene only if completed.

[MINOR] Coin achievement semantics are unclear.
What's wrong: using current coin balance means spending affects visible progress semantics.
Why it matters: “earned 1000 coins” and “hold 1000 coins” are different achievements.
Suggested fix: either rename/descriptions as balance milestones, or add cumulative `totalCoinsEarned`.

[MINOR] Social achievement misses existing community flow.
What's wrong: game already has join-community result listener, but only share gets an achievement.
Why it matters: if achievements are the “second social layer”, community join is a natural low-cost milestone.
Suggested fix: consider `first_community_join`, or explicitly document why 21 excludes it.

## Alternative approaches

Use a single `AchievementsReconciler` instead of scattering triggers across SaveService and scenes. It takes `SaveState` plus optional `LastWinContext` and computes desired achievement state from facts: completed nodes, artifacts, coins, daily streak, share success, last win counters. It then calls a metadata-driven `AchievementsService`.

Trade-offs: slightly more upfront structure, but lower risk. It solves backfill, max capping, dashboard drift tests, and quota math in one place. Scenes only report events; SaveService stays pure.

For mastery achievements, keep `lastWinContext` event-based: `GameScene` emits `{ mode, dealId, undoCount, hintCount }` exactly once on win. Everything else can be derived from save state.

CONCERNS REMAIN