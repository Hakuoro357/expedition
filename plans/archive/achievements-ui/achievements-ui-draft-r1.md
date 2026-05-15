# Achievements UI page + entry points (v0.3.58)

## Context

В v0.3.56-57 ачивки реализованы на backend (Reconciler + 20 ачивок в GP) но
у игрока **нет UI** где можно посмотреть свой прогресс. Кнопка в Settings была
заглушкой и убрана. Нужно полноценный экран со списком + входные точки.

**Цель:** игрок видит свой прогресс по 20 ачивкам, разбитым на 6 групп,
с прогресс-барами для milestone-ачивок и locked-силуэтами для скрытых.
Reward-loop усиливается — игрок может заглянуть и увидеть «осталось 3 узла
до главы 2».

## Solution overview

1. **AchievementsScene** — новая сцена с DOM-overlay
2. **TitleScene** — 4-я кнопка «Ачивки» (между «Начать» и «Настройки»)
3. **MapScene top-bar** — монеты слева, иконка трофея справа (clickable)
4. **Settings** — остаётся в bottom-nav, никаких top-entry для него
5. **Trophy icon** — новый SVG в стиле проекта (outline, brass amber)

## Layout choices (per user input)

- **Top-LEFT** на MapScene: счётчик монет (иконка `coin` + число)
- **Top-RIGHT** на MapScene: trophy icon → AchievementsScene
  - Существующие mute/community buttons остаются справа ниже trophy
- **Hidden achievements** в списке: показывать с locked-силуэтом + name «???»
- **Trophy icon source**: новый SVG в стиле остальных nav-icons (outline + brass currentColor)

## Files to create

### `src/assets/ui/nav-icons/trophy.svg` (new)
Outline-trophy 24×24, `currentColor` stroke. Match other nav-icons style.

### `src/scenes/AchievementsScene.ts` (new)
По образцу `DiaryScene.ts`:
- Constructor: `super(SCENES.achievements)`
- `create(data?: { returnTo?: "title" | "map" })`:
  - background (gradient или коллаж — пока gradient)
  - читает `ACHIEVEMENTS` + `sdk.getPlayerAchievements()` + `save.load().progress`
  - строит `AchievementsViewModel[]` per group
  - render overlay
  - bind back-button → `returnTo` или `SCENES.title` по умолчанию

### `src/scenes/achievementsSceneOverlay.ts` (new)
```ts
type Params = {
  title: string;             // "Достижения"
  groups: AchievementsGroupVm[];
  backLabel: string;
  navItems?: AppNavItem[];   // если открыто из MapScene — стандартный bottom-nav
};

type AchievementsGroupVm = {
  tag: string;              // "path" / "archive" / etc
  title: string;            // "Путь"
  items: AchievementItemVm[];
};

type AchievementItemVm = {
  tag: string;
  iconUrl: string;          // GP CDN URL или dist/achievement-icons/<tag>.png
  lockedIconUrl?: string;
  title: string;            // "Первый расклад" или "???"
  description: string;      // или "" если hidden+locked
  progressLabel?: string;   // "7/10" или undefined для one-shot
  progressPct?: number;     // 0..100 для бара
  unlocked: boolean;
  hidden: boolean;
  visuallyLocked: boolean;  // hidden && !unlocked → силуэт + "???"
};
```
HTML структура: `<section>` per group, внутри список `<article class="achievement-card">`
с иконкой, заголовком, описанием, прогресс-баром.

### `src/scenes/achievementsSceneOverlay.test.ts` (new)
- Renders 6 group sections
- Hidden+locked achievement shows "???" not real name
- Progress bar 7/10 → width 70%
- Unlocked one-shot shows ✓ check mark
- Back button рендерится

## Files to modify

### `src/app/config/gameConfig.ts`
Добавить `achievements: "achievements"` в `SCENES`.

### `src/app/bootstrap/createGame.ts`
Добавить `AchievementsScene` в `scenes` array (после `SettingsScene`).

### `src/ui/appNavHtml.ts`
Расширить `AppNavItem.id` union — добавить `"achievements"`.
Добавить case в `createAppNavIconHtml` (импортить trophy.svg).

### `src/scenes/titleSceneOverlay.ts`
Добавить новую кнопку «Ачивки» с `data-title-action="achievements"`.
Render условный — если `canUseAchievements` true.

### `src/scenes/TitleScene.ts`
- Прокинуть `achievementsLabel` и `showAchievementsButton` в overlay params
- Добавить обработчик клика → `this.scene.start(SCENES.achievements, { returnTo: "title" })`

### `src/scenes/routeSceneOverlay.ts`
Добавить в params:
- `coins: number` — для верхнего левого блока
- `coinsAriaLabel?: string`
- `showAchievementsButton?: boolean`
- `achievementsAriaLabel?: string`

Render:
- Top-LEFT block: `<div class="route-overlay__coins">{COIN_ICON_HTML}<span>{coins}</span></div>`
- Top-RIGHT trophy button: `<button class="route-overlay__achievements" type="button" data-route-action="open-achievements">{trophyIcon}</button>`
  - Размещается выше существующих mute/community

### `src/scenes/MapScene.ts`
- Прокинуть `coins: progress.coins` в renderOverlay
- Прокинуть `showAchievementsButton: sdk.canUseAchievements()`
- Добавить click handler для `data-route-action="open-achievements"` →
  `this.scene.start(SCENES.achievements, { returnTo: "map" })`

### `src/styles.css`
Стили:
- `.route-overlay__coins` — top-left absolute, brass amber
- `.route-overlay__achievements` — top-right button, hover/active state
- `.achievements-overlay` (новый блок)
- `.achievement-card` — обёртка, padding, border
- `.achievement-card__icon` — 64×64
- `.achievement-card__title` — heading
- `.achievement-card__progress-bar` — прогресс-бар
- `.achievement-card--unlocked` — золотая рамка + ✓
- `.achievement-card--locked` — приглушённый, силуэт
- `.achievements-section` — group container
- `.achievements-section__title` — group header

### `src/services/i18n/locales.ts`
Ключ `achievements: "Достижения" / "Achievements" / ...` (уже есть с v0.3.56).
Добавить:
- `achievementProgress: "{current}/{max}"` (опционально)
- `unlocked: "Открыто"` / `"Unlocked"`
- `locked: "Скрыто"` / `"Hidden"`

7 локалей (ru/en/tr/es/pt/de/fr).

## Existing code to reuse

- **`ACHIEVEMENTS`** array из `src/data/achievements.ts` — meta для каждой ачивки
- **`AchievementsReconciler.bootstrap`** уже seedит `lastProgress` из save +
  SDK list. Сцена читает их через cache внутри Reconciler — но проще:
  - читать `state.progress.achievementUnlocked` + `state.progress.achievementProgress`
  - fallback на `sdk.getPlayerAchievements()` для cross-device sync
  - объединять с metadata из ACHIEVEMENTS
- **`COIN_ICON_HTML`** из `src/ui/coinIcon.ts` — для счётчика монет
- **`createCanvasAnchoredOverlay`** — стандарт для DOM-сцен
- **`createAppNavHtml`** — для bottom-nav

## Icon URLs in achievement cards

Внутри игрового overlay подгружаем иконки **из GP CDN** (уже залиты —
URL'ы в `cdn.eponesh.com`). Для этого:
- Либо `sdk.getPlayerAchievements()` → возвращает обновлённое icon-URL
- Либо хардкодим mapping в `src/data/achievementIconUrls.ts` (новый файл)

**Решение:** хардкодим mapping. Так сцена работает оффлайн, и не зависит
от того что SDK вернул для каждой ачивки. URL'ы — те что вернул uploader.

```ts
export const ACHIEVEMENT_ICON_URLS: Record<string, { main: string; locked?: string }> = {
  first_win: { main: "https://cdn.eponesh.com/.../...png" },
  // ... 20 entries
  epilogue: { main: "...", locked: "..." },
  // 4 hidden have locked URLs
};
```

Альтернативно: использовать local `dist/achievement-icons/<tag>.png` — но
эти файлы попадают в production bundle? Только если на them ссылаются
через `?url` imports. Простой `<img src="/assets/...">` будет искать в
public/. Нужно проверить.

**Cleanest path:** копировать иконки в `public/assets/achievements/` →
ссылаться через `<img src="./assets/achievements/<tag>.png">`. Vite
скопирует public/ в dist/ автоматически.

## Verification

- `npm test` — 165 → ~175 (+10 тестов overlay-вёрстки)
- `npm run build` — typecheck чистый
- Manual QA:
  1. TitleScene: появилась 4-я кнопка «Достижения» (если canUseAchievements)
  2. Клик → AchievementsScene, видны 20 ачивок в 6 группах
  3. Скрытые `epilogue`, `all_artifacts`, `no_undo_win`, `no_hint_win`
     показываются как «???» с locked-силуэтом
  4. Прогресс-бары работают: для chapter_1_complete с 3 узлами → бар на 30%
  5. Уже unlocked'нутые показывают ✓
  6. Back-button возвращает на TitleScene (если открыто оттуда)
  7. MapScene: монеты в левом верхнем углу читаются
  8. Иконка трофея в правом верхнем углу
  9. Клик по трофею → AchievementsScene, back-button → MapScene
  10. Bottom-nav без изменений (archive / daily / settings)

## Out-of-scope (на v0.3.59+)

- Анимации unlock (золотой shimmer на новой ачивке)
- Сортировка ачивок (по прогрессу / алфавиту)
- Фильтры (скрыть unlocked / только эпические)
- Share-кнопка под каждой ачивкой
- Daily-streak ачивки (нужна login-streak логика)
