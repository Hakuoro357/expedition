## Concerns

### [MAJOR] Icon delivery strategy is self-contradictory
(1) The plan presents three options (GP CDN fetch, hardcoded mapping, public/assets copy) then says "Cleanest path: copy to `public/assets/achievements/`" but the actual implementation plan says to create `src/data/achievementIconUrls.ts` with CDN URLs. No final decision is made — the implementing developer will have to choose.
(2) CDN URLs go stale if GamePush re-organizes storage; local `public/` files increase bundle size by ~20 PNGs; `?url` imports are not mentioned. Whichever path is chosen, the other files (VM, overlay renderer) must match.
(3) **Fix:** Commit to one strategy. Recommended: keep icons in `public/assets/achievements/` (simple, offline-capable, no extra fetch code) and delete the `achievementIconUrls.ts` file from the plan entirely. Document this decision.

### [MAJOR] Data-loading path is underspecified — reconciliation timing risk
(1) The plan says: "read `state.progress.achievementUnlocked` + `state.progress.achievementProgress`, fallback on `sdk.getPlayerAchievements()`". AchievementsReconciler.bootstrap already merges SDK + save. If the scene reads directly from SDK *and* save independently (bypassing the reconciler cache), it can show stale or conflicting state.
(2) If the reconciler's `bootstrap()` hasn't finished by the time AchievementsScene renders (e.g. slow network), the player sees empty progress.
(3) **Fix:** Explicitly state that AchievementsScene reads **only from the Reconciler's internal cache** (after awaiting `bootstrap` if needed). Do not call `sdk.getPlayerAchievements()` directly from the scene — that's the reconciler's job.

### [MAJOR] Bottom-nav expanded but "without changes" contradicts itself
(1) The plan extends `AppNavItem.id` union with `"achievements"` and adds a case in `createAppNavIconHtml`, then later states "Bottom-nav без изменений (archive / daily / settings)". The current nav has home/archive/daily/settings (4 items). Adding achievements makes it 5.
(2) If achievements gets a bottom-nav slot, one of the verification items is wrong; if it doesn't, modifying `appNavHtml.ts` is unnecessary. 5 icons on a mobile bottom bar may be crowded.
(3) **Fix:** Clarify: if achievements is NOT in bottom-nav (consistent with "Settings stays in bottom-nav" context and verification item 10), then the `appNavHtml.ts` changes should be removed from the plan. If it IS in bottom-nav, update verification to include it.

### [MAJOR] No `SCENES` constant registration detail
(1) Plan says add `achievements: "achievements"` to `SCENES` in `gameConfig.ts`. Need to verify this doesn't conflict with any existing key. More importantly, the plan doesn't specify the exact scene key string — if it's `"achievements"` vs `"AchievementsScene"`, the `scene.start()` calls must match exactly.
(2) Mismatch causes a silent Phaser failure (scene not found).
(3) **Fix:** Specify the exact string: `SCENES.achievements = "achievements"` and use `SCENES.achievements` everywhere, not string literals.

### [MAJOR] `returnTo` navigation doesn't cover all cases
(1) `data?: { returnTo?: "title" | "map" }` — but AchievementsScene could also be opened from Settings (future) or from a notification/toast. The back-button defaults to `SCENES.title`. If opened from MapScene and the player expects to return to their in-progress game, defaulting to title loses game state.
(2) A player mid-game who taps trophy → achievements → back → lands on TitleScene, losing their active game.
(3) **Fix:** Default `returnTo` should be `"map"` (more common mid-game path), not `"title"`. Or: require `returnTo` to always be passed explicitly (no default), and have the back-button fall back to the scene's `parent` property which Phaser tracks.

### [MAJOR] No state preservation on scene transition
(1) `this.scene.start(SCENES.achievements, ...)` replaces the current scene. In MapScene, this means the in-progress solitaire game is destroyed. When the player presses back, the game restarts from scratch (or re-loads save).
(2) This is a terrible UX for a solitaire game — player loses visual context of their card layout.
(3) **Fix:** Use `this.scene.launch(SCENES.achievements)` (parallel scene) + `this.scene.pause()` instead of `scene.start()`. The overlay pattern with `createCanvasAnchoredOverlay` already suggests this approach — AchievementsScene should be a **parallel overlay** on top of MapScene, not a replacement. On close, stop AchievementsScene and resume MapScene.

### [MAJOR] Coins counter placement may conflict with existing MapScene UI
(1) Adding `coins` to top-left of MapScene's `routeSceneOverlay` — but MapScene already has its own UI elements. The plan doesn't describe what currently occupies the top-left of MapScene. If there's existing UI (score, timer, chapter title), the coins counter will overlap.
(2) Visual collision, unreadable UI on mobile viewports.
(3) **Fix:** Document what currently exists in MapScene's four corners before adding new elements. Include a brief layout diagram or at least state "top-left is currently empty."

### [MAJOR] Locked achievement icon URLs may not exist
(1) The plan says 4 hidden achievements have `locked` URLs in the mapping. But the codebase description says "GP CDN icon URLs (already uploaded)" — it's unclear whether locked/silhouette variants were uploaded. The plan references them but doesn't confirm they exist.
(2) If locked URLs 404, broken images appear for the most interesting (hidden) achievements.
(3) **Fix:** Confirm locked icon assets exist. If not, plan a CSS-only grayscale/opacity filter on the main icon as a fallback (e.g., `filter: grayscale(1) opacity(0.3)`).

### [MINOR] Test count estimate is speculative
(1) Plan says "165 → ~175 (+10 тестов)". The overlay test file lists 5 test cases. Where do the other 5 come from? This sets a wrong expectation.
(2) Minor trust issue in verification.
(3) **Fix:** List the actual test cases, or remove the count and just say "existing + new overlay tests pass."

### [MINOR] 7 locale updates are listed but not structured
(1) The plan says update 7 locales (ru/en/tr/es/pt/de/fr) with 3 new keys each. This is 21 string additions with no draft translations provided. Non-English translations will likely be machine-translated or left for later.
(2) Shipping with missing/wrong translations degrades UX for non-Russian speakers.
(3) **Fix:** Provide all 21 strings in the plan, or explicitly defer non-ru/en to a follow-up ticket.

### [MINOR] No responsive/mobile layout considerations
(1) Achievement cards at 64×64 icon size + title + description + progress bar on a mobile viewport (320px wide) could overflow or be unreadable. The plan mentions CSS classes but no responsive strategy.
(2) The game is HTML5 — mobile is a primary target.
(3) **Fix:** Specify that achievement cards use a single-column layout with `max-width: 100%` and the icon scales down on narrow viewports (e.g., `min(64px, 15vw)`).

### [MINOR] No loading/spinner state while fetching achievement data
(1) If `sdk.getPlayerAchievements()` is called (even as fallback), there's a network round-trip. No mention of a loading indicator.
(2) Player sees empty/broken screen for 1-2 seconds.
(3) **Fix:** Show a spinner or skeleton state while data loads; the overlay pattern likely already supports this.

### [MINOR] Trophy SVG style specification is vague
(1) "Match other nav-icons style" — no reference to what those look like. "outline, brass amber" and "currentColor stroke" are given, but no dimensions, viewBox, or stroke-width spec.
(2) Inconsistent icon if different developers create it.
(3) **Fix:** Provide the SVG viewBox and stroke-width, or reference an existing icon file as an exact template.

### [MINOR] `achievementsSceneOverlay.test.ts` tests HTML output but no accessibility tests
(1) Tests check visual rendering (sections, checkmarks, progress bars) but no ARIA roles, keyboard navigation, or screen reader compatibility.
(2) DOM overlays are real HTML — accessibility matters.
(3) **Fix:** Add at least one test for `role="list"` / `role="listitem"` and `aria-label` on the achievements button.

### [MINOR] No error handling for failed SDK calls
(1) If `sdk.getPlayerAchievements()` throws or returns null (network error, expired session), the plan doesn't describe the failure mode.
(2) Blank screen or JS error in production.
(3) **Fix:** Wrap SDK calls in try/catch, fall back to save-data-only view with a subtle "offline mode" notice.

## Alternative approaches

### Use scene overlay (launch/pause) instead of scene replacement
**Rationale:** The plan uses `scene.start()` which destroys the parent scene. For MapScene especially, this means the in-progress game is lost. The existing `createCanvasAnchoredOverlay` pattern and scenes like DiaryScene/RewardScene may already use the overlay approach. AchievementsScene should be a parallel scene that renders on top via `scene.launch()` + `scene.pause('MapScene')`, and on close does `scene.stop('Achievements')` + `scene.resume('MapScene')`. This preserves game state entirely and is the standard pattern for modal UI in Phaser 3. For TitleScene (no game state to preserve), `scene.start()` is acceptable.

### Single source of truth: Reconciler cache only
Instead of the dual-read strategy (save + SDK fallback in the scene), have the Reconciler expose a `getSnapshot()` method that returns the merged, up-to-date view. AchievementsScene reads only from this. This eliminates the data-loading concern entirely and follows the existing architecture pattern.

### Skip the separate `achievementIconUrls.ts` file
Icons are static assets. Copy them to `public/assets/achievements/<tag>.png` (4 hidden get `<tag>_locked.png`). Reference with `./assets/achievements/<tag>.png`. This eliminates CDN dependency, works offline, and Vite handles the copy automatically. No new TS file needed.

CONCERNS REMAIN