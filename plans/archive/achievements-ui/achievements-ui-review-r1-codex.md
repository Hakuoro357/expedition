[CRITICAL] 1) UI progress source is wrong: plan reads `achievementProgress` / `achievementUnlocked` as primary state. 2) Those are committed/backend-sync state, not current player progress; offline or failed SDK writes will make UI stale. 3) Build UI from `ACHIEVEMENTS.compute({ progress })`, then merge SDK/persisted unlocks as confirmation.

[CRITICAL] 1) No display metadata exists for achievement names, descriptions, groups, or ordering. 2) `ACHIEVEMENTS` only has `tag/max/hidden/compute`; UI cannot render localized human text safely. 3) Add `achievementUiMeta` with group id/order, icon key, localized title/description keys.

[MAJOR] 1) `sdk.getPlayerAchievements()` is sync and only fresh after `fetchAchievements()`, while bootstrap is fire-and-forget. 2) Scene can render stale/empty GP state. 3) Render local computed state immediately, optionally call `fetchAchievements()` async and rerender/merge afterward.

[MAJOR] 1) Hidden locked achievements only hide title/description, but may still show progress/icon. 2) This leaks spoilers or mastery conditions. 3) For `hidden && !unlocked`, hide real icon, description, progress label, progress bar, and use only locked silhouette + `???`.

[MAJOR] 1) TitleScene already has optional Community button. 2) The plan’s “4th button between Start and Settings” is ambiguous and may become 5 buttons on GP builds. 3) Define exact order with community present, or move achievements to a compact secondary row/icon.

[MAJOR] 1) Title achievements button is not gated by `prologueShown`. 2) First-run players can bypass the intended start funnel and see meta spoilers before prologue. 3) Hide achievements on first run or show a spoiler-safe locked/empty state.

[MAJOR] 1) Returning from Map loses current route page. 2) `MapScene` has `page?: number`, but plan passes only `{ returnTo: "map" }`. 3) Pass `{ returnTo: "map", mapData: { page: this.currentPage } }` or equivalent.

[MAJOR] 1) Adding `"achievements"` to `AppNavItem.id` conflicts with stated bottom-nav policy. 2) Existing nav handlers only understand home/archive/daily/settings; adding a new id widens contracts unnecessarily. 3) Do not add achievements to bottom nav unless it is actually a nav item.

[MAJOR] 1) AchievementsScene bottom-nav behavior is underspecified. 2) Daily resume, Settings return target, Home/Archive semantics, and active state can regress existing flows. 3) Mirror `DiaryScene`/`SettingsScene` handlers explicitly, including daily resume behavior.

[MAJOR] 1) 20 achievements in 6 groups will not fit one viewport, but scroll behavior is not specified. 2) DOM overlay host uses `pointer-events: none`; scroll regions/buttons need explicit event handling/CSS. 3) Define a bounded scroll container above bottom nav/back button and test touch scrolling.

[MAJOR] 1) Asset strategy contradicts itself: GP CDN, hardcoded mapping, local `dist`, then `public/assets`. 2) This risks broken icons in production or no offline support. 3) Choose one primary path: local `public/assets/achievements/*.png`, with optional CDN fallback only if needed.

[MAJOR] 1) Route top-bar placement is likely to collide with existing mute/community stack and route labels. 2) Current map has dense SVG labels and fixed top-right controls. 3) Define exact offsets/z-index/safe area and add mobile screenshot QA.

[MAJOR] 1) Tests are mostly overlay string tests. 2) Core bugs here are view-model merging, scene routing, current page preservation, and SDK unsupported/freshness cases. 3) Add pure view-model tests plus scene integration tests for Title/Map click paths.

[MINOR] 1) Image URL rendering plan does not mention `safeImageUrl`. 2) Even internal mappings become an XSS/broken-src sink if later refactored. 3) Sanitize `img src`, escape attributes, and provide `onerror`/placeholder behavior.

[MINOR] 1) Accessibility is incomplete. 2) Trophy button, coin counter, progress bars, locked state, and images need usable labels. 3) Add `aria-label`, `role="progressbar"`, `aria-valuenow/max`, and meaningful/empty alt policy.

[MINOR] 1) Settings still contains dead `achievementsLabel`/`open-achievements` scaffold. 2) Plan says Settings entry is removed, but stale code can confuse future implementation. 3) Either remove it now or explicitly leave it inert with tests covering no Settings entry.

[MINOR] 1) No analytics/event naming is planned. 2) New entry points are useful product signals and help diagnose GP availability. 3) Track `achievements_open` with origin `title|map` and maybe unsupported hidden state in debug only.

[MINOR] 1) Verification omits real GP sandbox checks for `fetchAchievements/playerAchievementsList`. 2) The UI depends on platform-specific behavior. 3) Add manual QA in GP sandbox with existing unlocked/progress achievements and with SDK unavailable.

## Alternative approaches

Use a pure `buildAchievementsViewModel({ progress, sdkAchievements, locale })` function as the central contract. It computes desired local progress from `ACHIEVEMENTS.compute`, merges persisted/SDK unlocked state, applies hidden masking, groups by explicit UI metadata, and returns render-only VMs. This keeps Reconciler as the backend write pipeline and avoids reading private reconciler cache.

Prefer local icon assets in `public/assets/achievements/` as primary. CDN URLs can remain admin/upload documentation, not runtime dependency. This is simpler, works offline/dev, and makes broken icons testable through normal build output.

Keep achievements as a page-level scene opened from Title and Map trophy only. Do not extend bottom nav with an achievements id unless the product decision changes; inside AchievementsScene reuse existing bottom-nav ids for navigation away.

CONCERNS REMAIN