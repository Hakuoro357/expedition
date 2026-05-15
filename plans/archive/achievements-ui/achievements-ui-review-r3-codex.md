[MAJOR] prior-concern-not-closed: 1) TitleScene availability is still contradictory: the unified rule says `sdk.canUseAchievements() && prologueShown`, but “Files to modify / TitleScene.ts” still says `showAchievementsButton = state.progress.prologueShown`. 2) Implementer can follow the stale section and expose a dead button on Yandex/unsupported SDK builds. 3) Update every TitleScene mention, including button order text, to require both `sdk.canUseAchievements()` and `prologueShown`.

[MAJOR] prior-concern-not-closed: 1) Map top-bar collision risk is still not concretely closed. The plan says “under mute/community”, but does not define exact `top/right`, safe-area offsets, z-index, vertical gaps, or left coin placement against route labels. 2) Mobile route labels/current route UI can still overlap with coins/trophy stack. 3) Add concrete CSS positions, e.g. shared `--top-action-size`, `--top-action-gap`, `top: calc(env(safe-area-inset-top) + Npx)`, and screenshot QA for narrow mobile.

[MINOR] prior-concern-not-closed: 1) The solution overview still says Map trophy “passes `currentPage`” after the detailed sections correctly dropped `mapData`. 2) This keeps the false contract alive. 3) Remove that phrase and state only that pause/resume preserves `currentPage`.

[MAJOR] new-concern-introduced: 1) Async SDK confirmation can re-render after the achievements scene has been closed. 2) If `fetchAchievements()` resolves after Back, code may call `renderFromVm` on destroyed DOM handles or recreate stale UI. 3) Add a scene lifecycle guard: set `isClosed` on `shutdown/destroy`, check before re-render, and clean listeners/overlay in shutdown.

[MAJOR] new-concern-introduced: 1) The clamp formula uses `meta.max` for all achievements, but one-shot achievements explicitly have no `max`. 2) One-shot cards can produce `undefined`/`NaN` progress or wrong display state. 3) Make VM logic discriminated: only compute `displayProgress/displayPct/progressbar` when `typeof meta.max === "number"`; one-shot achievements should have no progress fields.

[MAJOR] new-concern-introduced: 1) `ACHIEVEMENT_UI_META` is manually separated from `ACHIEVEMENTS`, but there is no required parity test. 2) A typo, duplicate, or missing tag silently drops an achievement from UI or creates a card with no compute source. 3) Add a unit test asserting UI meta tags exactly equal `ACHIEVEMENTS.map(a => a.tag)`, with 20 unique tags and valid group tags.

[MAJOR] new-concern-introduced: 1) Public PNG paths are runtime strings, but verification does not assert that every `iconKey` file and `locked-generic.png` actually exists in `public/assets/achievements/`. 2) Build can pass while the shipped UI has broken icons. 3) Add a filesystem test for all expected PNGs and keep it in `npm test`.

[MINOR] new-concern-introduced: 1) Overlay params require `ariaLabels.progressbar`, but the exact i18n list has no progressbar label key. 2) Implementation may add an untracked key, hardcode English/Russian, or pass undefined. 3) Either add a fifth UI key and update count to 51, or remove that param and use each achievement title as the progressbar accessible label.

CONCERNS REMAIN