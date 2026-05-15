# Decision log — round 5

Reviewer: codex. Verdict: CONCERNS REMAIN. 1 MAJOR. Принят.

Prior R4 concerns подтверждены закрытыми:
- pendingDesired drain — closed (writeProgress helper).
- Bootstrap persisted seed race — closed (sync seed до await).

## R5 concerns

### MAJOR 1: SDK bootstrap merge не persisted локально

**Codex прав.** Текущий код:
```ts
// После await fetchAchievements
const list = this.sdk.getPlayerAchievements();
for (const { tag, progress, unlocked } of list) {
  if (unlocked) this.unlockedCache.add(tag);  // ← только in-memory
  else if (progress > (this.lastProgress.get(tag) ?? 0)) {
    this.lastProgress.set(tag, progress);     // ← только in-memory
  }
}
```

Сценарий потери данных:
1. Сессия 1, device A: unlock `first_share` → persisted в save A.
2. Cloud-save sync → device B видит save с `achievementUnlocked.first_share`.
   ✓ Это покрыто R3 fix M3.
3. Сценарий хуже: unlock `first_share` сделан на device A в playerAchievementsList,
   но НЕ в нашем save (например, если SDK был unlock'нут вручную через
   дашборд, или save sync ещё не дошёл — а GP-side state дошёл).
4. Сессия 2, device B: bootstrap → SDK list содержит first_share (unlocked=true)
   → unlockedCache в RAM. Persisted save device B всё ещё БЕЗ first_share.
5. Сессия 3, device B: bootstrap → SDK list пустой (network glitch) →
   unlockedCache пустой → reconcile отправляет unlock(first_share) ещё раз.

**Fix:** в bootstrap-merge persist'ить SDK-truth локально:

```ts
// Merge SDK list ПОСЛЕ await:
const list = this.sdk.getPlayerAchievements();
for (const { tag, progress, unlocked } of list) {
  if (unlocked) {
    if (!this.unlockedCache.has(tag)) {
      this.unlockedCache.add(tag);
      // R5 fix M1: persist в save если ещё не было.
      if (!persistedUnlocked[tag]) {
        this.persistUnlocked(tag);
      }
    }
  } else if (progress > (this.lastProgress.get(tag) ?? 0)) {
    this.lastProgress.set(tag, progress);
    // R5 fix M1: persist progress если SDK знает больше.
    this.persistProgress(tag, progress);
  }
}
```

Тест R5:
- mock `getPlayerAchievements()` возвращает `[{tag: "first_share", unlocked: true}, {tag: "coins_500", progress: 250}]`.
- save state.progress.achievementUnlocked = {} (ничего не было).
- bootstrap → assert: `persistUnlocked` called with `"first_share"`,
  `persistProgress` called with `("coins_500", 250)`.
- Затем симулировать новую сессию с пустым SDK list, но persisted состоянием
  от прошлого bootstrap → reconcile НЕ должен слать unlock/setProgress
  для first_share/coins_500.

## Применяю в draft-r6.
