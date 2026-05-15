# GamePush Achievements integration plan (v0.3.56) — round 4

## Round 1 + 2 + 3 итог

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

**Итого: 20 ачивок.** 4 hidden.

**Backlog:** `daily_streak_7`, `daily_streak_30` — после login-streak update logic.

## Архитектура: Reconciler pattern (R4 версия)

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

  { tag: "no_undo_win", hidden: true, compute: (s) =>
      Boolean(s.progress.achievementFacts?.noUndoWinEver) ||
      Boolean(s.lastWin && s.lastWin.undoCount === 0) },
  { tag: "no_hint_win", hidden: true, compute: (s) =>
      Boolean(s.progress.achievementFacts?.noHintWinEver) ||
      Boolean(s.lastWin && s.lastWin.hintCount === 0) },

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

  { tag: "coins_500", max: 500, compute: (s) => s.progress.coins },
  { tag: "coins_1000", max: 1000, compute: (s) => s.progress.coins },
  { tag: "coins_2000", max: 2000, compute: (s) => s.progress.coins },

  { tag: "first_share", compute: (s) =>
      Boolean(s.progress.achievementFacts?.sharedEver) },
  { tag: "first_community_join", compute: (s) =>
      Boolean(s.progress.achievementFacts?.communityJoinedEver) },

  { tag: "epilogue", hidden: true, compute: (s) =>
      s.progress.completedNodes.includes("c3n10") },
];
```

### Phase 2 — SDK слой (R3 fix M2 + M3 + M4)

**`src/services/sdk/SdkService.ts`** интерфейс:

```ts
canUseAchievements(): boolean;
hasAchievement(tag: string): boolean;
/** R3 fix M3: подгружает свежий список перед bootstrap-seed. */
fetchAchievements(): Promise<void>;
/** Sync-чтение `gp.achievements.playerAchievementsList`. */
getPlayerAchievements(): Array<{ tag: string; progress: number; unlocked: boolean }>;
/** R3 fix M4: true = SDK write принят без error (НЕ "unlocked"). */
unlockAchievement(tag: string): Promise<boolean>;
setAchievementProgress(tag: string, progress: number): Promise<boolean>;
openAchievementsOverlay(): Promise<void>;
```

**`GamePushSdkService`** — через `gp.achievements.*` (R3 fix M2 — НЕ `gp.socials.*`):

```ts
async fetchAchievements(): Promise<void> {
  if (!this.gp?.achievements?.fetch) return;
  try { await this.gp.achievements.fetch(); }
  catch (e) { console.warn("[gp] achievements.fetch failed", e); }
}

getPlayerAchievements(): Array<{ tag: string; progress: number; unlocked: boolean }> {
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
    await this.gp.achievements.setProgress({ tag, progress });
    return true;  // R3 fix M4: write принят (НЕ unlock-status).
  } catch (e) {
    console.warn("[gp] achievements.setProgress failed", e);
    return false;
  }
}

async unlockAchievement(tag: string): Promise<boolean> {
  if (!this.gp?.achievements?.unlock) return false;
  try { await this.gp.achievements.unlock({ tag }); return true; }
  catch (e) { console.warn("[gp] achievements.unlock failed", e); return false; }
}
```

**`env.d.ts`** — `GamePushAchievements` интерфейс с `playerAchievementsList`, `fetch`, `setProgress`, `unlock`. В `GamePushSDK` — `achievements?: GamePushAchievements` (R3 fix M2). `socials` НЕ имеет `playerAchievementsList`.

**Тест GamePushSdkService (защита от typo):** mock без `gp.socials.playerAchievementsList` — `getPlayerAchievements` должен читать только `gp.achievements.playerAchievementsList`.

### Phase 3 — `progress.achievementFacts` + `achievementUnlocked`

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
  achievementFacts?: AchievementFacts;
  achievementProgress?: Record<string, number>;
  /** R3 fix M3: durable record успешно отправленных unlock'ов. */
  achievementUnlocked?: Record<string, true>;
};
```

`SaveService.sanitizeProgress` нормализует undefined → `{}` для всех трёх optional полей.

**API для durable facts** (вне SaveService):
- `recordSharedEver()`, `recordCommunityJoinedEver()`, `recordNoUndoWinEver()`, `recordNoHintWinEver()` — пишут в `progress.achievementFacts`.
- Зовутся в BootScene.onShareResult/onJoinCommunityResult и RewardScene при nodeJustCompleted.

### Phase 4 — Reconciler (R4 версия — все R3 fixes применены)

```ts
import { ACHIEVEMENTS, type ReconcileState } from "@/data/achievements";
import type { SdkService } from "@/services/sdk/SdkService";

export class AchievementsReconciler {
  private unlockedCache = new Set<string>();
  private lastProgress = new Map<string, number>();
  private pendingDesired = new Map<string, number>();
  private pendingUnlocks = new Set<string>();

  constructor(
    private readonly sdk: SdkService,
    private readonly persistProgress: (tag: string, progress: number) => void,
    /** R3 fix M3 */
    private readonly persistUnlocked: (tag: string) => void,
  ) {}

  /** R3 fix M3: async — fetch перед чтением sync list. */
  async bootstrap(state: ReconcileState): Promise<void> {
    if (!this.sdk.canUseAchievements()) return;
    await this.sdk.fetchAchievements();
    const list = this.sdk.getPlayerAchievements();
    for (const { tag, progress, unlocked } of list) {
      if (unlocked) this.unlockedCache.add(tag);
      else if (progress > 0) this.lastProgress.set(tag, progress);
    }
    // R3 fix M3: union с persisted achievementUnlocked.
    const persistedUnlocked = state.progress.achievementUnlocked ?? {};
    for (const tag of Object.keys(persistedUnlocked)) {
      this.unlockedCache.add(tag);
    }
    const persistedProgress = state.progress.achievementProgress ?? {};
    for (const [tag, value] of Object.entries(persistedProgress)) {
      if (!this.lastProgress.has(tag) && !this.unlockedCache.has(tag)) {
        this.lastProgress.set(tag, value);
      }
    }
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

        if (this.pendingDesired.has(meta.tag)) {
          const prev = this.pendingDesired.get(meta.tag)!;
          if (capped > prev) this.pendingDesired.set(meta.tag, capped);
          continue;
        }

        this.pendingDesired.set(meta.tag, capped);
        const tag = meta.tag;
        const max = meta.max;
        void this.sdk.setAchievementProgress(tag, capped)
          .then((ok) => {
            // R3 fix M1: latest из Map ДО finally-delete.
            const latestDesired = this.pendingDesired.get(tag) ?? capped;
            // R3 fix M4: ok=true = write принят. Коммитим независимо от unlock.
            if (ok) {
              this.lastProgress.set(tag, capped);
              this.persistProgress(tag, capped);
              if (capped >= max) {
                this.unlockedCache.add(tag);
                this.persistUnlocked(tag); // R3 fix M3
              }
              if (latestDesired > capped) this.reconcile(state);
            }
          })
          .catch((err) => { console.warn("[ach] setProgress threw", tag, err); })
          .finally(() => { this.pendingDesired.delete(tag); }); // R3 fix M-MINOR1
      } else {
        if (this.pendingUnlocks.has(meta.tag)) continue;
        const should = typeof desired === "boolean" ? desired : desired > 0;
        if (!should) continue;

        this.pendingUnlocks.add(meta.tag);
        const tag = meta.tag;
        void this.sdk.unlockAchievement(tag)
          .then((ok) => {
            if (ok) {
              this.unlockedCache.add(tag);
              this.persistUnlocked(tag); // R3 fix M3
            }
          })
          .catch((err) => { console.warn("[ach] unlock threw", tag, err); })
          .finally(() => { this.pendingUnlocks.delete(tag); }); // R3 fix M-MINOR1
      }
    }
  }

  openOverlay(): void {
    if (!this.sdk.canUseAchievements()) return;
    void this.sdk.openAchievementsOverlay();
  }
}
```

**Тесты AchievementsReconciler.test.ts:**
- bootstrap await'ит fetchAchievements ДО чтения list.
- bootstrap seed'ит unlockedCache из union (SDK list ∪ persisted achievementUnlocked).
- SDK list пустой + persisted achievementUnlocked содержит first_share → НЕ повторный unlock.
- reconcile cap'ит progress по max.
- **R3 fix M1**: in-flight setProgress(1900), второй reconcile с desired=2050 → pendingDesired.set(tag, 2000). После resolve `pendingDesired.get(tag)` возвращает 2000 → второй setProgress(2000).
- **R3 fix M4**: setProgress(chapter_1_complete, 3) → ok=true, lastProgress=3, unlockedCache БЕЗ chapter_1. Следующий reconcile с тем же desired=3 → no SDK call.
- **R3 fix M4**: setProgress(chapter_1_complete, 10) → unlockedCache.add + persistUnlocked called.
- При SDK fail (ok=false) → cache не обновляется.
- **R3 fix M-MINOR1**: SDK throws → catch logs, finally чистит pendingDesired/pendingUnlocks.
- canUseAchievements===false → no-op.
- One-shot unlock не зовёт SDK дважды; на success → persistUnlocked called.

### Phase 5 — `hintCount` монотонный + миграция (R3 fix M5)

**Runtime:**
- `handleHintAction` — `state.hintCount++` + persist.
- `handleUndo` — restored state получает prev `undoCount` от history, но `hintCount` берётся из CURRENT state (монотонный).

**R3 fix M5 — explicit migration order в SaveService.init:**

```ts
const json = await sdk.loadCloudSave();
const parsed = json ? safeJsonParse(json) : null;

// Шаг 1: validate. isValidGameState принимает legacy без hintCount.
if (parsed && isValidSaveState(parsed)) {
  // Шаг 2: sanitize.
  this.state = {
    progress: sanitizeProgress(parsed.progress),
    currentGame: parsed.currentGame ? sanitizeGameState(parsed.currentGame) : null,
  };
} else {
  // ... fallback
}
```

**`isValidGameState`** — hintCount optional:
```ts
export function isValidGameState(g: unknown): g is GameState {
  // ... existing checks ...
  if (g && typeof g === "object" && "hintCount" in g) {
    if (typeof (g as any).hintCount !== "number") return false;
  }
  return true;  // hintCount missing = ok (legacy)
}
```

**`sanitizeGameState`** — выставляет default:
```ts
export function sanitizeGameState(g: GameState): GameState {
  return { ...g, hintCount: typeof g.hintCount === "number" ? g.hintCount : 0 };
}
```

**Тесты SaveService.test.ts:**
- Legacy без hintCount в currentGame → init: state.currentGame !== null AND state.currentGame.hintCount === 0.
- Legacy без currentGame (null) → state.currentGame === null.
- Save с hintCount: 5 → preserved.
- Невалидный save → fallback на default.

### Phase 6 — RewardScene с explicit gating

```ts
const { mode, dealId, preview, returnFromDetail, lastWin } = data;
const wasAlreadyCompleted = save.load().progress.completedNodes.includes(dealId);

const nodeJustCompleted =
  !preview && !returnFromDetail && mode === "adventure" &&
  !wasAlreadyCompleted && Boolean(dealId);

const dailyJustClaimed =
  !preview && !returnFromDetail && mode === "daily" &&
  save.load().progress.dailyClaimedOn !== getDailyDateKey();

if (nodeJustCompleted) {
  save.completeNode(dealId, ...);
  if (lastWin && lastWin.undoCount === 0) recordNoUndoWinEver();
  if (lastWin && lastWin.hintCount === 0) recordNoHintWinEver();
  ach.reconcile({ progress: save.load().progress, lastWin });
} else if (dailyJustClaimed) {
  save.claimDaily(dateKey);
  ach.reconcile({ progress: save.load().progress });
}
```

### Phase 7 — Триггеры reconcile()

| Где | Действие |
|---|---|
| BootScene после save.init() | `void bootstrap({ progress })` (async, fire-and-forget) |
| RewardScene при nodeJustCompleted=true | reconcile({ progress, lastWin }) |
| RewardScene при dailyJustClaimed=true | reconcile({ progress }) |
| RewardScene/GameScene после save.addCoins(*) | reconcile({ progress }) |
| BootScene.onShareResult(success) | recordSharedEver(); reconcile({ progress }) |
| BootScene.onJoinCommunityResult(success) | recordCommunityJoinedEver(); reconcile({ progress }) |

### Phase 8 — UI

SettingsScene — кнопка «Достижения», видна если canUseAchievements(). Клик → openOverlay().
i18n — `achievements: "Достижения"` × 7 локалей.

### Phase 9 — Регистрация в дашборде ДО деплоя

20 ачивок × 7 локалей × (name + description) = 280 переводов.

Иконки 256×256: 9 collection (`assets/artifacts/*_grid.png`) + 11 generic (GP-built-in).

### Phase 10 — Документация

`docs/specs/2026-05-XX-achievements-translations.md` — таблица 20 × 7 × 2.

## Verification

- npm test — 139 → ~152 ✓ (+13 тестов).
- npm run build — typecheck чистый. gp.achievements.* (НЕ gp.socials.*) в env.d.ts.
- node scripts/packBuild.mjs --target=gamepush — zip ≤ 37 MB.
- Manual QA:
  - Backfill: hasAchievement=false для всех + completedNodes=[все], coins=2000 → bootstrap fetch + reconcile с unlock'ами.
  - **Pending latest re-check (R3 fix M1)**: setProgress(coins_2000, 1900) с delay 500ms; coins растут до 2050 → pendingDesired=2000; после resolve → второй setProgress(2000).
  - **Persisted unlock survives empty SDK list (R3 fix M3)**: первая сессия unlock first_share → persisted. Вторая сессия — getPlayerAchievements()=[] → unlockedCache содержит first_share → no повторный unlock.
  - **Partial progress (R3 fix M4)**: setProgress(chapter_1_complete, 3) → ok=true, lastProgress=3. Следующий reconcile с тем же desired → no SDK call.
  - Durable facts: SDK fail на first_share → recordSharedEver уже сохранил факт; следующая сессия retry'ит unlock.
  - **hintCount migration (R3 fix M5)**: legacy save без hintCount → init принимает, sanitize выставляет 0; currentGame !== null.
  - Mastery: пройти партию без undo+hint → no_undo_win и no_hint_win unlock.
  - Yandex: canUseAchievements=false → кнопка отсутствует.

## Files (consolidated)

**Новые:**
- src/data/achievements.ts (+ tests)
- src/services/achievements/AchievementsReconciler.ts (+ tests)
- src/services/achievements/recordFacts.ts
- src/core/klondike/__test-helpers__/gameState.ts
- docs/specs/2026-05-XX-achievements-translations.md

**Изменённые:**
- src/env.d.ts (+ GamePushAchievements; achievements? в GamePushSDK — R3 fix M2)
- src/services/sdk/SdkService.ts (6 методов; +fetchAchievements — R3 fix M3)
- src/services/sdk/GamePushSdkService.ts (gp.achievements.* — R3 fix M2; Promise<boolean>="write accepted" — R3 fix M4)
- src/services/sdk/YandexSdkService.ts
- src/services/save/SaveService.ts (+ achievementFacts/Progress/Unlocked sanitize; sanitizeGameState; explicit migration order — R3 fix M5)
- src/services/save/SaveService.test.ts
- src/core/game-state/types.ts (+ hintCount, AchievementFacts, achievementUnlocked optional)
- src/core/game-state/validation.ts (isValidGameState принимает legacy без hintCount — R3 fix M5)
- src/core/klondike/createInitialDeal.ts (+ hintCount: 0)
- src/scenes/GameScene.ts (handleHintAction inc + persist; handleUndo preserve hintCount; lastWin context)
- src/scenes/RewardScene.ts (nodeJustCompleted explicit; recordFacts; reconcile triggers)
- src/scenes/BootScene.ts (void bootstrap(); recordFacts in onShareResult/onJoinCommunityResult)
- src/scenes/SettingsScene.ts (+ achievements кнопка)
- src/services/i18n/locales.ts (+ achievements key × 7)
- src/app/config/appContext.ts (+ achievements; persistProgress + persistUnlocked callbacks)
- package.json (0.3.55 → 0.3.56)

## Risk register

| Risk | Mitigation |
|---|---|
| gp.achievements.fetch() deprecated per docs | Всё ещё работает; try/catch глушит, fallback на sync read. |
| playerAchievementsList пустой при network glitch | R3 fix M3: union с achievementUnlocked. |
| recordFacts требует AppContext.save готовности | BootScene создаёт save → setAppContext → потом listeners. |
| Recursive reconcile → infinite loop | Защита: re-check только если latestDesired > capped; cap при достижении max → skip-by-cap. |
| countEntriesByEntity использует "ru" entries | getNarrativeEntry читает in-memory data, не fetches. Safe. |
| Unexpected reject в SDK wrapper | R3 fix M-MINOR1: catch+finally чистят pending. |

## Out-of-scope

1. Login-streak update logic → daily_streak_7/30.
2. Toast с CTA после epic unlock.
3. VK Direct Games missions.
