Most R1 blockers are addressed. The plan is converging, but these risks remain.

## Prior-concern-not-closed

[MAJOR] 1) SDK confirmation freshness is still underspecified. Plan passes `sdkUnlockedTags` and says reuse `sdk.getPlayerAchievements()`, but does not say when `fetchAchievements()` runs, whether stale SDK data is acceptable, or how errors are handled. 2) UI may show missing confirmations or throw in GP sandbox/network failure. 3) Render from compute immediately; wrap SDK confirmation in try/catch; if needed call/fan-in `fetchAchievements()` async and rerender confirmation only.

[MAJOR] 1) Hidden locked fallback can still leak spoilers: CSS grayscale on the real icon exposes achievement theme/condition. 2) This violates the “fully masked” hidden-achievement requirement. 3) Use a shared generic locked icon/silhouette as fallback; never render the real icon for `hidden && !unlocked`.

[MAJOR] 1) Map top-bar collision risk is only partially closed. Trophy stack is described, but exact offsets/safe-area/z-index and top-left coin collision with existing UI are not specified. 2) Mobile route labels and existing buttons can overlap. 3) Add concrete CSS positions with `env(safe-area-inset-*)`, z-index, and mobile screenshot QA.

[MINOR] 1) Analytics is missing in the TitleScene modification section. Map handler tracks `achievements_open`, Title handler does not. 2) Verification expects `origin=title/map`, but implementation may only emit map. 3) Add `analytics.track("achievements_open", { origin: "title" })` to the Title click path.

[MINOR] 1) i18n key count is inconsistent: plan says 43, but listed keys are 50 (`4 + 6 + 20 + 20`). 2) This can produce missing locale keys/tests. 3) Replace the count with an exact key table and assert all ru/en keys exist.

## New-concern-introduced

[MAJOR] 1) Asset source is `dist/achievement-icons/`, but `dist` is normally generated/cleaned output. 2) Fresh checkout/CI/prebuild can fail before icons exist. 3) Move source PNGs to a stable tracked source folder, or commit `public/assets/achievements/` directly and make sync optional.

[MAJOR] 1) Availability policy contradicts itself. Title shows achievements when `prologueShown`; Map uses `sdk.canUseAchievements()`; QA says Yandex should show neither; offline QA says compute-only UI works. 2) Different entry points may disagree, and unsupported SDK builds may hide a perfectly local UI. 3) Define one rule: either UI is local and always shown after prologue, with SDK confirmation optional; or gate both Title and Map by the same capability.

[MAJOR] 1) Parallel `launch + pause` leaves parent DOM overlays alive unless explicitly covered/disabled. 2) Because overlay hosts use `pointer-events: none`, clicks/touches may pass through gaps to paused Title/Map buttons. 3) Achievements overlay needs a full-screen modal root/backdrop with `pointer-events: auto`, or parent overlay interactivity must be disabled while open.

[MAJOR] 1) SDK-unlocked-but-compute-incomplete display state is unclear. 2) A card can show ✓ unlocked while progress still says 30%, which looks broken. 3) If confirmation says unlocked, force display progress to max/100% or hide completed progress.

[MINOR] 1) `safeImageUrl` as “starts with `./assets/achievements/`” is too loose. 2) Traversal/encoded paths or future dynamic icon keys can bypass intent. 3) Validate basename with a strict pattern like `^[a-z0-9_-]+(_locked)?\\.png$`, then construct the path internally.

CONCERNS REMAIN