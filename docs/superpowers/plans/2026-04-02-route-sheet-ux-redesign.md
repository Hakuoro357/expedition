# Route Sheet UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the map-first meta flow with a route-sheet-first flow, rename Diary to Archive, and rework point interaction, reward visuals, and navigation to match the approved route-sheet UX.

**Architecture:** Introduce a dedicated route-sheet scene that owns page navigation, point states, and point modal entry. Re-scope the existing diary into an archive screen with tabs, move rules access into the game scene, and keep reward flow while swapping text badges for portraits and artifact thumbnails. Keep the 3-chapter narrative model intact while layering a 4-page route-sheet UI model on top.

**Tech Stack:** Phaser, Vite, TypeScript, canvas-anchored DOM overlays, existing narrative data packs, local PNG/SVG assets.

---

## File Structure

### New files

- `src/data/routeSheets.ts`
  - Defines the 4 route-sheet pages (`8/8/7/7`) and maps deal ids to page-local point positions.
- `src/scenes/routeSceneLayout.ts`
  - Computes route point placement, safe zones above bottom nav, and page navigation affordances.
- `src/scenes/routeSceneOverlay.ts`
  - DOM overlay HTML for bottom nav, active-point caption, and page navigation helpers.
- `src/scenes/routePointModalOverlay.ts`
  - DOM overlay HTML for the large point modal with tabs for `Запись / Артефакт`.
- `src/scenes/ArchiveScene.ts`
  - Replaces the current diary scene with a two-tab archive screen.
- `src/scenes/archiveSceneOverlay.ts`
  - DOM overlay HTML for archive tabs and headers.
- `src/assets/ui/nav-archive.svg`
- `src/assets/ui/nav-daily-route.svg`
- `src/assets/ui/nav-settings.svg`
- `src/assets/ui/icon-help.svg`
  - Hand-authored navigation and helper icons.
- `docs/specs/2026-04-02-character-portraits.md`
  - Asset brief and prompts for character portraits.

### Modified files

- `src/app/config/gameConfig.ts`
  - Replace `map` with `route` as the main meta scene id, or rebind the existing scene constant cleanly.
- `src/app/bootstrap/createGame.ts`
  - Register the new route and archive scenes.
- `src/scenes/BootScene.ts`
  - Route startup into the new route scene and keep dev previews working.
- `src/scenes/GameScene.ts`
  - Add a `?` rules button and remove rules from bottom-nav assumptions.
- `src/scenes/RewardScene.ts`
  - Replace `Запись / Артефакт / Карта` badges with author portrait / artifact thumbnail while keeping reveal flow.
- `src/scenes/RewardScene.ts`
  - Remove map-detail dependency if route-sheet flow no longer treats map as a reward type.
- `src/scenes/DiaryScene.ts`
  - Either delete after replacement or convert into archive internals if reuse is practical.
- `src/scenes/devPreview.ts`
  - Update preview links if scene ids or archive entry points change.
- `src/services/i18n/locales.ts`
  - Rename diary strings to archive strings and add route-sheet labels.
- `src/data/narrative/rewards.ts`
  - Remove map-reveal emphasis and reclassify old map rewards if needed.
- `src/data/chapters.ts`
  - Keep chapter meaning intact, but add route-sheet addressing if needed.
- `src/data/artifacts.ts`
  - Keep thumbnails / large images and prepare small icon usage on reward cards.
- `src/styles.css`
  - Add route-sheet, route modal, archive tabs, bottom nav, reward portrait/thumb styling, and game help button styles.

### Existing tests to extend

- `src/scenes/rewardRevealItems.test.ts`
- `src/scenes/rewardSceneOverlay.test.ts`
- `src/scenes/devPreview.test.ts`
- `src/scenes/diarySceneOverlay.test.ts`

### New tests to add

- `src/data/routeSheets.test.ts`
- `src/scenes/routeSceneLayout.test.ts`
- `src/scenes/routeSceneOverlay.test.ts`
- `src/scenes/routePointModalOverlay.test.ts`
- `src/scenes/archiveSceneOverlay.test.ts`

---

## Task 1: Define Route-Sheet Data Model

**Files:**
- Create: `src/data/routeSheets.ts`
- Test: `src/data/routeSheets.test.ts`
- Modify: `src/data/chapters.ts`

- [ ] Add a focused route-sheet data module that groups the 30 deal ids into 4 pages: `8/8/7/7`.
- [ ] Include helpers to answer: page by deal id, page unlock state, next playable point, and whether a point is passed/current/future.
- [ ] Write tests for page grouping, next playable point resolution, and the rule that only the next uncompleted point is interactive.
- [ ] Keep chapters untouched as narrative units; do not rewrite chapter ids into 4 pages.
- [ ] Commit just the route-sheet data model and tests.

## Task 2: Replace Map Scene with Route Scene

**Files:**
- Create: `src/scenes/routeSceneLayout.ts`
- Create: `src/scenes/routeSceneOverlay.ts`
- Create: `src/scenes/routeSceneOverlay.test.ts`
- Create: `src/scenes/routeSceneLayout.test.ts`
- Modify: `src/scenes/MapScene.ts` or replace with `src/scenes/RouteScene.ts`
- Modify: `src/app/config/gameConfig.ts`
- Modify: `src/app/bootstrap/createGame.ts`
- Modify: `src/scenes/BootScene.ts`

- [ ] Decide whether to rename the runtime scene class or keep the file path and change only semantics; prefer the least risky path for existing transitions.
- [ ] Build a bottom-to-top route layout with safe spacing above the persistent bottom nav.
- [ ] Show only one page at a time and only allow navigating among unlocked pages.
- [ ] Render three point states: passed, current, future-fogged.
- [ ] Ensure only the current point launches a game; passed points open a modal; future points ignore input.
- [ ] Add the active-point short description near the current point, not as a separate bottom block.
- [ ] Add desktop edge buttons and mobile swipe handling.
- [ ] Commit the new route scene after browser smoke on at least the first two pages.

## Task 3: Build Point Modal with Tabs

**Files:**
- Create: `src/scenes/routePointModalOverlay.ts`
- Create: `src/scenes/routePointModalOverlay.test.ts`
- Modify: route scene file from Task 2
- Reuse: `src/scenes/artifactCardOverlay.ts`
- Reuse: `src/scenes/rewardSceneDetailOverlay.ts`

- [ ] Create a large modal overlay for passed points.
- [ ] If the point has only an entry, show the entry view directly.
- [ ] If the point has only an artifact, show the artifact view directly.
- [ ] If the point has both, default to the entry tab and switch to artifact in-place without closing the modal.
- [ ] Show the full canonical entry text in the entry pane.
- [ ] Reuse the current artifact card presentation where practical, but adapt it to sit inside the point modal system.
- [ ] Commit after browser-checking one point with entry only and one point with entry + artifact.

## Task 4: Rework Diary into Archive

**Files:**
- Create: `src/scenes/ArchiveScene.ts`
- Create: `src/scenes/archiveSceneOverlay.ts`
- Create: `src/scenes/archiveSceneOverlay.test.ts`
- Modify: `src/scenes/DiaryScene.ts` only if reusing internals is cheaper than deleting
- Modify: `src/services/i18n/locales.ts`

- [ ] Replace `Дневник` naming with `Архив` in navigation and UI text.
- [ ] Split the archive into `Записи` and `Артефакты` tabs.
- [ ] In `Записи`, render opened entries with author portraits and open the full-entry modal on tap.
- [ ] In `Артефакты`, keep the artifact grid and artifact card behavior.
- [ ] Remove any remaining route/navigation responsibilities from the archive screen.
- [ ] Commit after browser-checking both tabs.

## Task 5: Move Rules into Game Scene

**Files:**
- Modify: `src/scenes/GameScene.ts`
- Modify: `src/services/i18n/locales.ts`
- Modify: `src/styles.css` if DOM overlay or help icon styling is needed

- [ ] Add a visible `?` affordance on the solitaire screen.
- [ ] Open a compact rules modal from inside the game scene.
- [ ] Remove `Правила` from the route bottom nav assumptions.
- [ ] Keep the modal lightweight and non-destructive to current game state.
- [ ] Commit after a quick in-browser open/close smoke test.

## Task 6: Bottom Navigation and Icon Assets

**Files:**
- Create: `src/assets/ui/nav-archive.svg`
- Create: `src/assets/ui/nav-daily-route.svg`
- Create: `src/assets/ui/nav-settings.svg`
- Create: `src/assets/ui/icon-help.svg`
- Modify: route scene overlay file
- Modify: archive scene overlay file if needed
- Modify: boot/preload scene if explicit loading is required

- [ ] Draw the 4 small SVG icons in a single restrained archival style.
- [ ] Keep them simple, readable, and reusable at small sizes.
- [ ] Wire them into the persistent bottom nav and the in-game rules trigger.
- [ ] Keep labels under icons for route-screen bottom nav.
- [ ] Commit after a visual browser check on desktop and mobile viewport.

## Task 7: Character Portrait Content Pipeline

**Files:**
- Create: `docs/specs/2026-04-02-character-portraits.md`
- Create later at implementation time if generated: `src/assets/portraits/master/*`, `src/assets/portraits/ui/*`
- Modify: whichever scene files consume portraits (`RewardScene.ts`, `ArchiveScene.ts`, point modal overlay)

- [ ] Write the portrait asset brief and prompts for the 5 expedition members.
- [ ] Define file naming and target UI sizes before generation.
- [ ] Add portrait placeholders or temporary silhouette fallbacks so implementation is not blocked by missing art.
- [ ] Use portraits in reward cards, point entry modal, and archive entry list.
- [ ] Commit the asset brief and placeholder wiring separately from final generated art.

## Task 8: Update Reward Scene Visual Language

**Files:**
- Modify: `src/scenes/RewardScene.ts`
- Modify: `src/scenes/rewardSceneOverlay.ts`
- Modify: `src/scenes/rewardSceneOverlay.test.ts`
- Modify: `src/styles.css`

- [ ] Keep the current reward reveal structure and `Вы нашли` flow.
- [ ] Replace the `Запись` badge treatment with the author portrait.
- [ ] Replace the `Артефакт` badge treatment with a small artifact image.
- [ ] Remove the map-reward visual emphasis; any former map reward should now behave as route/entry-adjacent content per the new meta model.
- [ ] Commit after browser-checking at least two reward preview cases.

## Task 9: Daily Route Entry Point

**Files:**
- Modify: route scene file
- Modify: `src/scenes/BootScene.ts` if needed
- Modify: `src/services/i18n/locales.ts`

- [ ] Keep `Маршрут дня` reachable from the new persistent bottom nav.
- [ ] Ensure it still jumps into daily solitaire flow without interfering with campaign route progress.
- [ ] Preserve current daily claim rules and existing reward logic unless a later spec changes them.
- [ ] Commit after manual smoke test of the daily entry path.

## Task 10: Final Integration, Docs, and Verification

**Files:**
- Modify: `docs/specs/UI_FLOW.md`
- Modify: any affected specs that now reference `Дневник` or old map-first assumptions
- Test: full suite

- [ ] Update `UI_FLOW.md` to reflect `Маршрут -> игра -> награда`, `Архив`, and in-game rules.
- [ ] Search for stale `Дневник` and old map-first wording in specs and runtime strings.
- [ ] Run full test suite and build.
- [ ] Do browser smoke for: route screen, point modal, archive tabs, reward screen, game rules modal.
- [ ] Only after all of the above, prepare the branch for commit batching.

---

## Self-Review

### Spec coverage

Covered:
- route-sheet main screen
- 4 pages `8/8/7/7`
- passed/current/future point states
- large point modal with entry/artifact switching
- archive with 2 tabs
- bottom nav with `Архив / Маршрут дня / Настройки`
- rules moved into game scene
- portraits in reward, archive, and entry contexts
- reward screen keeps structure but swaps visuals

Open dependency, but not a spec gap:
- portraits need asset generation, so the plan includes placeholder wiring plus a portrait brief task.

### Placeholder scan

No `TBD`, `TODO`, or “implement later” markers remain in the plan body.

### Type consistency

Consistent naming across tasks:
- `route sheet`
- `ArchiveScene`
- `route point modal`
- `Маршрут дня`
- `passed/current/future`

No conflicting alternative names are used for the main replacement screen.
