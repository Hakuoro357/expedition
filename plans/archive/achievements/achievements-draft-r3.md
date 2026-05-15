# GamePush Achievements integration plan (v0.3.56) — round 3

## Round 1 + 2 итог

R1: 1 CRITICAL + 11 MAJOR + 5 MINOR + Reconciler architecture. Все принято.
R2: 4 MAJOR + 1 MINOR. Все приняты:
1. character entry max'ы исправлены: leader=13, cartographer=4, archaeologist=6, quartermaster_guide=3, photographer_archivist=4 (verified by grep entries.ru.ts).
2. Добавлен `progress.achievementFacts` для durable одноразовых фактов.
3. `pendingDesired: Map<string, number>` + re-check после resolve.
4. Explicit `nodeJustCompleted` boolean в RewardScene (вместо неточного preview/returnFromDetail).
5. Bootstrap seed через sync `playerAchievementsList` + persist lastProgress в save.
6. Удалены unused fields из LastWinContext.

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
/** Возвращает массив { tag, progress, unlocked } из gp.achievements.playerAchievementsList. */
getPlayerAchievements(): Array<{ tag: string; progress: number; unlocked: boolean }>;
unlockAchievement(tag: string): Promise<boolean>;
setAchievementProgress(tag: string, progress: number): Promise<boolean>;
openAchievementsOverlay(): Promise<void>;
```

**Изменение vs r2:** заменён `getAchievementProgress(tag)` на `getPlayerAchievements()` (R2 fix M5) — более robust, уменьшает риск что getProgress async'ный.

**`GamePushSdkService`** — реализация через `gp.achievements.*` с
async/await + try/catch + tag-by-id lookup. `getPlayerAchievements`
читает `this.gp?.socials?.playerAchievementsList` (sync property
по доке).

**`YandexSdkService`** — stubs.

**`env.d.ts`** — `GamePushAchievements` интерфейс.

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
};
```

**`SaveService.sanitizeProgress`** — нормализует undefined → `{}`.

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
    private readonly persistProgress: (tag: string, progress: number) => void,
  ) {}

  /** Вызывается ОДИН раз после save.init() в BootScene. */
  bootstrap(state: ReconcileState): void {
    if (!this.sdk.canUseAchievements()) return;
    // Seed из sync property playerAchievementsList (R2 fix M5).
    const list = this.sdk.getPlayerAchievements();
    for (const { tag, progress, unlocked } of list) {
      if (unlocked) this.unlockedCache.add(tag);
      else if (progress > 0) this.lastProgress.set(tag, progress);
    }
    // Дополнительный fallback из persisted progress (если SDK list пуст по какой-то причине)
    const persisted = state.progress.achievementProgress ?? {};
    for (const [tag, value] of Object.entries(persisted)) {
      if (!this.lastProgress.has(tag) && !this.unlockedCache.has(tag)) {
        this.lastProgress.set(tag, value);
      }
    }
    // Запускаем первый reconcile — backfill для existing players.
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
        if (this.pendingDesired.has(meta.tag)) {
          const prev = this.pendingDesired.get(meta.tag)!;
          if (capped > prev) this.pendingDesired.set(meta.tag, capped);
          continue;
        }

        this.pendingDesired.set(meta.tag, capped);
        const tag = meta.tag;
        const max = meta.max;
        void this.sdk.setAchievementProgress(tag, capped).then((ok) => {
          this.pendingDesired.delete(tag);
          if (ok) {
            this.lastProgress.set(tag, capped);
            this.persistProgress(tag, capped);
            if (capped >= max) this.unlockedCache.add(tag);
            // Re-check (R2 fix M3): мог ли desired вырасти пока in-flight?
            // Используем актуальный state (closure-захваченный).
            const newDesired = meta.compute(state);
            const newCapped = Math.min(
              typeof newDesired === "number" ? newDesired : 0,
              max,
            );
            if (newCapped > capped) this.reconcile(state);
          }
          // На fail оставляем lastProgress как есть → следующий reconcile retry.
        });
      } else {
        if (this.pendingUnlocks.has(meta.tag)) continue;
        const should = typeof desired === "boolean" ? desired : desired > 0;
        if (!should) continue;

        this.pendingUnlocks.add(meta.tag);
        const tag = meta.tag;
        void this.sdk.unlockAchievement(tag).then((ok) => {
          this.pendingUnlocks.delete(tag);
          if (ok) this.unlockedCache.add(tag);
          // На fail — lastProgress / unlockedCache не обновляются. На
          // следующем reconcile (или следующем bootstrap) попытка
          // повторится. Durable facts (achievementFacts) гарантируют что
          // событие не потерялось.
        });
      }
    }
  }

  openOverlay(): void {
    if (!this.sdk.canUseAchievements()) return;
    void this.sdk.openAchievementsOverlay();
  }
}
```

**Тесты `AchievementsReconciler.test.ts`:**
- `bootstrap` seed'ит из `getPlayerAchievements`.
- `reconcile` cap'ит progress по max.
- Когда pendingDesired занят и приходит больший desired → сохраняет latest, после resolve срабатывает re-check.
- При SDK fail (resolve false) → cache не обновляется, на повторном reconcile retry.
- canUseAchievements === false → no-op.
- One-shot unlock не зовёт SDK дважды (pendingUnlocks).

### Phase 5 — `hintCount` монотонный

**Файлы и логика:** см. r2 (без изменений) — handleHintAction inc + persist; handleUndo сохраняет hintCount в restored state; sanitizeGameState нормализует legacy.

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
| `BootScene` после `save.init()` | `bootstrap({ progress })` | Backfill всех ачивок |
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

- `npm test` — 139 → ~148 ✓ (+8 тестов).
- `npm run build` — typecheck чистый.
- `node scripts/packBuild.mjs --target=gamepush` — zip ≤ 37 MB.
- Manual QA:
  - Backfill scenario: установить hasAchievement=false для всех + completedNodes=[все], coins=2000 → bootstrap запускает unlock'и через несколько последовательных setProgress.
  - Pending re-check scenario: симулировать SDK delay 500ms, во время которого coins вырастают с 1900 до 2050 — после resolve второй setProgress отправляется.
  - Durable facts: симулировать SDK fail на first_share — на следующем reconcile вызов повторится.
  - Mastery: пройти партию без undo+hint → no_undo_win и no_hint_win unlock.
  - Yandex: canUseAchievements=false → кнопка отсутствует.

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
- `src/env.d.ts` (+ GamePushAchievements)
- `src/services/sdk/SdkService.ts` (5 новых методов; getPlayerAchievements вместо getAchievementProgress)
- `src/services/sdk/GamePushSdkService.ts`
- `src/services/sdk/YandexSdkService.ts`
- `src/services/save/SaveService.test.ts`
- `src/services/save/SaveService.ts` (+ achievementFacts/achievementProgress в sanitize; sanitizeGameState; БЕЗ AppContext-связки)
- `src/core/game-state/types.ts` (+ hintCount, AchievementFacts, optional progress fields)
- `src/core/klondike/createInitialDeal.ts` (+ hintCount: 0)
- `src/scenes/GameScene.ts` (handleHintAction inc + persist; handleUndo preserve hintCount; lastWin context)
- `src/scenes/RewardScene.ts` (nodeJustCompleted explicit; dailyJustClaimed; recordFacts calls; reconcile triggers)
- `src/scenes/BootScene.ts` (bootstrap; AchievementsReconciler в getAppContext; recordFacts в onShareResult/onJoinCommunityResult)
- `src/scenes/SettingsScene.ts` (+ achievements кнопка)
- `src/scenes/settingsSceneOverlay.ts`
- `src/services/i18n/locales.ts` (+ achievements key × 7)
- `src/app/config/appContext.ts` (+ achievements в AppContext)
- `package.json` (0.3.55 → 0.3.56)
- Existing GameState fixtures → factory `createTestGameState`

## Risk register (открытые)

| Risk | Mitigation |
|---|---|
| `playerAchievementsList` API может работать иначе чем в доке | Verify на impl. Fallback на persisted achievementProgress в save. |
| `recordFacts` вызывается из BootScene, требует AppContext.save готовности | BootScene создаёт save → setAppContext → потом устанавливает listeners. К моменту когда listener срабатывает, AppContext полный. Проверим в impl. |
| Recursive reconcile (re-check после resolve) → infinite loop в edge case | Защита: re-check вызывается только если `newCapped > capped` — строгий рост. Нет роста = нет рекурсии. |
| countEntriesByEntity лезет в getNarrativeEntry с локалью "ru" — что если "ru" entries файл не загружен | `getNarrativeEntry` reads in-memory data, не fetches. Safe. |

## Out-of-scope (для следующего плана)

1. Login-streak update logic → `daily_streak_7/30`.
2. Toast с CTA «Поделиться достижением» после epic unlock.
3. VK Direct Games missions (`vkMissionId`).
