# Decision log — round 6

Reviewer: codex. Verdict: CONCERNS REMAIN. 1 MAJOR. Принят.

Prior R5 concern подтверждён закрытым.

## R6 concerns

### MAJOR 1: SDK progress >= max но unlocked=false — durable suppressor

**Codex прав.** Сценарий:
- SDK list возвращает `{ tag: "coins_500", progress: 500, unlocked: false }` (несогласованное GP-состояние, может быть transient).
- Текущий код: `progress > lastProgress` → `lastProgress.set(500)` + `persistProgress(500)`. `unlockedCache` НЕ trigger'ится.
- Future reconcile: `capped=Math.min(500, 500)=500`, `last=500` → `if (capped <= last) continue` → setProgress НЕ отправляется → achievement никогда не unlock'ится локально.

Аналогично: `progress > max` (например, `progress: 600` при `max=500`) — `lastProgress` становится 600, никогда не упадёт обратно в логику.

**Fix:** в bootstrap-merge нормализовать SDK progress по metadata:

```ts
// Build meta map для O(1) lookup в merge.
const metaByTag = new Map(ACHIEVEMENTS.map((m) => [m.tag, m]));

const list = this.sdk.getPlayerAchievements();
for (const { tag, progress, unlocked } of list) {
  const meta = metaByTag.get(tag);
  // Если tag не в нашем списке — игнорируем (защита от orphan SDK ачивок).
  if (!meta) continue;

  // Clamp SDK progress по нашему max'у.
  const clamped = meta.max !== undefined
    ? Math.min(progress, meta.max)
    : progress;

  // R6 fix M1: progress >= max ИЛИ SDK unlocked=true → treat as unlocked.
  const effectivelyUnlocked =
    unlocked || (meta.max !== undefined && clamped >= meta.max);

  if (effectivelyUnlocked) {
    if (!this.unlockedCache.has(tag)) {
      this.unlockedCache.add(tag);
    }
    if (!persistedUnlocked[tag]) {
      this.persistUnlocked(tag);
    }
  } else if (clamped > (this.lastProgress.get(tag) ?? 0)) {
    this.lastProgress.set(tag, clamped);
    this.persistProgress(tag, clamped);
  }
}
```

Тест R6:
- SDK list: `[{ tag: "coins_500", progress: 500, unlocked: false }]` (несогласованное).
- Bootstrap → assert: `unlockedCache.has('coins_500')`, `persistUnlocked` called.
- Симулируем новую сессию с persisted state и empty SDK list → reconcile НЕ должен слать setProgress (skip-by-cap-and-already-unlocked).
- SDK list: `[{ tag: "coins_500", progress: 600, unlocked: false }]` (over-max) → clamped=500 → also unlock + persist.
- SDK list: `[{ tag: "unknown_orphan", progress: 100, unlocked: true }]` → нет в metaByTag → ignored, `persistUnlocked` НЕ called.

## Применяю в draft-r7 (последний round перед stalled-cap).
