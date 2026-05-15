# GamePush Achievements integration plan (v0.3.56) — round 5

## Round 1 + 2 + 3 + 4 итог

R1: 1 CRITICAL + 11 MAJOR + 5 MINOR + Reconciler architecture. Все принято.
R2: 4 MAJOR + 1 MINOR. Все приняты:
1. character entry max'ы исправлены: leader=13, cartographer=4, archaeologist=6, quartermaster_guide=3, photographer_archivist=4 (verified by grep entries.ru.ts).
2. Добавлен `progress.achievementFacts` для durable одноразовых фактов.
3. `pendingDesired: Map<string, number>` + re-check после resolve.
4. Explicit `nodeJustCompleted` boolean в RewardScene (вместо неточного preview/returnFromDetail).
5. Bootstrap seed через sync `playerAchievementsList` + persist lastProgress в save.
6. Удалены unused fields из LastWinContext.

R3: 5 MAJOR + 1 MINOR. Все приняты:
1. **pendingDesired re-check читает latest из Map** (не closure-state) — после resolve `pendingDesired.get(tag) ?? capped` даёт актуальный desired, накопленный во время in-flight.
2. **Typo fix**: `gp.achievements.playerAchievementsList` (было ошибочно `gp.socials.playerAchievementsList`). `env.d.ts`: `achievements?: GamePushAchievements` в `GamePushSDK`.
3. **`progress.achievementUnlocked: Record<string, true>`** — persist после каждого successful unlock; bootstrap seed'ит `unlockedCache` из union (SDK list ∪ persisted). Перед чтением SDK list — `await gp.achievements.fetch()`.
4. **`Promise<boolean>` semantics = "write accepted"**: ok=true означает SDK принял write без error (НЕ "achievement unlocked"). Reconciler коммитит lastProgress на ok=true независимо от unlock-status; unlock определяется через `capped >= meta.max`.
5. **Explicit migration order** в SaveService.init: parse → `isValidSaveState` (hintCount **optional**) → `sanitizeGameState` (выставляет `hintCount: 0` для legacy).
6. **`.catch().finally()`** для in-flight maps — defense-in-depth от unexpected reject (typo, undefined-prop chain).

R4: 2 MAJOR. Оба приняты:
1. **pendingDesired drain через `writeProgress` helper** — R3 fix M1 был incomplete: рекурсивный `reconcile(state)` вызывался ДО `finally(() => delete pendingDesired)`, поэтому recursive call попадал в early-return `if (pendingDesired.has(tag))` и `setProgress(latestDesired)` не отправлялся. Fix: убрать `.finally()`, drain напрямую в `.then()` через рекурсивный `writeProgress(tag, latestDesired, max, state)` — `pendingDesired.delete(tag)` ДО рекурсии.
2. **Bootstrap seed persisted ДО await fetchAchievements** — было: persisted seed'ился ПОСЛЕ await, окно N мс между `void bootstrap()` и завершением fetch — если за это время `reconcile()` сработает (например, ad-bonus coin grant), cache пустой → quota burn для уже-unlocked one-shot. Fix: seed persisted (`achievementUnlocked` + `achievementProgress`) синхронно ДО await; merge SDK list ПОСЛЕ await.

## Context

20 ачивок. Reconciler-pattern (одна точка истины). SaveService остаётся
чистым. Quota-минимизация через cap+skip+pending-tracking.

## Список ачивок (20)

### Progression (4)

| Tag | Display name (RU) | Max | Rarity | Hidden |
|---|---|---|---|---|
| `first_win` | Первый расклад | — | common | no |
| `chapter_1_complete` | Линия восстановлена | 10 | common | no |
| `chapter_2_complete` | За хребтом | 10 | uncommon | no |
| `chapter_3_complete` | Архив собран | 10 | rare | no |

### Collection (3)

| Tag | Display name | Max | Rarity | Hidden |
|---|---|---|---|---|
| `first_artifact` | Первая находка | — | common | no |
| `first_entry` | Чужой почерк | — | common | no |
| `all_artifacts` | Полный архив | 9 | epic | **YES** |

### Mastery (2)

| Tag | Display name | Max | Rarity | Hidden |
|---|---|---|---|---|
| `no_undo_win` | Без шага назад | — | rare | **YES** |
| `no_hint_win` | Без подсказок | — | rare | **YES** |

### Character entries (5) — fixed counts

| Tag | Display name | Max | Rarity | Hidden | speakerEntityId |
|---|---|---|---|---|---|
| `entries_voronov` | Голос Воронова | **13** | rare | no | `leader` |
| `entries_levin` | Сомнения Левина | 6 | rare | no | `archaeologist` |
| `entries_mirskaya` | Метки Мирской | **4** | uncommon | no | `cartographer` |
| `entries_klimova` | Архив Климовой | 4 | uncommon | no | `photographer_archivist` |
| `entries_rudenko` | Поправки Руденко | 3 | uncommon | no | `quartermaster_guide` |

Sum: 13+6+4+4+3 = 30 (= total entries) ✓

Note: Мирская теперь uncommon (max 4 = такой же как Климова), а не rare.
Так сбалансированнее: rare = более-чем-среднее количество, uncommon = ниже.

### Coin economy (3)

| Tag | Display name | Max | Rarity | Hidden | Семантика |
|---|---|---|---|---|---|
| `coins_500` | Достигнуто 500 монет | 500 | uncommon | no | balance milestone |
| `coins_1000` | Полный карман | 1000 | rare | no | balance milestone |
| `coins_2000` | Снаряжение готово | 2000 | epic | no | balance milestone |

### Social (2)

| Tag | Display name | Max | Rarity | Hidden |
|---|---|---|---|---|
| `first_share` | Кому-то рассказано | — | common | no |
| `first_community_join` | Подписан | — | common | no |

### Story (1)

| Tag | Display name | Max | Rarity | Hidden | Trigger |
|---|---|---|---|---|---|
| `epilogue` | На последнем листе | — | legendary | **YES** | completing `c3n10` |

**Итого: 20 ачивок.** 4 hidden. Rarity: 5 common / 5 uncommon / 7 rare / 2 epic / 1 legendary.

**Backlog:** `daily_streak_7`, `daily_streak_30` — после login-streak update logic.

## Архитектура: Reconciler pattern (R3 версия)

### Phase 1 — Метаданные

**`src/data/achievements.ts`** (новый):

```ts
import { getNarrativeEntry } from "@/data/narrative/entries";
import { getNodeById } from "@/data/chapters";
import type { ProgressState } from "@/core/game-state/types";

export type AchievementMeta = {
  tag: string;
  max?: number;
  hidden?: boolean;
  compute(state: ReconcileState): number | boolean;
};

/** Только реально нужные поля (R2 fix: artifactJustAwarded/entryJustOpened удалены). */
export type LastWinContext = {
  mode: string;
  dealId: string;
  undoCount: number;
  hintCount: number;
};

export type ReconcileState = {
  progress: ProgressState;
  lastWin?: LastWinContext;
};

const inChapter = (nodes: string[], n: 1 | 2 | 3) =>
  nodes.filter((id) => id.startsWith(`c${n}n`)).length;

const countEntriesByEntity = (nodes: string[], entityId: string): number =>
  nodes.filter((nodeId) => {
    const node = getNodeById(nodeId);
    if (!node?.entryId) return false;
    const entry = getNarrativeEntry(node.entryId, "ru");
    return entry?.speakerEntityId === entityId;
  }).length;

export const ACHIEVEMENTS: AchievementMeta[] = [
  { tag: "first_win", compute: (s) => s.progress.completedNodes.length > 0 },
  { tag: "chapter_1_complete", max: 10, compute: (s) => inChapter(s.progress.completedNodes, 1) },
  { tag: "chapter_2_complete", max: 10, compute: (s) => inChapter(s.progress.completedNodes, 2) },
  { tag: "chapter_3_complete", max: 10, compute: (s) => inChapter(s.progress.completedNodes, 3) },

  { tag: "first_artifact", compute: (s) => s.progress.artifacts.length > 0 },
  { tag: "first_entry", compute: (s) => s.progress.completedNodes.length > 0 },
  { tag: "all_artifacts", max: 9, hidden: true, compute: (s) => s.progress.artifacts.length },

  // Mastery — durable through achievementFacts (R2 fix M2)
  { tag: "no_undo_win", hidden: true, compute: (s) =>
      Boolean(s.progress.achievementFacts?.noUndoWinEver) ||
      Boolean(s.lastWin && s.lastWin.undoCount === 0) },
  { tag: "no_hint_win", hidden: true, compute: (s) =>
      Boolean(s.progress.achievementFacts?.noHintWinEver) ||
      Boolean(s.lastWin && s.lastWin.hintCount === 0) },

  // Character entries — fixed counts
  { tag: "entries_voronov", max: 13, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "leader") },
  { tag: "entries_levin", max: 6, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "archaeologist") },
  { tag: "entries_mirskaya", max: 4, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "cartographer") },
  { tag: "entries_klimova", max: 4, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "photographer_archivist") },
  { tag: "entries_rudenko", max: 3, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "quartermaster_guide") },

  // Coins — balance milestone, monotonic via cap+skip
  { tag: "coins_500", max: 500, compute: (s) => s.progress.coins },
  { tag: "coins_1000", max: 1000, compute: (s) => s.progress.coins },
  { tag: "coins_2000", max: 2000, compute: (s) => s.progress.coins },

  // Social — durable via achievementFacts (R2 fix M2)
  { tag: "first_share", compute: (s) =>
      Boolean(s.progress.achievementFacts?.sharedEver) },
  { tag: "first_community_join", compute: (s) =>
      Boolean(s.progress.achievementFacts?.communityJoinedEver) },

  // Story
  { tag: "epilogue", hidden: true, compute: (s) =>
      s.progress.completedNodes.includes("c3n10") },
];
```

**Тесты `achievements.test.ts`:**
- `inChapter` для разных входов.
- Каждый author count'ер matches expected: leader=13, cartographer=4, archaeologist=6, quartermaster_guide=3, photographer_archivist=4 (verified against actual data).
- Sum of all 5 entity counts === 30 (все ноды покрыты).
- Каждая ACHIEVEMENTS[i].max (если задана) === actual achievable count для character-entries (`entries_voronov.max === 13`, etc.).

### Phase 2 — SDK слой

**`src/services/sdk/SdkService.ts`** интерфейс:

```ts
canUseAchievements(): boolean;
hasAchievement(tag: string): boolean;
/**
 * Подгружает свежий список ачивок (gp.achievements.fetch) — нужен
 * перед bootstrap-seed (R3 fix M3). Resolved value не используется,
 * читать список потом через getPlayerAchievements (sync).
 */
fetchAchievements(): Promise<void>;
/**
 * Sync-чтение `gp.achievements.playerAchievementsList`.
 * Возвращает массив { tag, progress, unlocked }.
 */
getPlayerAchievements(): Array<{ tag: string; progress: number; unlocked: boolean }>;
/**
 * R3 fix M4: семантика `true` = SDK write принят без error, НЕ "achievement
 * unlocked". Unlock-status reconciler определяет сам через `capped >= meta.max`.
 */
unlockAchievement(tag: string): Promise<boolean>;
setAchievementProgress(tag: string, progress: number): Promise<boolean>;
openAchievementsOverlay(): Promise<void>;
```

**Изменение vs r2:** заменён `getAchievementProgress(tag)` на `getPlayerAchievements()` (R2 fix M5) — более robust, уменьшает риск что getProgress async'ный. R3 добавил `fetchAchievements()` и зафиксировал семантику Promise<boolean>.

**`GamePushSdkService`** — реализация через `gp.achievements.*` (R3 fix M2 — НЕ `gp.socials.*`!) с async/await + try/catch:

```ts
async fetchAchievements(): Promise<void> {
  if (!this.gp?.achievements?.fetch) return;
  try { await this.gp.achievements.fetch(); }
  catch (e) { console.warn("[gp] achievements.fetch failed", e); }
}

getPlayerAchievements(): Array<{ tag: string; progress: number; unlocked: boolean }> {
  // R3 fix M2: правильный namespace — achievements, не socials.
  const list = this.gp?.achievements?.playerAchievementsList ?? [];
  return list.map((a) => ({
    tag: a.tag,
    progress: a.progress ?? 0,
    unlocked: Boolean(a.unlocked),
  }));
}

async setAchievementProgress(tag: string, progress: number): Promise<boolean> {
  if (!this.gp?.achievements?.setProgress) return false;
  try {
    // R3 fix M4: trust SDK call — если не throw'нул, write принят.
    // success-поле UnlockPlayerAchievementOutput говорит про unlock,
    // НЕ про "write был принят" — нам нужно последнее.
    await this.gp.achievements.setProgress({ tag, progress });
    return true;
  } catch (e) {
    console.warn("[gp] achievements.setProgress failed", e);
    return false;
  }
}

async unlockAchievement(tag: string): Promise<boolean> {
  if (!this.gp?.achievements?.unlock) return false;
  try {
    await this.gp.achievements.unlock({ tag });
    return true;
  } catch (e) {
    console.warn("[gp] achievements.unlock failed", e);
    return false;
  }
}
```

**`YandexSdkService`** — stubs (`canUseAchievements()=false`, остальные no-op / empty array).

**`env.d.ts`** — добавить `GamePushAchievements` интерфейс с `playerAchievementsList`, `fetch`, `setProgress`, `unlock`. В `GamePushSDK` поле `achievements?: GamePushAchievements` (R3 fix M2). Убедиться что `socials` НЕ имеет `playerAchievementsList` — защита от регрессии.

**Тест GamePushSdkService (защита от typo M2):** mock'нуть `gp.socials.playerAchievementsList = undefined` (или вообще убрать поле в типе) — `getPlayerAchievements` должен читать только `gp.achievements.playerAchievementsList`. Если кто-то откатит typo — тест упадёт с TypeError.

### Phase 3 — `progress.achievementFacts` (R2 fix M2)

**`src/core/game-state/types.ts`**:

```ts
export type AchievementFacts = {
  sharedEver?: boolean;
  communityJoinedEver?: boolean;
  noUndoWinEver?: boolean;
  noHintWinEver?: boolean;
};

export type ProgressState = {
  // ... existing fields ...
  /** Durable одноразовые факты — для one-shot ачивок выживающих SDK
   *  transient-failures. Если SDK unlock не прошёл, факт сохранён, и
   *  на следующем reconcile попытка повторится. Optional на legacy. */
  achievementFacts?: AchievementFacts;
  /** Persist lastProgress per-tag для achievement-progress reconcilе
   *  (R2 fix M5). Optional на legacy. */
  achievementProgress?: Record<string, number>;
  /**
   * R3 fix M3: durable record успешно отправленных unlock'ов.
   * Защищает от quota-burn если SDK list оказался пустым/недоступным
   * на bootstrap — `unlockedCache` seed'ится из union (SDK list ∪ this).
   * Optional на legacy.
   */
  achievementUnlocked?: Record<string, true>;
};
```

**`SaveService.sanitizeProgress`** — нормализует undefined → `{}` для всех трёх optional полей (`achievementFacts`, `achievementProgress`, `achievementUnlocked`).

**API для записи durable facts (вне SaveService — keep it pure):**

```ts
// src/services/achievements/recordFacts.ts
import { getAppContext } from "@/app/config/appContext";

export function recordSharedEver(): void {
  const save = getAppContext().save;
  save.updateProgress((p) => ({
    ...p,
    achievementFacts: { ...(p.achievementFacts ?? {}), sharedEver: true },
  }));
}
// аналогично для communityJoined, noUndoWin, noHintWin
```

Вызывается:
- `recordSharedEver()` — в BootScene.onShareResult при success.
- `recordCommunityJoinedEver()` — в BootScene.onJoinCommunityResult при success.
- `recordNoUndoWinEver()` / `recordNoHintWinEver()` — в RewardScene при `nodeJustCompleted` если undoCount/hintCount === 0.

После записи — `reconciler.reconcile(...)` зовётся (фактически уже зовётся в этих местах).

### Phase 4 — Reconciler (R3 версия)

**`src/services/achievements/AchievementsReconciler.ts`**:

```ts
import { ACHIEVEMENTS, type ReconcileState } from "@/data/achievements";
import type { SdkService } from "@/services/sdk/SdkService";

export class AchievementsReconciler {
  /** Локальный кэш unlocked ачивок (committed-on-success). */
  private unlockedCache = new Set<string>();
  /** Последний успешно отправленный progress per tag. */
  private lastProgress = new Map<string, number>();
  /**
   * Pending desired progress per tag (R2 fix M3).
   * Когда in-flight call resolved, проверяем — желаемое уже выросло
   * пока ждали? Если да → сразу новый вызов с актуальным значением.
   */
  private pendingDesired = new Map<string, number>();
  /**
   * Pending one-shot unlock — для дедупа in-flight unlocks.
   * Содержит tag'и для которых unlock сейчас в полёте.
   */
  private pendingUnlocks = new Set<string>();
  /** Save-сервис нужен для persistence lastProgress в progress.achievementProgress. */
  constructor(
    private readonly sdk: SdkService,
    /** Persist (tag, progress) → save.progress.achievementProgress[tag]. */
    private readonly persistProgress: (tag: string, progress: number) => void,
    /** Persist (tag) → save.progress.achievementUnlocked[tag] = true (R3 fix M3). */
    private readonly persistUnlocked: (tag: string) => void,
  ) {}

  /**
   * Вызывается ОДИН раз после save.init() в BootScene. Async — делает
   * `gp.achievements.fetch()` (R3 fix M3). Persisted seed — синхронно ДО
   * await (R4 fix M2): закрывает окно гонки между `void bootstrap()` и
   * параллельным `reconcile()` (например, coin-grant из ad-bonus).
   */
  async bootstrap(state: ReconcileState): Promise<void> {
    if (!this.sdk.canUseAchievements()) return;

    // R4 fix M2: seed persisted СИНХРОННО ДО await fetchAchievements.
    // Это закрывает окно гонки: если в этом окне произойдёт reconcile()
    // (например, RewardScene или GameScene дойдёт до coins-trigger),
    // cache уже разогрет — persisted unlock'и не будут отправляться повторно.
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

    // R3 fix M3: гарантируем актуальность playerAchievementsList.
    await this.sdk.fetchAchievements();

    // Merge SDK list ПОСЛЕ await — может расширить cache (например, unlock
    // на другом устройстве через cloud-save-sync). Идём read-only через
    // правильный namespace `gp.achievements.playerAchievementsList`
    // (R3 fix M2 — НЕ из gp.socials.*).
    const list = this.sdk.getPlayerAchievements();
    for (const { tag, progress, unlocked } of list) {
      if (unlocked) this.unlockedCache.add(tag);
      else if (progress > (this.lastProgress.get(tag) ?? 0)) {
        // Только если SDK знает больше (другое устройство / cloud sync).
        this.lastProgress.set(tag, progress);
      }
    }

    // Backfill — первый reconcile для existing players.
    this.reconcile(state);
  }

  reconcile(state: ReconcileState): void {
    if (!this.sdk.canUseAchievements()) return;

    for (const meta of ACHIEVEMENTS) {
      if (this.unlockedCache.has(meta.tag)) continue;
      const desired = meta.compute(state);

      if (meta.max !== undefined) {
        const num = typeof desired === "number" ? desired : 0;
        const capped = Math.min(num, meta.max);
        const last = this.lastProgress.get(meta.tag) ?? 0;
        if (capped <= last) continue;

        // Если уже in-flight — обновляем pendingDesired (R2 fix M3).
        // Map хранит ПОСЛЕДНЕЕ desired, накопленное за время in-flight.
        if (this.pendingDesired.has(meta.tag)) {
          const prev = this.pendingDesired.get(meta.tag)!;
          if (capped > prev) this.pendingDesired.set(meta.tag, capped);
          continue;
        }

        this.writeProgress(meta.tag, capped, meta.max);
      } else {
        if (this.pendingUnlocks.has(meta.tag)) continue;
        const should = typeof desired === "boolean" ? desired : desired > 0;
        if (!should) continue;

        this.writeUnlock(meta.tag);
      }
    }
  }

  /**
   * R4 fix M1: drain pendingDesired до latest напрямую через рекурсию,
   * НЕ через reconcile(state). Удаляем pending ДО рекурсивного вызова —
   * иначе recursive `writeProgress` внутри попадёт в early-return через
   * `pendingDesired.has` в reconcile (R3 баг).
   */
  private writeProgress(tag: string, capped: number, max: number): void {
    this.pendingDesired.set(tag, capped);
    void this.sdk.setAchievementProgress(tag, capped)
      .then((ok) => {
        // R3 fix M1: читаем latest из Map ДО delete.
        const latestDesired = this.pendingDesired.get(tag) ?? capped;
        // R3 fix M4: ok=true = write принят (НЕ unlocked).
        if (ok) {
          this.lastProgress.set(tag, capped);
          this.persistProgress(tag, capped);
          if (capped >= max) {
            this.unlockedCache.add(tag);
            this.persistUnlocked(tag); // R3 fix M3
          }
        }
        // R4 fix M1: delete ДО рекурсии — чтобы next writeProgress прошёл.
        this.pendingDesired.delete(tag);
        // Drain к latest если есть рост и ещё не unlocked.
        if (ok && latestDesired > capped && capped < max) {
          this.writeProgress(tag, Math.min(latestDesired, max), max);
        }
      })
      .catch((err) => {
        // R3 fix M-MINOR1: defense-in-depth для unexpected reject.
        // GamePushSdkService уже catch'ит и возвращает false, но если
        // wrapper сам throw'нул нечто непредвиденное — чистим pending.
        this.pendingDesired.delete(tag);
        console.warn("[ach] setProgress threw", tag, err);
      });
  }

  private writeUnlock(tag: string): void {
    this.pendingUnlocks.add(tag);
    void this.sdk.unlockAchievement(tag)
      .then((ok) => {
        if (ok) {
          this.unlockedCache.add(tag);
          this.persistUnlocked(tag); // R3 fix M3
        }
        // На fail — durable facts (achievementFacts) гарантируют что
        // событие не потерялось; на следующем reconcile повторим.
        this.pendingUnlocks.delete(tag);
      })
      .catch((err) => {
        // R3 fix M-MINOR1.
        this.pendingUnlocks.delete(tag);
        console.warn("[ach] unlock threw", tag, err);
      });
  }

  openOverlay(): void {
    if (!this.sdk.canUseAchievements()) return;
    void this.sdk.openAchievementsOverlay();
  }
}
```

**Тесты `AchievementsReconciler.test.ts`:**
- **R4 fix M2**: `bootstrap` seed'ит persisted (`achievementUnlocked` + `achievementProgress`) **до** await `fetchAchievements`. Тест: mock fetchAchievements resolve через 100ms; persisted `{ first_share: true }`; в момент `t=50ms` зовём `reconcile({ progress where compute(first_share)===true })` → `unlockAchievement` mock NOT called (cache уже разогрет).
- `bootstrap` await'ит `fetchAchievements` (R3 fix M3) и затем merge'ит SDK list (может расширить cache из cloud-sync).
- Когда SDK list пустой, но persisted achievementUnlocked содержит `first_share` → reconcile НЕ шлёт unlock второй раз (R3 fix M3).
- `reconcile` cap'ит progress по max.
- **R4 fix M1**: pendingDesired занят (in-flight setProgress(1900)), второй reconcile с desired=2050 → pendingDesired.set(tag, 2000). После resolve `writeProgress` читает `pendingDesired.get(tag)=2000`, делает delete, потом сам себя зовёт `writeProgress(tag, 2000, max)`. Тест: `setProgressMock.mock.calls.length === 2`, второй вызов с `2000`. **Этот тест должен падать на R3-реализации с `.finally`+рекурсивным `reconcile(state)` — это даёт уверенность что R4 fix реально нужен.**
- **R3 fix M4**: `setProgress(chapter_1_complete, 3)` (3 < max=10) → ok=true → `lastProgress.get('chapter_1_complete') === 3`, `unlockedCache.has('chapter_1_complete') === false`. Следующий reconcile с тем же desired=3 → no setProgress call (skip-by-cap).
- **R3 fix M4**: `setProgress(chapter_1_complete, 10)` → ok=true + capped===max → `unlockedCache.has(...)` AND `persistUnlocked` called.
- При SDK fail (ok=false) → cache не обновляется, на повторном reconcile retry. `pendingDesired.delete` всё равно происходит.
- **R3 fix M-MINOR1**: SDK throws → `.catch` log'ит и чистит pendingDesired/pendingUnlocks → следующий reconcile может попробовать снова.
- canUseAchievements === false → no-op (включая bootstrap — `fetchAchievements` не вызывается, persisted seed тоже не делается).
- One-shot unlock не зовёт SDK дважды (pendingUnlocks).
- One-shot unlock на success → `persistUnlocked(tag)` called.

### Phase 5 — `hintCount` монотонный + миграция (R3 fix M5)

**Поведение runtime:**
- `handleHintAction` — `state.hintCount++` + persist.
- `handleUndo` — restored state от history содержит prev `undoCount`,
  но `hintCount` берётся из CURRENT state (монотонный, через undo не откатывается).

**R3 fix M5 — explicit migration order в SaveService.init:**

```ts
// SaveService.init():
const json = await sdk.loadCloudSave();
const parsed = json ? safeJsonParse(json) : null;

// Шаг 1: validate. isValidGameState принимает legacy без hintCount.
if (parsed && isValidSaveState(parsed)) {
  // Шаг 2: sanitize. ProgressState и (если есть) currentGame.
  this.state = {
    progress: sanitizeProgress(parsed.progress),
    currentGame: parsed.currentGame
      ? sanitizeGameState(parsed.currentGame)
      : null,
    // ... другие поля
  };
} else {
  // ... fallback на default
}
```

**`isValidGameState`** — `hintCount` НЕ обязателен (optional check):
```ts
export function isValidGameState(g: unknown): g is GameState {
  // ... existing checks для tableau, foundations, stock, waste, undoCount, etc.
  // hintCount — optional. Не enforce'им — sanitizeGameState нормализует.
  if (g && typeof g === "object" && "hintCount" in g) {
    if (typeof (g as any).hintCount !== "number") return false;
  }
  return true; // hintCount missing = ok (legacy)
}
```

**`sanitizeGameState`** — выставляет default:
```ts
export function sanitizeGameState(g: GameState): GameState {
  return {
    ...g,
    hintCount: typeof g.hintCount === "number" ? g.hintCount : 0,
  };
}
```

**Тесты `SaveService.test.ts`:**
- Legacy cloud save string без `hintCount` в `currentGame` → после `init()`:
  - `state.currentGame !== null` (валидация прошла, не сбросилось в null).
  - `state.currentGame.hintCount === 0` (sanitizer добавил default).
- Legacy без `currentGame` (null) → `state.currentGame === null`.
- Save с `hintCount: 5` → `state.currentGame.hintCount === 5` (preserved).
- Невалидный save (broken types) → fallback на default state.

### Phase 6 — RewardScene с explicit gating (R2 fix M4)

```ts
// RewardScene.create(data):
const { mode, dealId, preview, returnFromDetail, lastWin } = data;
const wasAlreadyCompleted = save.load().progress.completedNodes.includes(dealId);

const nodeJustCompleted =
  !preview &&
  !returnFromDetail &&
  mode === "adventure" &&
  !wasAlreadyCompleted &&
  Boolean(dealId);

const dailyJustClaimed =
  !preview &&
  !returnFromDetail &&
  mode === "daily" &&
  save.load().progress.dailyClaimedOn !== getDailyDateKey(); // before claim

if (nodeJustCompleted) {
  save.completeNode(dealId, ...);
  // Durable facts — записываем ДО reconcile.
  if (lastWin && lastWin.undoCount === 0) recordNoUndoWinEver();
  if (lastWin && lastWin.hintCount === 0) recordNoHintWinEver();
  ach.reconcile({ progress: save.load().progress, lastWin });
} else if (dailyJustClaimed) {
  save.claimDaily(dateKey);
  ach.reconcile({ progress: save.load().progress });
}
// Coins-trigger ОТДЕЛЬНО — после save.addCoins (ad bonus, и т.п.)
```

### Phase 7 — Триггеры через reconcile()

| Где | Действие | Что reconcile видит |
|---|---|---|
| `BootScene` после `save.init()` | `void bootstrap({ progress })` (async, fire-and-forget) | Backfill всех ачивок |
| `RewardScene` при `nodeJustCompleted=true` | `reconcile({ progress, lastWin })` | first_win, chapter_*, mastery, character entries, all_artifacts, epilogue |
| `RewardScene` при `dailyJustClaimed=true` | `reconcile({ progress })` | (пока без daily_streak — backlog) |
| `RewardScene/GameScene` после `save.addCoins(*)` | `reconcile({ progress })` | coins_* |
| `BootScene.onShareResult(success=true)` | `recordSharedEver(); reconcile({ progress })` | first_share |
| `BootScene.onJoinCommunityResult(success=true)` | `recordCommunityJoinedEver(); reconcile({ progress })` | first_community_join |

### Phase 8 — UI

**SettingsScene** — кнопка «Достижения», видна если `sdk.canUseAchievements()`. Клик → `achievements.openOverlay()`.

**i18n** — ключ `achievements: "Достижения"` × 7 локалей.

### Phase 9 — Регистрация в дашборде (твоя сторона) — ДО деплоя

20 ачивок × 7 локалей × (name + description) = **280 переводов**. Готовлю в Phase 10.

Иконки 256×256:
- 9 collection-ачивок reuse `assets/artifacts/*_grid.png`
- 11 generic — GP-built-in pack.

### Phase 10 — Документация

`docs/specs/2026-05-XX-achievements-translations.md` — таблица 20 × 7 × 2.

## Verification

- `npm test` — 139 → ~152 ✓ (+13 тестов: pendingDesired latest re-check, fetch-before-list, persisted unlocked union, write-vs-unlock semantics, .catch/.finally, hintCount migration legacy).
- `npm run build` — typecheck чистый. `gp.achievements.*` (НЕ `gp.socials.*`) подсвечен в env.d.ts.
- `node scripts/packBuild.mjs --target=gamepush` — zip ≤ 37 MB.
- Manual QA:
  - Backfill: установить hasAchievement=false для всех + completedNodes=[все], coins=2000 → bootstrap запускает fetch + reconcile с unlock'ами через несколько последовательных setProgress.
  - **Pending latest re-check (R3 fix M1)**: симулировать SDK delay 500ms (`setProgress(coins_2000, 1900)`), во время которого coins вырастают до 2050 — pendingDesired обновляется до 2000, после resolve `pendingDesired.get(tag)` возвращает 2000 → второй setProgress(2000) отправляется.
  - **Persisted unlock survives empty SDK list (R3 fix M3)**: первая сессия unlock'ает first_share → persisted в save. Вторая сессия — `getPlayerAchievements()` возвращает `[]` (network glitch) → `unlockedCache` всё равно содержит first_share → reconcile НЕ слать unlock повторно.
  - **Partial progress write (R3 fix M4)**: setProgress(chapter_1_complete, 3) → ok=true. lastProgress.set(...,3). НЕ unlocked. Следующий reconcile с теми же completedNodes не делает SDK call.
  - Durable facts: симулировать SDK fail на first_share — recordSharedEver уже сохранил факт; следующая сессия → reconcile повторит unlock.
  - **hintCount legacy migration (R3 fix M5)**: cloud save без `hintCount` в currentGame → init принимает (validation), sanitize выставляет 0 → state.currentGame.hintCount === 0, currentGame !== null.
  - Mastery: пройти партию без undo+hint → no_undo_win и no_hint_win unlock.
  - Yandex: canUseAchievements=false → кнопка отсутствует, никаких SDK вызовов.

## Files (consolidated)

**Новые:**
- `src/data/achievements.ts`
- `src/data/achievements.test.ts`
- `src/services/achievements/AchievementsReconciler.ts`
- `src/services/achievements/AchievementsReconciler.test.ts`
- `src/services/achievements/recordFacts.ts`
- `src/core/klondike/__test-helpers__/gameState.ts`
- `docs/specs/2026-05-XX-achievements-translations.md`

**Изменённые:**
- `src/env.d.ts` (+ GamePushAchievements; `achievements?: GamePushAchievements` в GamePushSDK — R3 fix M2)
- `src/services/sdk/SdkService.ts` (6 методов; добавлен `fetchAchievements()` — R3 fix M3)
- `src/services/sdk/GamePushSdkService.ts` (через `gp.achievements.*` — R3 fix M2; Promise<boolean> = "write accepted" — R3 fix M4)
- `src/services/sdk/YandexSdkService.ts`
- `src/services/save/SaveService.test.ts` (+ legacy hintCount migration test — R3 fix M5)
- `src/services/save/SaveService.ts` (+ achievementFacts/achievementProgress/achievementUnlocked в sanitize; sanitizeGameState; explicit migration order parse→validate(hintCount optional)→sanitize — R3 fix M5; БЕЗ AppContext-связки)
- `src/core/game-state/types.ts` (+ hintCount, AchievementFacts, achievementUnlocked optional)
- `src/core/game-state/validation.ts` (`isValidGameState` принимает legacy без hintCount — R3 fix M5)
- `src/core/klondike/createInitialDeal.ts` (+ hintCount: 0)
- `src/scenes/GameScene.ts` (handleHintAction inc + persist; handleUndo preserve hintCount; lastWin context)
- `src/scenes/RewardScene.ts` (nodeJustCompleted explicit; dailyJustClaimed; recordFacts calls; reconcile triggers)
- `src/scenes/BootScene.ts` (`void bootstrap()`; AchievementsReconciler в getAppContext; recordFacts в onShareResult/onJoinCommunityResult)
- `src/scenes/SettingsScene.ts` (+ achievements кнопка)
- `src/scenes/settingsSceneOverlay.ts`
- `src/services/i18n/locales.ts` (+ achievements key × 7)
- `src/app/config/appContext.ts` (+ achievements в AppContext; persistProgress + persistUnlocked callbacks)
- `package.json` (0.3.55 → 0.3.56)
- Existing GameState fixtures → factory `createTestGameState`

## Risk register (открытые)

| Risk | Mitigation |
|---|---|
| `gp.achievements.fetch()` deprecated per docs | Всё ещё работает; если вернёт error — `try/catch` глушит, переходим к sync read. На impl проверим, нет ли альтернативы. |
| `gp.achievements.playerAchievementsList` пустой при network glitch | R3 fix M3: union с `progress.achievementUnlocked` гарантирует что previously unlocked не отправляются повторно. |
| `recordFacts` вызывается из BootScene, требует AppContext.save готовности | BootScene создаёт save → setAppContext → потом устанавливает listeners. К моменту когда listener срабатывает, AppContext полный. Проверим в impl. |
| Recursive reconcile (re-check после resolve) → infinite loop | Защита: re-check вызывается только если `latestDesired > capped`; следующий reconcile cap'ит и идёт через skip-by-cap при достижении max. Не бесконечно. |
| countEntriesByEntity использует "ru" entries — нагрузка / loading | `getNarrativeEntry` reads in-memory data, не fetches. Safe. |
| Unexpected reject в SDK wrapper (typo, undefined.prop chain) | R3 fix M-MINOR1: `.catch` log'ит, `.finally` чистит pending — следующий reconcile может попробовать снова. |

## Out-of-scope (для следующего плана)

1. Login-streak update logic → `daily_streak_7/30`.
2. Toast с CTA «Поделиться достижением» после epic unlock.
3. VK Direct Games missions (`vkMissionId`).
