# Decision log — round 4

Reviewer: codex. Verdict: CONCERNS REMAIN. 2 MAJOR. Оба приняты.

## R4 concerns

### MAJOR 1: pendingDesired re-check всё ещё может потерять newer progress

**Codex прав.** Мой R3 fix:
```ts
.then((ok) => {
  const latestDesired = this.pendingDesired.get(tag) ?? capped;
  if (ok && latestDesired > capped) this.reconcile(state); // ❌ pendingDesired[tag] ещё есть
})
.finally(() => { this.pendingDesired.delete(tag); }); // delete только после .then
```

Внутри recursive `reconcile(state)`:
- `pendingDesired.has(tag) === true` → попадает в early-return
- `if (capped > prev)` — capped 2000, prev 2000 → не update'ит
- continue → НЕ шлёт setProgress

Потом `finally` чистит pending — но никто больше reconcile не зовёт.

**Fix:** убрать .finally, drain напрямую в .then через helper `writeProgress`:

```ts
private writeProgress(tag: string, capped: number, max: number, state: ReconcileState): void {
  this.pendingDesired.set(tag, capped);
  void this.sdk.setAchievementProgress(tag, capped)
    .then((ok) => {
      const latestDesired = this.pendingDesired.get(tag) ?? capped;
      if (ok) {
        this.lastProgress.set(tag, capped);
        this.persistProgress(tag, capped);
        if (capped >= max) {
          this.unlockedCache.add(tag);
          this.persistUnlocked(tag);
        }
      }
      // ВАЖНО: delete ДО recursive вызова, чтобы next call мог пройти.
      this.pendingDesired.delete(tag);
      // Drain к latest если есть рост и ещё не достигли max.
      if (ok && latestDesired > capped && capped < max) {
        this.writeProgress(tag, Math.min(latestDesired, max), max, state);
      }
    })
    .catch((err) => {
      this.pendingDesired.delete(tag);
      console.warn("[ach] setProgress threw", tag, err);
    });
}
```

Тест должен падать на R3-реализации и проходить на R4-fix:
- `setProgress` mock: первый вызов resolve через 50ms, второй через 50ms.
- Reconcile с desired=1900 → setProgress(1900) in-flight.
- Reconcile с desired=2050 → pendingDesired.set(tag, 2000); skip-with-update.
- Через 50ms первый resolve → reads `pendingDesired.get(tag) = 2000` → drain → setProgress(2000).
- Assert: `setProgressMock.mock.calls.length === 2`, второй вызов с `2000`.

### MAJOR 2: async bootstrap окно — persisted cache не seed'ится до await

**Codex прав.** `bootstrap()`:
```ts
async bootstrap(state) {
  await this.sdk.fetchAchievements(); // ⏳ N миллисекунд
  // только сейчас seed persisted...
  for (const tag of Object.keys(state.progress.achievementUnlocked ?? {})) {
    this.unlockedCache.add(tag);
  }
}
```

BootScene: `void bootstrap(...)` → fire-and-forget. Если в окне между запуском
bootstrap и завершением fetch произойдёт `reconcile(...)` (например, GameScene
сразу запустит игру и дойдёт до coins-reconcile через ad-bonus) — `unlockedCache`
пустой → reconcile отправит unlock для уже-unlocked one-shot ачивок.

**Fix:** seed persisted ДО await, merge SDK list ПОСЛЕ:

```ts
async bootstrap(state: ReconcileState): Promise<void> {
  if (!this.sdk.canUseAchievements()) return;
  // R4 fix M2: seed persisted синхронно ДО await — закрывает окно гонки.
  const persistedUnlocked = state.progress.achievementUnlocked ?? {};
  for (const tag of Object.keys(persistedUnlocked)) {
    this.unlockedCache.add(tag);
  }
  const persistedProgress = state.progress.achievementProgress ?? {};
  for (const [tag, value] of Object.entries(persistedProgress)) {
    if (!this.unlockedCache.has(tag)) {
      this.lastProgress.set(tag, value);
    }
  }
  // Теперь fetch — за N мс reconcile может прийти, но cache уже разогрет.
  await this.sdk.fetchAchievements();
  // Merge SDK list — может расширить cache (например, unlock на другом устройстве).
  const list = this.sdk.getPlayerAchievements();
  for (const { tag, progress, unlocked } of list) {
    if (unlocked) this.unlockedCache.add(tag);
    else if (progress > (this.lastProgress.get(tag) ?? 0)) {
      this.lastProgress.set(tag, progress);
    }
  }
  this.reconcile(state);
}
```

Тест: симулировать `fetchAchievements` resolve через 100ms; persisted
`achievementUnlocked = { first_share: true }`; в момент `t=50ms` вызвать
`reconciler.reconcile({ progress })` где compute(first_share) === true →
`setProgress`/`unlock` НЕ должен вызваться.

## Применяю в draft-r5.
