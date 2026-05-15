# Decision log — round 2

Reviewer: codex. Verdict: CONCERNS REMAIN. 4 MAJOR + 1 MINOR.
Все принято.

## R2 concerns

### MAJOR 1: character entry max не совпадают с данными
**Verified:** проверил grep'ом entries.ru.ts:
- leader: **13** (план говорил 10)
- cartographer: **4** (план говорил 5)
- archaeologist: **6** ✓
- quartermaster_guide: **3** ✓
- photographer_archivist: **4** ✓
- Сумма: 13+4+6+3+4 = **30** ✓

**Fix:** entries_voronov.max 10 → **13**, entries_mirskaya.max 5 → **4**.
Добавить тест `entries[*].max === countEntriesByEntity(allCompletedNodes, entityId)` для всех 5 авторов.

### MAJOR 2: transient SDK failure теряет ephemeral one-shot facts
Если `unlock('first_share')` вернёт false, событие `shareJustSucceeded` уже унеслось — следующего share может никогда не быть. Особенно критично для редких событий (community-join, no_hint_win, no_undo_win).

**Fix:** добавить durable booleans в save state:
```ts
progress.achievementFacts = {
  sharedEver: boolean,
  communityJoinedEver: boolean,
  noUndoWinEver: boolean,
  noHintWinEver: boolean,
}
```
При событии — set true + save. Reconcile compute() читает из progress.achievementFacts. SaveService.sanitize даёт fallback `{}` для legacy saves.

### MAJOR 3: `pending` drops newer progress
Если `coins_2000` отправил 1900 (in-flight), и до резолва баланс вырос до 2050, второй reconcile skip'ит из-за pending. После success commit = 1900, max=2000 не достигнут, последующих событий может не быть.

**Fix:** заменить `Set<string>` pending на `Map<string, number>` `pendingDesiredProgress`. После success — сравниваем latest desired (computed снова) vs committed; если desired > committed → отправляем сразу второй вызов с актуальным значением.

```ts
private pendingDesired = new Map<string, number>();
// ...
this.pendingDesired.set(meta.tag, capped);
void this.sdk.setAchievementProgress(meta.tag, capped).then((ok) => {
  this.pendingDesired.delete(meta.tag);
  if (ok) {
    this.lastProgress.set(meta.tag, capped);
    if (capped >= meta.max!) this.unlockedCache.add(meta.tag);
    // Re-check: вырос ли desired пока мы ждали?
    const latestDesired = Math.min(meta.compute(currentState), meta.max!);
    if (latestDesired > capped) {
      void this.reconcile(currentState); // recursive trigger
    }
  }
});
```

### MAJOR 4: gating всё ещё не использует `actualWinApplied`
RewardScene имеет path'ы где completeNode НЕ вызывается (replay уже-пройденного узла без returnFromDetail). Гейт `!preview && !returnFromDetail` пропускает их.

**Fix:** в RewardScene.create() явный флаг:
```ts
const wasAlreadyCompleted = save.load().progress.completedNodes.includes(dealId);
const nodeJustCompleted =
  !data.preview &&
  !data.returnFromDetail &&
  mode === "adventure" &&
  !wasAlreadyCompleted;
// ...
if (nodeJustCompleted) {
  save.completeNode(dealId, ...);
  ach.reconcile({ progress: save.load().progress, lastWin: data.lastWin });
}
// Coins-trigger срабатывает отдельно, не зависит от nodeJustCompleted
```

Симметрично для daily-claim path: `dailyJustClaimed` boolean.

### MAJOR 5: getAchievementProgress fallback unsafe
Codex предлагает persist lastProgress в save state как resilience.

**Fix:** использовать sync property `gp.achievements.playerAchievementsList` (per GP-доке — sync FREE) для seed'а cache при bootstrap. Это canonical source of truth от SDK. Если list пустой / SDK не доступен — assume 0, на следующих reconcile неувеличившиеся values пропускаются нашим cap-и-skip. Quota-burn limited.

Дополнительная защита: persist `lastProgress` в `progress.achievementProgress` Map (key=tag, value=number). На bootstrap — preferred source: SDK list, fallback: persisted map.

### MINOR 1: LastWinContext unused fields
Поля `artifactJustAwarded`, `entryJustOpened` не используются ни одной meta.compute().

**Fix:** удалить из типа `LastWinContext`. Если понадобятся — добавим точечно.

## Summary

5 правок:
1. entries_voronov.max 10→13, entries_mirskaya.max 5→4 + test
2. progress.achievementFacts durable booleans
3. Map<string, number> pendingDesired + re-check после resolve
4. nodeJustCompleted explicit boolean в RewardScene
5. playerAchievementsList для seed + persist lastProgress
6. Удалить unused fields из LastWinContext

Применяю в draft-r3.
