# Decision log — round 3

Reviewer: codex. Verdict: CONCERNS REMAIN. 5 MAJOR + 1 MINOR. Все принято.

## R3 concerns

### MAJOR 1: pendingDesired closure-state pattern не работает
В моём коде после resolve re-check читает через `meta.compute(state)`,
где `state` — closure-захвачен на момент ПЕРВОГО reconcile-call'а. Второй
reconcile с обновлённым state не виден resolve-callback'у.

**Fix:** читать новейшее значение прямо из `pendingDesired` map перед
удалением:
```ts
void this.sdk.setAchievementProgress(tag, capped).then((ok) => {
  const finalCapped = this.pendingDesired.get(tag) ?? capped; // latest
  this.pendingDesired.delete(tag);
  if (ok) {
    this.lastProgress.set(tag, capped);
    if (capped >= meta.max) this.unlockedCache.add(tag);
    // Re-check — finalCapped уже учитывает latest reconcile
    if (finalCapped > capped) {
      void this.sdk.setAchievementProgress(tag, finalCapped).then(...);
    }
  }
});
```

При втором reconcile во время in-flight: `pendingDesired.has(tag) === true`
→ skip-with-update (`pendingDesired.set(tag, latestCapped)`). После resolve
читаем latest и шлём.

### MAJOR 2: typo namespace `gp.socials.playerAchievementsList`
В плане я ошибочно написал `this.gp?.socials?.playerAchievementsList`.
Per GP docs (https://gamepush.com/sdk/docs/classes/Achievements.html):
правильно `this.gp?.achievements?.playerAchievementsList`.

**Fix:**
- env.d.ts добавить `achievements?: GamePushAchievements` в `GamePushSDK`.
- GamePushSdkService — все вызовы через `this.gp?.achievements?.*`.
- Тест-mock GamePushSDK что обращение к `socials.playerAchievementsList` undefined
  (защита от регрессии typo).

### MAJOR 3: fallback для one-shot unlocks неполный
Кэш `unlockedCache` только in-memory. После refresh не persisted. Если
SDK list пустой/недоступен И мы только что unlock'нули `first_share` —
на bootstrap retry'ним unlock (idempotent на стороне SDK, но шумно
+ потенциальная quota burn).

**Fix:**
1. Persist `progress.achievementUnlocked: Record<string, true>` после
   каждого successful unlock.
2. Bootstrap: seed `unlockedCache` из union (playerAchievementsList ∪
   achievementUnlocked).
3. Перед чтением `playerAchievementsList` сделать `await gp.achievements.fetch()` —
   гарантия свежих данных. Это `Promise<{...}>` FREE-метод (ставшийся
   deprecated, но всё ещё работающий per docs).

### MAJOR 4: boolean SDK result conflates "write accepted" vs "achievement unlocked"
GP wrappers возвращают `Promise<UnlockPlayerAchievementOutput>` (object).
Я упростил до `Promise<boolean>` — потерял разделение «write принят» vs
«achievement unlocked».

Конкретный кейс: `setProgress(chapter_1_complete, 3)` — write accepted
(ok=true) но achievement unlocked === false (3 < 10). Если wrapper
возвращает false (потому что unlocked=false), Reconciler НЕ обновляет
`lastProgress` → следующий reconcile повторяет setProgress(3) → +1 quota
впустую.

**Fix:** определить семантику явно:
```ts
// SDK wrapper возвращает true если SDK write принял (без error). Unlock
// определяется отдельно через hasAchievement или из объекта response.
unlockAchievement(tag): Promise<boolean>;
setAchievementProgress(tag, progress): Promise<boolean>;
```
В коде GamePushSdkService:
```ts
async setAchievementProgress(tag, progress): Promise<boolean> {
  if (!this.gp?.achievements) return false;
  try {
    const result = await this.gp.achievements.setProgress({ tag, progress });
    return Boolean(result?.success ?? true);
    // success — поле UnlockPlayerAchievementOutput. fallback `true`
    // если поля нет — write дошёл без error.
  } catch (e) {
    console.warn("[gp] achievements.setProgress failed", e);
    return false;
  }
}
```
Reconciler коммитит lastProgress на `ok=true` независимо от unlock-status.
Unlock-status проверяется через `progress >= meta.max` (наша cap-логика).

Тест: `setProgress(chapter_1, 3)` → `ok=true` → `lastProgress=3`,
`unlockedCache` без изменений. `setProgress(chapter_1, 10)` → `ok=true` +
`capped >= max` → `lastProgress=10`, `unlockedCache.add('chapter_1')`.

### MAJOR 5: hintCount migration order не зафиксирован
План говорит «sanitizeGameState нормализует hintCount=0 для legacy», но
не уточняет порядок: сначала валидация принимает legacy (без обязательного
поля), потом санитизер добавляет default.

**Fix:** явный порядок в SaveService.init:
1. `JSON.parse(json)` → `parsed`.
2. `isValidSaveState(parsed)` — проверяет ProgressState, currentGame
   опционально валидируется через `isValidGameState` где `hintCount`
   **optional** (no enforcement).
3. Если valid → `parsed.currentGame = parsed.currentGame ? sanitizeGameState(parsed.currentGame) : null` —
   санитайзер выставляет `hintCount: g.hintCount ?? 0`.

Тест: legacy cloud save string без `hintCount` в currentGame → после
init `state.currentGame.hintCount === 0` AND `state.currentGame !== null`.

### MINOR 1: in-flight maps могут зависнуть при unexpected reject
`.then()` без `.catch/.finally` — uncaught reject оставляет tag в
pending/pendingUnlocks навсегда (до refresh).

**Fix:** добавить `.catch().finally()`:
```ts
void this.sdk.setAchievementProgress(tag, capped)
  .then((ok) => { /* commit */ })
  .catch((err) => { console.warn("[ach] setProgress threw", err); })
  .finally(() => {
    // pending удаляется в любом случае
    if (this.pendingDesired.get(tag) === capped) {
      this.pendingDesired.delete(tag);
    }
  });
```
Аналогично для `pendingUnlocks.delete(tag)` в finally.

Хотя GamePushSdkService.setAchievementProgress уже возвращает `false` на
error (try/catch внутри), defense-in-depth для случаев когда wrapper
сам throw'нул нечто непредвиденное (typo, undefined.prop chain).

## Применяю в draft-r4
