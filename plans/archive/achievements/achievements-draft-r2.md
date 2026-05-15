# GamePush Achievements integration plan (v0.3.56) — round 2

## Round 1 итог

Codex review поднял 1 CRITICAL + 11 MAJOR + 5 MINOR + альтернативный
архитектурный подход. Все принято. Главные правки:
1. Принят **Reconciler pattern** (одна точка истины для desired state).
2. **20 ачивок** вместо 21 — `daily_streak_7/30` отложены до
   имплементации login-streak update logic (`progress.streakCount`
   нигде не инкрементируется в текущем коде).
3. Добавлен `first_community_join` (22-я → но minus 2 streak'а = 20).
4. SaveService остаётся чистым, без AppContext-связки.
5. character-entries → правильные `speakerEntityId` (leader/
   cartographer/archaeologist/quartermaster_guide/photographer_archivist).
6. `hintCount` — монотонный, не теряется при undo.
7. Mastery-context передаётся через RewardSceneData до clearCurrentGame.
8. Backfill через reconcile() после save.init() — existing players
   получают unlock'и за уже-пройденный контент.

## Context

Игра v0.3.55 в проде. Социальный слой 1 (share + community) работает.
Этот план — социальный слой 2: GamePush achievements.

GP API (читал WebFetch ранее):
- `gp.achievements.unlock({ tag })` — Promise, **+1 quota**.
- `gp.achievements.setProgress({ tag, progress })` — Promise, **+1 quota**.
- `gp.achievements.has(tag)` / `getProgress(tag)` — sync, **FREE**.
- `gp.achievements.open()` — Promise, **FREE**, открывает встроенный overlay.
- Регистрация — в `panel.gamepush.com → Achievements` вручную.
- **Автопостинга в OK/VK feed НЕТ** — passive через VK Direct Games
  missions ИЛИ manual share-popup после unlock-event'а (не делаем сейчас).

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

### Character entries (5)

| Tag | Display name | Max | Rarity | Hidden | speakerEntityId |
|---|---|---|---|---|---|
| `entries_voronov` | Голос Воронова | 10 | rare | no | `leader` |
| `entries_levin` | Сомнения Левина | 6 | rare | no | `archaeologist` |
| `entries_mirskaya` | Метки Мирской | 5 | rare | no | `cartographer` |
| `entries_klimova` | Архив Климовой | 4 | uncommon | no | `photographer_archivist` |
| `entries_rudenko` | Поправки Руденко | 3 | uncommon | no | `quartermaster_guide` |

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

**Итого: 20 ачивок. 4 hidden. Rarity:** 5 common / 4 uncommon / 8 rare / 2 epic / 1 legendary.

**Backlog** (отложено): `daily_streak_7`, `daily_streak_30` — после реализации login-streak update в `progress.streakCount`.

## Архитектура: Reconciler pattern

Один файл-источник истины (метаданные ачивок), один reconciler-сервис.
Сцены НЕ имеют scattered триггеров — они вызывают `reconcile(LastWinContext?)`
с опциональным контекстом последней победы.

### Phase 1 — Метаданные ачивок

**`src/data/achievements.ts`** (новый):

```ts
import { getNarrativeEntry } from "@/data/narrative/entries";
import { getNodeById } from "@/data/chapters";
import type { ProgressState } from "@/core/game-state/types";

export type AchievementMeta = {
  tag: string;
  max?: number; // undefined = one-shot unlock; number = setProgress with cap
  hidden?: boolean;
  /**
   * Pure function: вычисляет какой progress / unlocked-state ДОЛЖЕН
   * быть у игрока на основе фактов (save state + last win context).
   * Возвращает либо number (для setProgress), либо boolean (для unlock).
   */
  compute(state: ReconcileState): number | boolean;
};

export type LastWinContext = {
  mode: string;
  dealId: string;
  undoCount: number;
  hintCount: number;
  artifactJustAwarded: boolean;
  entryJustOpened: boolean;
};

export type ReconcileState = {
  progress: ProgressState;
  lastWin?: LastWinContext;
  shareJustSucceeded?: boolean;
  communityJustJoined?: boolean;
};

const inChapter = (nodes: string[], n: 1 | 2 | 3) =>
  nodes.filter((id) => id.startsWith(`c${n}n`)).length;

const countEntriesByEntity = (
  nodes: string[],
  entityId: string,
): number =>
  nodes.filter((nodeId) => {
    const node = getNodeById(nodeId);
    if (!node?.entryId) return false;
    const entry = getNarrativeEntry(node.entryId, "ru"); // canonical
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

  // Mastery — нужны lastWin context
  { tag: "no_undo_win", hidden: true, compute: (s) =>
      Boolean(s.lastWin && s.lastWin.undoCount === 0) },
  { tag: "no_hint_win", hidden: true, compute: (s) =>
      Boolean(s.lastWin && s.lastWin.hintCount === 0) },

  // Character entries
  { tag: "entries_voronov", max: 10, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "leader") },
  { tag: "entries_levin", max: 6, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "archaeologist") },
  { tag: "entries_mirskaya", max: 5, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "cartographer") },
  { tag: "entries_klimova", max: 4, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "photographer_archivist") },
  { tag: "entries_rudenko", max: 3, compute: (s) =>
      countEntriesByEntity(s.progress.completedNodes, "quartermaster_guide") },

  // Coins — balance milestone (не cumulative; skip-on-decrease гарантирует монотонность)
  { tag: "coins_500", max: 500, compute: (s) => s.progress.coins },
  { tag: "coins_1000", max: 1000, compute: (s) => s.progress.coins },
  { tag: "coins_2000", max: 2000, compute: (s) => s.progress.coins },

  // Social
  { tag: "first_share", compute: (s) => Boolean(s.shareJustSucceeded) },
  { tag: "first_community_join", compute: (s) => Boolean(s.communityJustJoined) },

  // Story
  { tag: "epilogue", hidden: true, compute: (s) =>
      s.progress.completedNodes.includes("c3n10") },
];
```

**Тесты `achievements.test.ts`:**
- `compute('chapter_1_complete')` для разных входов.
- `countEntriesByEntity` для всех 5 авторов с фикстурными completedNodes.
- Все 30 нод покрыты ровно одним автором (sum of all 5 counters = 30).
- `coins_500` skip'ит на decrease (через external Reconciler-тест).

### Phase 2 — SDK слой

**`src/services/sdk/SdkService.ts`**:

```ts
canUseAchievements(): boolean;
hasAchievement(tag: string): boolean; // sync, FREE
getAchievementProgress(tag: string): number; // sync, FREE — для backfill
unlockAchievement(tag: string): Promise<boolean>; // resolve true on success
setAchievementProgress(tag: string, progress: number): Promise<boolean>;
openAchievementsOverlay(): Promise<void>;
```

**Изменение vs r1:** методы возвращают `Promise<boolean>` вместо
`Promise<void>` — Reconciler коммитит локальный кэш только при success
(M1 fix). Метод `onAchievementUnlock` удалён (m1).

**`GamePushSdkService`** — async/await + try/catch (gp-012 lesson),
возврат false при ошибке.

**`YandexSdkService`** — stubs (canUseAchievements → false, has → false,
getAchievementProgress → 0, unlock/setProgress → resolve false).

**env.d.ts** — `GamePushAchievements` интерфейс с типами из GP-доки.

### Phase 3 — Reconciler

**`src/services/achievements/AchievementsReconciler.ts`** (новый):

```ts
import { ACHIEVEMENTS, type ReconcileState, type AchievementMeta } from "@/data/achievements";
import type { SdkService } from "@/services/sdk/SdkService";

export class AchievementsReconciler {
  /** Кэш «уже unlock'нуто», коммитится только после успешного SDK-вызова. */
  private unlockedCache = new Set<string>();
  /** Последний отправленный progress per tag — для idempotent skip. */
  private lastProgress = new Map<string, number>();
  /** Pending in-flight calls — предотвращают дубль-вызовы. */
  private pending = new Set<string>();

  constructor(private readonly sdk: SdkService) {}

  /** Вызывается после save.init() — backfill для existing players. */
  bootstrap(state: ReconcileState): void {
    if (!this.sdk.canUseAchievements()) return;
    // Seed lastProgress из SDK getAchievementProgress (FREE) — чтобы
    // мы не дёргали setProgress на значения которые уже отправлены ранее.
    for (const meta of ACHIEVEMENTS) {
      if (this.sdk.hasAchievement(meta.tag)) {
        this.unlockedCache.add(meta.tag);
        if (meta.max !== undefined) {
          this.lastProgress.set(meta.tag, meta.max);
        }
      } else if (meta.max !== undefined) {
        this.lastProgress.set(meta.tag, this.sdk.getAchievementProgress(meta.tag));
      }
    }
    void this.reconcile(state);
  }

  /** Вызывается после каждого события: win, share, community-join, coin-update. */
  reconcile(state: ReconcileState): void {
    if (!this.sdk.canUseAchievements()) return;
    for (const meta of ACHIEVEMENTS) {
      if (this.unlockedCache.has(meta.tag)) continue;
      if (this.pending.has(meta.tag)) continue;
      const desired = meta.compute(state);
      if (meta.max !== undefined) {
        const num = typeof desired === "number" ? desired : 0;
        const capped = Math.min(num, meta.max);
        const last = this.lastProgress.get(meta.tag) ?? 0;
        if (capped <= last) continue;
        this.pending.add(meta.tag);
        void this.sdk.setAchievementProgress(meta.tag, capped).then((ok) => {
          this.pending.delete(meta.tag);
          if (ok) {
            this.lastProgress.set(meta.tag, capped);
            if (capped >= meta.max!) this.unlockedCache.add(meta.tag);
          }
        });
      } else {
        // One-shot ачивки.
        const should = typeof desired === "boolean" ? desired : desired > 0;
        if (!should) continue;
        this.pending.add(meta.tag);
        void this.sdk.unlockAchievement(meta.tag).then((ok) => {
          this.pending.delete(meta.tag);
          if (ok) this.unlockedCache.add(meta.tag);
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

**Свойства:**
- Один global instance в AppContext.
- `bootstrap()` называется в BootScene после `save.init()`.
- `reconcile(state)` дешёвый — sync вычисление + до 22 SDK-вызовов в худшем
  случае, но обычно 0-3.
- Cache commit-on-success → если SDK transient-fail, следующий reconcile
  retry'ит (M1).
- Backfill автоматический через bootstrap (M2).
- Cap'ится через `Math.min(value, max)` + skip if hasAchievement (C1).
- SaveService не вызывается (M11) — Reconciler читает state снаружи.

**Тесты `AchievementsReconciler.test.ts`:**
- bootstrap seed'ит lastProgress из getAchievementProgress.
- reconcile cap'ит progress по max.
- reconcile skip'ит если pending.
- reconcile не зовёт unlock если уже cached.
- reconcile retry'ит если предыдущий call вернул false.
- canUseAchievements === false → reconcile no-op.

### Phase 4 — `hintCount` как монотонный счётчик

**Решение M6+M7+M8:** хранить `hintCount` в `GameState`, но **НЕ
восстанавливать** его при undo. Это значит:
- В `GameScene.handleUndo()` — после `previousState = this.history.pop()`,
  скопировать `hintCount` из текущего `this.gameState` в восстановленный.
- В `GameScene.handleHintAction()` — увеличить `hintCount`, потом
  `save.updateCurrentGame(this.gameState)` (M7).
- `SaveService.sanitizeGameState(currentGame)` нормализует legacy `hintCount ?? 0` (M8).

**Файлы:**
- `src/core/game-state/types.ts` — `hintCount: number`.
- `src/core/klondike/createInitialDeal.ts` — `hintCount: 0`.
- `src/scenes/GameScene.ts`:
  - `handleHintAction` — `this.gameState.hintCount += 1; save.updateCurrentGame(this.gameState);`
  - `handleUndo` — после `pop` сохранить hintCount: `restored.hintCount = this.gameState.hintCount;`
- `src/services/save/SaveService.ts`:
  - `sanitizeGameState(g)` — нормализует hintCount, undoCount.
  - `init()` — `currentGame: parsed.currentGame ? sanitizeGameState(parsed.currentGame) : null`.
  - `isValidGameState` — проверяет что `hintCount` если задан — валидное число (но **optional** — M8).

**Test fixture (m2):** `createTestGameState(overrides?)` factory в
`src/core/klondike/__test-helpers__/gameState.ts` чтобы новое поле
не ломало 30+ существующих fixture'ов в тестах.

### Phase 5 — Mastery context через RewardSceneData

**`src/scenes/GameScene.ts` — на win:**
```ts
// До clearCurrentGame() запоминаем последний state.
const lastWin = {
  mode: this.gameState.mode,
  dealId: this.gameState.dealId,
  undoCount: this.gameState.undoCount,
  hintCount: this.gameState.hintCount,
};
save.clearCurrentGame();
this.scene.start(SCENES.reward, { mode, dealId, lastWin });
```

**`src/scenes/RewardSceneData`** — добавить optional поле `lastWin`.

**`src/scenes/RewardScene.ts`** — после `save.completeNode`:
```ts
const ach = getAppContext().achievements;
const state = save.load();
ach.reconcile({
  progress: state.progress,
  lastWin: data.lastWin, // от GameScene
  // shareJustSucceeded / communityJustJoined undefined здесь
});
```

**Гейтинг (M9):**
- `data.preview === true` → НЕ зовём reconcile с lastWin.
- `data.returnFromDetail === true` → НЕ зовём reconcile (нет нового события).

### Phase 6 — Триггеры через reconcile()

| Где | Что передаём | Зачем |
|---|---|---|
| `BootScene` после `save.init()` | `bootstrap({ progress })` | Backfill (M2) |
| `RewardScene.create()` (real win) | `reconcile({ progress, lastWin })` | first_win, chapter_*, mastery, character entries, all_artifacts, epilogue |
| `BootScene.onShareResult(success=true)` | `reconcile({ progress, shareJustSucceeded: true })` | first_share |
| `BootScene.onJoinCommunityResult(success=true)` | `reconcile({ progress, communityJustJoined: true })` | first_community_join |
| `SaveService.addCoins` (НЕ зовём!) | — | SaveService остаётся чистым (M11) |
| `GameScene` после `save.addCoins` | `reconcile({ progress })` | coins_500/1000/2000 |
| `RewardScene` после `save.addCoins(adBonus)` | `reconcile({ progress })` | coins_*  |

**`first_entry` (M10):** Reconciler compute = `progress.completedNodes.length > 0`.
DetailScene-open не триггерит — entry «считается прочитанной» только когда узел пройден через RewardScene. Это семантически правильно.

### Phase 7 — UI

**SettingsScene** — кнопка «Достижения» (под language/sound), видна только если `sdk.canUseAchievements()`. Клик → `achievements.openOverlay()`.

**i18n** — добавить ключ `achievements: "Достижения"` × 7 локалей.

### Phase 8 — Регистрация в дашборде (твоя сторона) — ДО деплоя

**Критично (M12):** регистрировать ачивки в `panel.gamepush.com`
**ДО** первого деплоя кода. Иначе при первом запуске SDK calls на
unregistered tags могут вернуть failure → но cache-on-success паттерн
гарантирует retry на следующем событии. Двойная защита.

Чек-лист с переводами 20 ачивок × 7 локалей × (name + description) =
**280 переводов** — отдельный документ
`docs/specs/2026-05-XX-achievements-translations.md`. Готовлю в Phase 9.

**Иконки 256×256:**
- 9 collection-ачивок переиспользуют `assets/artifacts/*_grid.png`
- Остальные 11 — generic icons из GP-built-in pack.

### Phase 9 — Документация переводов

**`docs/specs/2026-05-XX-achievements-translations.md`** — таблица
20 × 7 × 2 (name + description). Атмосферные переводы по тону игры
(humanizer-check rules — без AI-ghost-words, без em-dash separators).

## Verification

- `npm test` — 139 → ~145 ✓ (+6 новых тестов).
- `npm run build` — typecheck чистый.
- `node scripts/packBuild.mjs --target=gamepush` — zip ≤ 37 MB.
- Manual QA:
  - Backfill: открыть игру с уже-полным прогрессом (?dev=unlock-all) →
    проверить что ачивки разлочились через `gp.achievements.list`.
  - Cap test: убедиться что после `coins_2000` повторное `addCoins`
    не дёргает SDK.
  - Mastery: пройти партию без undo и без hint → unlock'нулись `no_undo_win`
    и `no_hint_win`.
  - Hidden: до unlock'а они не видны в overlay; после — появились.
  - Yandex: на Yandex-публикации `canUseAchievements === false` →
    кнопка «Достижения» отсутствует, никаких runtime-ошибок.

## Files

**Новые:**
- `src/data/achievements.ts` (метаданные + compute-функции)
- `src/data/achievements.test.ts`
- `src/services/achievements/AchievementsReconciler.ts`
- `src/services/achievements/AchievementsReconciler.test.ts`
- `src/core/klondike/__test-helpers__/gameState.ts` (factory)
- `docs/specs/2026-05-XX-achievements-translations.md`

**Изменённые:**
- `src/env.d.ts` (+ GamePushAchievements)
- `src/services/sdk/SdkService.ts` (+ 5 методов, без onAchievementUnlock)
- `src/services/sdk/GamePushSdkService.ts` (+ async/await impl)
- `src/services/sdk/YandexSdkService.ts` (+ stubs)
- `src/services/save/SaveService.test.ts` (+ stub методы)
- `src/services/save/SaveService.ts` (+ sanitizeGameState; БЕЗ AppContext-связки)
- `src/core/game-state/types.ts` (+ hintCount)
- `src/core/klondike/createInitialDeal.ts` (+ hintCount: 0)
- `src/scenes/GameScene.ts` (handleHintAction inc + persist; handleUndo preserve hintCount; lastWin context на scene.start)
- `src/scenes/RewardScene.ts` (data.lastWin + reconcile triggers + gates на preview/returnFromDetail; coins_* trigger после ad bonus)
- `src/scenes/BootScene.ts` (bootstrap reconciler после save.init; reconcile в onShareResult/onJoinCommunityResult; AchievementsReconciler в getAppContext)
- `src/scenes/SettingsScene.ts` (+ кнопка «Достижения»)
- `src/scenes/settingsSceneOverlay.ts` (рендер кнопки)
- `src/services/i18n/locales.ts` (+ key `achievements` × 7)
- `src/app/config/appContext.ts` (+ achievements в AppContext)
- `package.json` (0.3.55 → 0.3.56)
- Все existing test fixtures с GameState — заменить на factory

## Risk register (открытые)

| Risk | Mitigation |
|---|---|
| `getAchievementProgress` может быть не sync на самом деле (доку не доверяем 100%) | На impl: попробовать, если async — assume 0 при init и пусть SDK сам игнорирует «неувеличившиеся» вызовы (cap уже идемпотентен) |
| countEntriesByEntity дёргает getNarrativeEntry на каждое compute, может тормозить | `compute()` вызывается 1 раз на reconcile (~5-10 раз в сессию). 30 nodes × lookup = тривиально. Если стало боттлнеком — мемоизировать |
| Регистрация 20 ачивок вручную drift'ит с кодом | Runtime-test после init: `for (const meta of ACHIEVEMENTS) assert sdk.canFindAchievement(meta.tag)`. В DEV-режиме ругается в консоль если ачивка не зарегистрирована |

## Out-of-scope (для следующего плана)

1. Login-streak update logic (`progress.streakCount` инкремент при возврате в игру) → откроет `daily_streak_7/30`.
2. Social-broadcast: после эпических unlock (`epilogue`, `all_artifacts`) — toast с CTA «Поделиться». Требует UI design.
3. VK Direct Games missions (поле `vkMissionId` в дашборде).
