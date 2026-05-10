[MAJOR] Async GamePush social failures are not actually caught  
What’s wrong: `GamePushSdkService.share()` and `joinCommunity()` wrap calls in `try/catch`, but GamePush typed docs define `share()` as `Promise<any>` and `joinCommunity()` as `Promise<boolean>`. The current local types say `void`, so rejected promises bypass the catch. Refs: [GamePushSdkService.ts](<C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/services/sdk/GamePushSdkService.ts:284>), [env.d.ts](<C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/env.d.ts:124>).  
Why it matters: `canShare()` can be true, the button can show, then the SDK rejects asynchronously with an unhandled rejection; RewardScene still disables the button permanently for that visit.  
Fix: align `GamePushSocials.share/joinCommunity` and `SdkService.share/joinCommunity` with Promise-returning SDK methods, then `void Promise.resolve(...).catch(...)` or return a success/failure promise to callers.

[MAJOR] Community result listeners can double-count and misattribute joins  
What’s wrong: `TitleScene` and `MapScene` each install a permanent `onJoinCommunityResult` listener and never unsubscribe. The flags prevent duplicate installs inside one scene, but after both scenes have rendered, one `joinCommunity` result can trigger both analytics callbacks. Refs: [TitleScene.ts](<C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/TitleScene.ts:133>), [MapScene.ts](<C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/MapScene.ts:422>).  
Why it matters: a map click can be tracked as both `{ from: "map" }` and `{ from: "title" }`, corrupting analytics.  
Fix: add `off`/unsubscribe support in `SdkService`, unregister on scene shutdown, or centralize community result handling with a `pendingCommunityOrigin`.

[MAJOR] Share result listener uses mutable scene state  
What’s wrong: the share callback reads `this.dealId` when the result arrives, not when the share was initiated. The listener persists across RewardScene restarts. Ref: [RewardScene.ts](<C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/RewardScene.ts:359>).  
Why it matters: if a share result arrives late after navigation/restart, it can track the wrong deal and play success sound on an unrelated screen.  
Fix: capture `dealId` at click time into `pendingShareDealId`, clear it on result/shutdown, or subscribe with `once/off` per share attempt.

[MINOR] Quick-play wins cannot share  
What’s wrong: `GameMode` includes `"quick-play"`, but RewardScene gates share on `this.dealId.length > 0`, and `buildShareWinText()` requires a route point title. Refs: [types.ts](<C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/core/game-state/types.ts:13>), [RewardScene.ts](<C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/RewardScene.ts:76>).  
Why it matters: if quick-play ships with empty/non-route deal ids, sharing silently disappears.  
Fix: either explicitly document “adventure-only share” or add a generic `shareQuickWinText` path for non-route wins.

[MINOR] `og:image` placeholder can produce cached text-only feed cards  
What’s wrong: `og:image` points to a hard-coded asset that does not exist yet. Ref: [index.html](<C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/index.html:22>).  
Why it matters: VK/OK sharing should not break, but crawlers can render no image and cache the failed preview.  
Fix: replace with a real uploaded 1200x630 image before release, or omit `og:image` until the asset exists.

[MINOR] Inline community SVG should be hidden from assistive tech  
What’s wrong: the button has `aria-label`, which is the important part, but the decorative inner `<svg>` is not marked `aria-hidden="true"` / `focusable="false"`. Ref: [routeSceneOverlay.ts](<C:/Users/RobotComp.ru/games/Yandex/01-solitaire-expedition/src/scenes/routeSceneOverlay.ts:197>).  
Why it matters: most screen readers will be fine, but some SVG exposure is noisy. `role="img"` is not needed because the button is already named.  
Fix: add `aria-hidden="true" focusable="false"` to the SVG.

[MINOR] Missing regression tests around the real risk points  
What’s wrong: current added tests cover HTML rendering and i18n substitution, but not SDK promise rejection, listener cleanup/attribution, or stale share deal ids.  
Why it matters: those are the areas most likely to regress in production because they depend on async SDK behavior and scene lifecycle.  
Fix: add fake-sdk tests for rejected `share/joinCommunity`, multiple Title/Map listener registration, late share result after `dealId` changes, and quick-play share gating.

No current concern found for XSS: current `i18n.t()` results are inserted through `textContent` or escaped overlay generators; `RewardScene` sends `shareWinText` to SDK, not HTML. French `shareWinText` in the shown diff uses NBSP around guillemets/colon. Yandex stubs match the current local interface, but should change if the interface is corrected to Promise-returning social methods.

Source checked: GamePush typed docs for `Socials.share`, `joinCommunity`, events, and `off/on/once`: https://gamepush.com/sdk/docs/classes/Socials.html

CONCERNS REMAIN