# GamePush Achievements integration plan (v0.3.56)

## Context

Игра v0.3.55 в проде с share/community-кнопками. Пользователь
просит включить второй социальный слой — GamePush achievements.

Дока (читал WebFetch):
- `gp.achievements.unlock({ tag })` — Promise, **+1 quota** на вызов.
- `gp.achievements.setProgress({ tag, progress })` — Promise, **+1 quota**, auto-unlock на max.
- `gp.achievements.has(tag)` — sync, **FREE**.
- `gp.achievements.getProgress(tag)` — sync, **FREE**.
- `gp.achievements.open()` — Promise, **FREE**, открывает встроенный GP overlay.
- Регистрация — в `panel.gamepush.com → Achievements` вручную (tag, имя 7 локалей, описание 7 локалей, иконка 256×256, rarity, maxProgress, lockedVisible).
- **Автопостинга в OK/VK ленту НЕТ** в API — только passive через VK Direct Games missions OR manual share-popup после unlock-event'а.

## Решения пользователя

1. **Объём:** 21 ачивка (full list — progression + collection + mastery + character + coin + social + epilogue).
2. **`no_hint_win`:** добавляем `hintCount` в `GameState` (~10 строк кода + миграция).
3. **Naming:** гибрид — tag технический (`chapter_1_complete`), display name атмосферный («Линия восстановлена»).
4. **Hidden:** скрытые до анлока — `all_artifacts`, `no_undo_win`, `no_hint_win`, `epilogue` (4 шт).

## Game data summary (из exploration)

- **3 главы × 10 нод = 30 точек.**
- **9 артефактов** (3 на главу, на нодах N3, N6, N10).
- **30 записей** (1 на ноду), **5 авторов:** Воронов 10, Левин 6, Мирская 5, Климова 4, Руденко 3 (по report'у; финальная маппа подтвердится на runtime через `getNarrativeSpeakerProfile`).
- **Daily mode:** `progress.streakCount` уже трекается в save state.
- **Engine state:** `undoCount` есть, `hintCount` нет — будем добавлять.
- **Климакс-узел:** `c3n10` → `entry_30` (Воронов, эпилог).

## Список ачивок

### Progression (4)

| Tag | Display name (RU) | Max | Rarity | Hidden | Trigger |
|---|---|---|---|---|---|
| `first_win` | Первый расклад | — | common | no | RewardScene на любом win |
| `chapter_1_complete` | Линия восстановлена | 10 | common | no | setProgress = nodes[c1*].completed.length |
| `chapter_2_complete` | За хребтом | 10 | uncommon | no | то же для c2 |
| `chapter_3_complete` | Архив собран | 10 | rare | no | то же для c3 (= вся игра) |

### Collection (3)

| Tag | Display name | Max | Rarity | Hidden | Trigger |
|---|---|---|---|---|---|
| `first_artifact` | Первая находка | — | common | no | RewardScene при artifactAwarded |
| `first_entry` | Чужой почерк | — | common | no | RewardScene при entryAwarded ИЛИ DetailScene открытие entry-таба |
| `all_artifacts` | Полный архив | 9 | epic | **YES** | setProgress = progress.artifacts.length |

### Mastery (4)

| Tag | Display name | Max | Rarity | Hidden | Trigger |
|---|---|---|---|---|---|
| `no_undo_win` | Без шага назад | — | rare | **YES** | RewardScene на win если `undoCount === 0` |
| `no_hint_win` | Без подсказок | — | rare | **YES** | RewardScene на win если `hintCount === 0` (новое поле) |
| `daily_streak_7` | Неделя на маршруте | 7 | uncommon | no | SaveService.claimDaily setProgress = streakCount |
| `daily_streak_30` | Месяц непрерывно | 30 | rare | no | то же |

### Character entries (5)

| Tag | Display name | Max | Rarity | Hidden | Trigger |
|---|---|---|---|---|---|
| `entries_voronov` | Голос Воронова | 10 | rare | no | setProgress = countCompletedNodesWhereSpeakerIs("voronov") |
| `entries_levin` | Сомнения Левина | 6 | rare | no | … "levin" |
| `entries_mirskaya` | Метки Мирской | 5 | rare | no | … "mirskaya" |
| `entries_klimova` | Архив Климовой | 4 | uncommon | no | … "klimova" |
| `entries_rudenko` | Поправки Руденко | 3 | uncommon | no | … "rudenko" |

### Coin economy (3)

| Tag | Display name | Max | Rarity | Hidden | Trigger |
|---|---|---|---|---|---|
| `coins_500` | 500 монет | 500 | uncommon | no | SaveService.addCoins setProgress = progress.coins |
| `coins_1000` | Полный карман | 1000 | rare | no | то же |
| `coins_2000` | Снаряжение готово | 2000 | epic | no | то же |

### Social (1)

| Tag | Display name | Max | Rarity | Hidden | Trigger |
|---|---|---|---|---|---|
| `first_share` | Кому-то рассказано | — | common | no | BootScene global onShareResult listener при success === true |

### Story (1)

| Tag | Display name | Max | Rarity | Hidden | Trigger |
|---|---|---|---|---|---|
| `epilogue` | На последнем листе | — | legendary | **YES** | DetailScene при открытии node `c3n10` (entry_30) ИЛИ когда `c3n10` пройдена |

**Итого: 21 ачивка. 4 hidden. Rarity-распределение:** 5 common / 5 uncommon / 8 rare / 2 epic / 1 legendary.

## Архитектура кода

### Phase 1 — SDK слой

**Файлы:** `src/services/sdk/SdkService.ts`, `GamePushSdkService.ts`, `YandexSdkService.ts`, `SaveService.test.ts` (stub), `src/env.d.ts` (GamePushSDK типы).

Добавить в SdkService:
```ts
canUseAchievements(): boolean;
hasAchievement(tag: string): boolean;
unlockAchievement(tag: string): Promise<void>;
setAchievementProgress(tag: string, progress: number): Promise<void>;
openAchievementsOverlay(): Promise<void>;
onAchievementUnlock(callback: (tag: string) => void): void;
```

В env.d.ts расширить `GamePushSDK` интерфейсом `GamePushAchievements`.

GamePushSdkService — реализация через `gp.achievements.*` с `async/await + try/catch` (уроки gp-012 из plan-mistakes).

YandexSdkService — stubs (canUseAchievements → false, has → false, unlock/setProgress no-op, open() resolved).

### Phase 2 — Domain layer

**Новый файл:** `src/services/achievements/AchievementsService.ts`

```ts
import type { SdkService } from "@/services/sdk/SdkService";

/**
 * Domain wrapper над gp.achievements. Решает 2 проблемы:
 * 1. Каждый unlock = +1 quota — гарантируем ровно 1 вызов на ачивку
 *    через локальный Set + has() guard.
 * 2. setProgress тоже +1 quota — skip если новый прогресс ≤ последнего.
 */
export class AchievementsService {
  private unlockedCache = new Set<string>();
  private lastProgress = new Map<string, number>();

  constructor(private readonly sdk: SdkService) {}

  /** One-shot unlock. Безопасно вызывать многократно. */
  tryUnlock(tag: string): void {
    if (!this.sdk.canUseAchievements()) return;
    if (this.unlockedCache.has(tag)) return;
    if (this.sdk.hasAchievement(tag)) {
      this.unlockedCache.add(tag);
      return;
    }
    void this.sdk.unlockAchievement(tag);
    this.unlockedCache.add(tag);
  }

  /** Прогресс. Skip если не выросло. */
  trySetProgress(tag: string, progress: number): void {
    if (!this.sdk.canUseAchievements()) return;
    const last = this.lastProgress.get(tag) ?? 0;
    if (progress <= last) return;
    this.lastProgress.set(tag, progress);
    void this.sdk.setAchievementProgress(tag, progress);
  }

  /** Открыть GP overlay со списком ачивок. */
  openOverlay(): void {
    if (!this.sdk.canUseAchievements()) return;
    void this.sdk.openAchievementsOverlay();
  }
}
```

Прокинуть в `getAppContext()` под именем `achievements`.

### Phase 3 — Constants + helpers

**Новый файл:** `src/data/achievements.ts`

```ts
export const ACH = {
  FIRST_WIN: "first_win",
  CHAPTER_1: "chapter_1_complete",
  CHAPTER_2: "chapter_2_complete",
  CHAPTER_3: "chapter_3_complete",
  FIRST_ARTIFACT: "first_artifact",
  FIRST_ENTRY: "first_entry",
  ALL_ARTIFACTS: "all_artifacts",
  NO_UNDO_WIN: "no_undo_win",
  NO_HINT_WIN: "no_hint_win",
  DAILY_7: "daily_streak_7",
  DAILY_30: "daily_streak_30",
  ENTRIES_VORONOV: "entries_voronov",
  ENTRIES_LEVIN: "entries_levin",
  ENTRIES_MIRSKAYA: "entries_mirskaya",
  ENTRIES_KLIMOVA: "entries_klimova",
  ENTRIES_RUDENKO: "entries_rudenko",
  COINS_500: "coins_500",
  COINS_1000: "coins_1000",
  COINS_2000: "coins_2000",
  FIRST_SHARE: "first_share",
  EPILOGUE: "epilogue",
} as const;
export type AchievementTag = typeof ACH[keyof typeof ACH];
```

Helper для подсчёта entry-by-author:
```ts
// src/data/achievements.ts
export function countCompletedEntriesByAuthor(
  completedNodes: string[],
  authorEntityId: string,
): number {
  return completedNodes.filter((nodeId) => {
    const node = getNodeById(nodeId);
    if (!node?.entryId) return false;
    const entry = getNarrativeEntry(node.entryId, "ru"); // canonical
    return entry?.speakerEntityId === authorEntityId;
  }).length;
}
```

### Phase 4 — `hintCount` в GameState (для no_hint_win)

**Файлы:** `src/core/game-state/types.ts`, `createInitialDeal.ts`, `GameScene.ts`, `SaveService.ts`.

```ts
// types.ts
export type GameState = {
  ...
  undoCount: number;
  hintCount: number; // NEW v0.3.56
};

// createInitialDeal.ts
return {
  ...,
  undoCount: 0,
  hintCount: 0, // NEW
};

// GameScene.handleHintAction — после save.addCoins(-cost):
this.gameState.hintCount = (this.gameState.hintCount ?? 0) + 1;

// SaveService.isValidGameState — после undoCount валидации:
if (g.hintCount !== undefined && !isBoundedInt(g.hintCount, 0, MAX_UNDOS)) return false;

// При hydrating legacy save — нормализация:
return {
  ...,
  hintCount: g.hintCount ?? 0,
};
```

### Phase 5 — Триггеры

**RewardScene.create()** — после `save.completeNode`:
```ts
const ach = getAppContext().achievements;
ach.tryUnlock(ACH.FIRST_WIN);

const completed = save.load().progress.completedNodes;
const c1 = completed.filter(id => id.startsWith("c1n")).length;
const c2 = completed.filter(id => id.startsWith("c2n")).length;
const c3 = completed.filter(id => id.startsWith("c3n")).length;
ach.trySetProgress(ACH.CHAPTER_1, c1);
ach.trySetProgress(ACH.CHAPTER_2, c2);
ach.trySetProgress(ACH.CHAPTER_3, c3);

// Mastery — на текущей выигранной партии (this.gameState — через resumeCurrentGame
// мы только что её "прошли"). На момент completeNode currentGame ещё в save.
// Альтернатива: передать через RewardSceneData.gameState поле undoCount/hintCount.
// (Решить точно в impl — пока mark TODO.)
```

**RewardScene.create()** — после reveal-items:
```ts
if (artifactAwarded) {
  ach.tryUnlock(ACH.FIRST_ARTIFACT);
  ach.trySetProgress(ACH.ALL_ARTIFACTS, save.load().progress.artifacts.length);
}
if (revealItems.some(i => i.type === "entry")) {
  ach.tryUnlock(ACH.FIRST_ENTRY);
}

// Character entries
const completed = save.load().progress.completedNodes;
ach.trySetProgress(ACH.ENTRIES_VORONOV, countCompletedEntriesByAuthor(completed, "voronov"));
ach.trySetProgress(ACH.ENTRIES_LEVIN, countCompletedEntriesByAuthor(completed, "levin"));
// … 3 остальных

// Epilogue (story-trigger)
if (this.dealId === "c3n10") {
  ach.tryUnlock(ACH.EPILOGUE);
}
```

**SaveService.claimDaily()** — после updateProgress:
```ts
const newStreak = nextState.progress.streakCount;
getAppContext().achievements.trySetProgress(ACH.DAILY_7, newStreak);
getAppContext().achievements.trySetProgress(ACH.DAILY_30, newStreak);
```

**SaveService.addCoins()** — после updateProgress:
```ts
const newCoins = nextState.progress.coins;
const ach = getAppContext().achievements;
ach.trySetProgress(ACH.COINS_500, newCoins);
ach.trySetProgress(ACH.COINS_1000, newCoins);
ach.trySetProgress(ACH.COINS_2000, newCoins);
```

**BootScene** — global onShareResult listener (уже там):
```ts
sdk.onShareResult((success) => {
  // ... existing analytics
  if (success) getAppContext().achievements.tryUnlock(ACH.FIRST_SHARE);
});
```

### Phase 6 — UI: открыть overlay

**SettingsScene** — добавить новую action-кнопку «Достижения» (под language/sound секциями), видимую только если `sdk.canUseAchievements()`. Клик → `achievements.openOverlay()`.

Альтернативно — иконка-кнопка «🏆» рядом с mute/community на MapScene. Решить в impl — но Settings секция проще на старте.

### Phase 7 — i18n

В `src/services/i18n/locales.ts` добавить 1 ключ × 7 локалей:
- `achievements`: "Достижения" / "Achievements" / etc.

Display names ачивок **НЕ в коде** — все 21 × 7 = 147 переводов регистрируются в panel.gamepush.com при создании ачивки. Для подготовки — отдельная таблица в `docs/specs/2026-05-XX-achievements-translations.md`.

### Phase 8 — Тесты

- `src/services/achievements/AchievementsService.test.ts`:
  - `tryUnlock` дёргает sdk.unlock только один раз для одного tag.
  - `tryUnlock` skip если sdk.has() === true.
  - `trySetProgress` skip если новый ≤ последнего.
  - При `canUseAchievements === false` все методы no-op.
- `src/data/achievements.test.ts`:
  - `countCompletedEntriesByAuthor` правильно считает по reference data.
- Регрессионный тест в `gameSceneUndo.test.ts` (или новый):
  - `hintCount` инкрементится при hint, обнуляется в новой раздаче.

### Phase 9 — Регистрация в дашборде (твоя сторона)

Чек-лист 21 ачивка × все поля. Готовлю отдельный markdown с табличкой, копировать вручную в panel.gamepush.com:
- tag (точное совпадение с `ACH.*` константой)
- name × 7 локалей (атмосферные, см. таблицу выше)
- description × 7 локалей (одно-двух-фразные, как «уже существует» / «прогресс N/M»)
- icon 256×256 (брать из существующих ассетов: артефакты для collection-ачивок, generic icons для остальных через GP-built-in pack)
- rarity (см. таблицу)
- maxProgress (см. таблицу)
- lockedVisible (false для 4 hidden)

## Verification

- `npm test` — 139 → ~145 ✓ (+6 новых тестов)
- `npm run build` — typecheck чистый
- `node scripts/packBuild.mjs --target=gamepush` — zip ≤ 37 MB
- Manual QA:
  - Открыть `?dev=socials` (или новый `?dev=achievements`) — кнопка «Достижения» в Settings появляется
  - Выиграть partию → first_win unlock'ается (видно через console)
  - Найти артефакт → first_artifact + all_artifacts progress
  - Daily 2 дня подряд → daily_streak_7 progress 2
  - Поделиться → first_share unlock
- Bump version → 0.3.56, коммит, push, заливка на GP
- В дашборде GP создать 21 ачивку (Phase 9)

## Files (consolidated)

**Новые:**
- `src/services/achievements/AchievementsService.ts`
- `src/services/achievements/AchievementsService.test.ts`
- `src/data/achievements.ts`
- `src/data/achievements.test.ts`
- `docs/specs/2026-05-XX-achievements-translations.md` (таблица переводов для дашборда)

**Изменённые:**
- `src/env.d.ts` (+ GamePushAchievements интерфейс)
- `src/services/sdk/SdkService.ts` (+ 6 методов)
- `src/services/sdk/GamePushSdkService.ts` (+ реализация)
- `src/services/sdk/YandexSdkService.ts` (+ stubs)
- `src/services/save/SaveService.test.ts` (stub fixture)
- `src/services/save/SaveService.ts` (hintCount в isValidGameState + claimDaily/addCoins triggers)
- `src/core/game-state/types.ts` (+ hintCount)
- `src/core/klondike/createInitialDeal.ts` (+ hintCount: 0)
- `src/scenes/GameScene.ts` (+ hintCount inc в handleHintAction)
- `src/scenes/RewardScene.ts` (триггеры: first_win, chapter_N, first_artifact, first_entry, all_artifacts, no_undo/hint_win, character entries, epilogue)
- `src/scenes/BootScene.ts` (+ first_share trigger в onShareResult listener; + AchievementsService instantiation в getAppContext)
- `src/scenes/SettingsScene.ts` (+ кнопка «Достижения»)
- `src/scenes/settingsSceneOverlay.ts` (+ achievements кнопка)
- `src/services/i18n/locales.ts` (+ key `achievements` × 7)
- `src/app/config/appContext.ts` (+ achievements в AppContext)
- `package.json` (0.3.55 → 0.3.56)

## Risks / mitigations

| Risk | Mitigation |
|---|---|
| Quota: setProgress на addCoins срабатывает на каждое начисление монет — может быть много вызовов | trySetProgress skip'ает если progress не вырос. После достижения maxProgress (например, coins_500 при 500+) больше не отправляется. |
| Migration legacy save без hintCount | Tolerance в isValidGameState (gp-006 pattern) — undefined → 0, не сбрасываем currentGame. |
| Регистрация 21 ачивки вручную в дашборде = drift | Чек-лист в `docs/specs/...-achievements-translations.md`. Тест на runtime — что все ACH.* константы соответствуют существующим в дашборде (через `gp.achievements.list` после init). |
| character-entry counter требует runtime lookup speakerEntityId по entryId | Уже есть `getNarrativeEntry` + `getNarrativeSpeakerProfile`. Проверить что они работают на canonical "ru" локали — не зависят от UI-locale пользователя. |
| RewardScene.completeNode уже мутировал save — currentGame=null, hintCount/undoCount недоступны | В RewardScene.create передавать в `RewardSceneData` дополнительные поля `lastUndoCount`, `lastHintCount` от GameScene при scene.start. Или: проверять в GameScene **до** сцены-перехода. |
| icon 256×256 для 21 ачивки требует 21 png | Reuse существующих artifact-png (9 шт) для соответствующих ачивок. Generic GP-pack icons для оставшихся 12. ~30 минут работы в дашборде, без новых ассетов в репо. |

## Open items для self-review (не вопросы пользователю)

- **Climax trigger:** epilogue — лучше тригерить на open DetailScene `c3n10` (где сам entry_30) или на complete (когда игрок выиграл партию `c3n10`)? Я выбрал complete — игрок гарантированно прошёл. Если хочется триггерить при чтении текста — добавить в DetailScene render() check.
- **Mastery scope:** no_undo_win/no_hint_win — за каждую партию или только за adventure (не daily/quick-play)? Решил: за любую партию (daily тоже ценится). Если daily-win неуместен — добавить gate `mode === "adventure"`.
