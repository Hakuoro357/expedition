=== Prior-concern-not-closed ===

[MINOR] 1) **XM-MIN4: No loading/spinner state while fetching achievement data.** 2) If `sdk.getPlayerAchievements()` is called as confirmation, there's still a brief async gap. 3) Show a skeleton or brief "loading…" during create(); compute() renders instantly so this is low-risk, but note it.

[MINOR] 1) **XM-MIN7: No explicit error handling for SDK confirmation call.** 2) If `sdk.getPlayerAchievements()` throws, the scene should still work from compute(). 3) Wrap the confirmation call in try/catch; on failure, render with `sdkUnlockedTags = new Set()`.

=== New-concern-introduced ===

[MAJOR] 1) **MapScene `scene.resume(SCENES.map, { page })` is a no-op.** Phaser's `scene.resume(key, data)` only passes data to `init()`/`create()` — it does NOT inject props into a running scene. MapScene has no `init(data: { page })` handler, so the page parameter is silently dropped. The plan's claim "Map resumes with same currentPage" is only true because `scene.pause/resume` preserves runtime state, making `mapData` redundant, not functional. 2) Developers will believe the page is being restored via data passing, and future refactors may break if someone removes the pause/resume pattern. 3) **Fix:** Remove `mapData: { page }` from the launch/resume data entirely. Add a comment: "MapScene state is preserved by pause/resume — no data passing needed." This simplifies the API and avoids a false contract.

[MAJOR] 1) **TitleScene missing `sdk.canUseAchievements()` gate.** Verification item 11 states: "Yandex build (`canUseAchievements=false`): trophy in MapScene нет, кнопка в Title нет." MapScene gates on `sdk.canUseAchievements()`, but TitleScene only gates on `prologueShown`. On Yandex builds, the achievements button will still appear in TitleScene. 2) Yandex players see a button that does nothing (or crashes if achievements SDK is unavailable). 3) **Fix:** TitleScene should gate on `state.progress.prologueShown && sdk.canUseAchievements()`.

[MAJOR] 1) **Data source for `sdkUnlockedTags` in the scene is unspecified.** The plan says "SDK as confirmation" and "we DON'T read directly from Reconciler," but `buildAchievementsViewModel` needs `sdkUnlockedTags: Set<string>`. Where does the scene get this? Calling `sdk.getPlayerAchievements()` directly has the bootstrap-timing issue from R1-M1 (the whole reason compute() is primary). Reading from Reconciler cache contradicts "don't read directly." 2) Without a clear data path, the implementing developer must guess, risking the exact stale-data bug the revision was designed to prevent. 3) **Fix:** Specify one of: (a) AchievementsScene calls `sdk.getPlayerAchievements()` async in create(), renders immediately from compute(), re-renders when SDK data arrives (progressive enhancement), or (b) Reconciler exposes a `getUnlockedTags(): Set<string>` snapshot (non-private cache read), or (c) drop SDK confirmation entirely and rely only on `persistedUnlocked` from save data. Option (a) is simplest and consistent with the "compute first, confirm after" architecture.

[MINOR] 1) **`buildAchievementsViewModel` `locale` parameter unused.** The signature includes `locale` but `ACHIEVEMENT_UI_META` uses `titleKey`/`descriptionKey` which are i18n lookup keys — the locale is presumably used at render time by the overlay, not in the VM builder. 2) Unclear API contract invites confusion about where locale resolution happens. 3) **Fix:** Either remove `locale` from the VM builder (it's used in the overlay renderer via `i18n.t(key, locale)`) or document why it's there (e.g., sorting localized group names).

## Alternative approaches

None needed. The plan is converging well — the three MAJOR concerns above are implementation clarifications, not design pivots. The architecture (compute-primary, launch+pause, local assets, separate UI meta) is sound.

CONCERNS REMAIN