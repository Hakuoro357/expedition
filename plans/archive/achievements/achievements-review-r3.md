[MAJOR] prior-concern-not-closed: `pendingDesired` всё ещё теряет более новый progress.
1. При первом `reconcile(coins=1900)` ставится `pendingDesired=1900`; при втором `reconcile(coins=2050)` карта обновляется до `2000`, но после resolve код делает `pendingDesired.delete(tag)` и пересчитывает `meta.compute(state)` по старому closure-state.
2. Сценарий из prior review всё ещё может не отправить `2000`, если больше событий не будет.
3. После resolve читать latest из `pendingDesired` до удаления и отправлять его, либо хранить `getCurrentState()` в reconciler. Тест должен передать новый state во время in-flight и проверить второй `setProgress(2000)`.

[MAJOR] new-concern-introduced: неверный namespace GamePush для bootstrap seed.
1. План пишет, что `getPlayerAchievements` читает `this.gp?.socials?.playerAchievementsList`. В официальной typed docs это `gp.achievements.playerAchievementsList`; `socials` тут не участвует.
2. Seed unlocked/progress cache будет пустым, bootstrap станет шумным и может повторно слать уже открытые достижения.
3. Использовать только `gp.achievements.*`; добавить тип `achievements?: GamePushAchievements` в `GamePushSDK` и mock-тест, который падает при обращении к `socials`.

[MAJOR] prior-concern-not-closed: fallback при недоступном `playerAchievementsList` неполный.
1. `achievementProgress` покрывает только progress-achievements; successful one-shot unlocks локально не persistятся.
2. Если список GP пустой/не загружен, `sharedEver/communityJoinedEver/noUndoWinEver/noHintWinEver` будут повторно дергать unlock каждый bootstrap.
3. Либо делать `await gp.achievements.fetch()` перед чтением списка, либо persist `achievementUnlocked: Record<tag, true>` после успешного unlock и seed’ить `unlockedCache` из него. Лучше оба.

[MAJOR] new-concern-introduced: boolean SDK result смешивает “write accepted” и “achievement unlocked”.
1. GP docs показывают, что `setProgress`/`unlock` возвращают `Promise<UnlockPlayerAchievementOutput>`, не boolean. Reconciler трактует `ok=true` как “можно коммитить cache”.
2. Если wrapper вернёт `false` для partial progress, который ещё не unlock’нул achievement, `lastProgress` не обновится и progress будет ретраиться.
3. Зафиксировать семантику: `true` = SDK write accepted, независимо от unlock; либо вернуть `{ ok, unlocked }`. Добавить тест на partial `setProgress(3/10)`.

[MAJOR] new-concern-introduced: миграция `hintCount` для legacy `currentGame` не привязана к порядку validation/sanitize.
1. План говорит “sanitizeGameState нормализует legacy”, но текущий `SaveService` сначала валидирует cloud save, и только потом sanitizes progress/current snapshot.
2. Если `hintCount` станет обязательным в `isValidGameState`, старые активные партии без `hintCount` будут сброшены в `null`.
3. `isValidGameState` должен принимать missing `hintCount`, а `sanitizeGameState` должен выставлять `0` до сохранения snapshot. Нужен тест legacy cloud save с `currentGame` без `hintCount`.

[MINOR] new-concern-introduced: in-flight maps могут зависнуть при unexpected rejection.
1. Reconciler использует `.then(...)` без `.catch/.finally`; план надеется, что SDK wrapper всегда вернёт `false`.
2. Один необработанный reject оставит tag в `pendingDesired` или `pendingUnlocks`, и retry в этой сессии будет заблокирован.
3. В reconciler делать `.catch(() => false).then(...).finally(...)` или `void this.runProgressWrite(...)` с внутренним `try/finally`.

Источник для GP API: официальная typed docs GamePush показывают `GamePush.achievements`, `Achievements.playerAchievementsList`, `setProgress`, `unlock`: https://gamepush.com/sdk/docs/classes/Achievements.html

CONCERNS REMAIN