Prior concerns are mostly addressed, but I still see real implementation risks.

[MAJOR] new-concern-introduced: 1) The CSS uses multiplication inside `calc()`: `(... + var(--top-action-gap)) * 2`. 2) This can be invalid or poorly supported in target WebView/Yandex Chromium variants; if invalid, trophy positioning may break and reintroduce top-bar collision. 3) Avoid `*`: define `--top-action-step: calc(var(--top-action-size) + var(--top-action-gap))` and write the second offset as `+ var(--top-action-step) + var(--top-action-step)`.

[MAJOR] new-concern-introduced: 1) VM tests say one-shot achievements are “unlocked iff `compute()===true`”, but the design also merges `sdkUnlockedTags` and `persistedUnlocked`. 2) Cross-device or SDK-confirmed one-shot achievements can appear locked if local progress no longer proves them. 3) Use one unified rule for all achievements: `isUnlocked = computeUnlocked || sdkUnlockedTags.has(tag) || persistedUnlocked[tag] === true`; only progressbar fields should be conditional on `meta.max`.

[MAJOR] new-concern-introduced: 1) PNG existence test checks `ACHIEVEMENTS` tags, but UI actually renders `ACHIEVEMENT_UI_META.iconKey`. 2) A typo in `iconKey` can pass parity tests and still ship broken icons. 3) Either remove `iconKey` and derive filename from `tag`, or add a test that every `ACHIEVEMENT_UI_META.iconKey + ".png"` exists and matches allowed basename rules.

[MINOR] prior-concern-not-closed: 1) `TitleScene button order` still says “Достижения (if prologueShown)” without the SDK gate. 2) Most authoritative sections are now correct, but this remains a stale contradictory instruction. 3) Change both button-order bullets to “if `sdk.canUseAchievements() && prologueShown`”.

CONCERNS REMAIN