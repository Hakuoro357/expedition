# Achievements UI page + entry points (v0.3.58) — draft-r2

## Round 1 итог (codex + xiaomi)

Codex: 2 CRITICAL + 11 MAJOR + 5 MINOR + alternatives. Xiaomi: 8 MAJOR + 6 MINOR.
14 concerns приняты — все ниже в плане.

## Context

В v0.3.56-57 ачивки реализованы на backend (Reconciler + 20 ачивок в GP) но
у игрока **нет UI** где можно посмотреть свой прогресс. Кнопка в Settings была
заглушкой и убрана. Нужно полноценный экран со списком + входные точки.

**Цель:** игрок видит свой прогресс по 20 ачивкам, разбитым на 6 групп,
с прогресс-барами для milestone-ачивок и locked-силуэтами для скрытых.
Reward-loop усиливается — игрок может заглянуть и увидеть «осталось 3 узла
до главы 2».

## Solution overview

1. **AchievementsScene** — новая сцена, запускается через **`scene.launch + pause`** (R1-M1)
2. **buildAchievementsViewModel** — pure VM-функция (R1-M9), читает `ACHIEVEMENTS.compute({ progress })` как primary (R1-C1)
3. **achievementUiMeta.ts** — UI metadata (group/order/i18n keys) отдельно от compute-meta (R1-C2)
4. **TitleScene** — 4-я кнопка «Достижения», gated by `prologueShown` (R1-M5)
5. **MapScene top-bar** — монеты-слева, trophy-справа (под mute), passes `currentPage` (R1-M7)
6. **Local icons** — `public/assets/achievements/<tag>.png` единственный источник (R1-M3)
7. **Scroll container** — bounded list в overlay (R1-M8)
8. **Полный i18n** — все 21 строк сразу для 7 локалей (R1-M10)
9. **A11y + analytics** — role/aria + `achievements_open` event (R1-MIN1-3)

## Key design decisions

### R1-C1: Compute-based primary, SDK as confirmation
VM строится из `ACHIEVEMENTS.compute({ progress })` — это синхронный, offline-capable
расчёт текущего прогресса игрока. SDK list используется только для confirmation
(если `unlocked=true` на SDK, помечаем visual ✓ — даже если compute ещё не достиг
max из-за write-lag).

```ts
function buildAchievementsViewModel({
  progress,
  sdkUnlockedTags,    // Set<string> from sdk.getPlayerAchievements()
  persistedUnlocked,  // progress.achievementUnlocked
  locale,
  i18n,
}): AchievementsViewModel {
  return { groups: ... };
}
```

### R1-C2: Separate UI metadata
`ACHIEVEMENTS` остаётся compute-only. Новый файл `src/data/achievementUiMeta.ts`
для display:

```ts
export type AchievementUiMeta = {
  tag: string;
  groupTag: "path" | "archive" | "voices" | "mastery" | "equipment" | "community";
  order: number;                  // sort within group
  titleKey: string;               // i18n key, e.g. "ach_first_win_title"
  descriptionKey: string;
  iconKey: string;                // file name without extension, e.g. "first_win"
};

export const ACHIEVEMENT_UI_META: AchievementUiMeta[] = [
  { tag: "first_win", groupTag: "path", order: 1, titleKey: "ach_first_win_title", ... },
  // ... 20 entries
];

export const ACHIEVEMENT_GROUPS: Array<{ tag: GroupTag; titleKey: string }> = [
  { tag: "path", titleKey: "ach_group_path" },
  // ... 6 entries
];
```

### R1-M1: Parallel scene (launch+pause)
```ts
// От MapScene:
this.scene.launch(SCENES.achievements, { returnTo: "map", mapData: { page: this.currentPage } });
this.scene.pause(SCENES.map);

// AchievementsScene close-handler:
this.scene.resume(this.returnTo === "map" ? SCENES.map : SCENES.title);
this.scene.stop();
```

Для TitleScene (без сохранённого состояния) — `scene.start` тоже OK, но единообразно
используем `launch+pause` везде.

### R1-M2: Hidden masking — полное
Для `hidden && !unlocked`:
- icon: locked-силуэт (`<tag>_locked.png`) если есть, иначе CSS `filter: grayscale(1) opacity(0.4)` (R1-MIN-Xiaomi)
- title: «???»
- description: пустая строка (НЕ показывать оригинальное описание)
- progress label: скрыт
- progress bar: скрыт
- a11y label: «Скрытое достижение»

### R1-M3: Asset strategy — local only
Иконки копируются из `dist/achievement-icons/<tag>.png` в `public/assets/achievements/<tag>.png`
скриптом `scripts/syncAchievementIcons.mjs` (один раз перед сборкой, плюс в `npm run build`).
В коде ссылка через `./assets/achievements/<tag>.png` — Vite автоматически копирует public/.

Никаких CDN-URL в коде клиента (GP CDN остаётся только для GP-dashboard).
Никаких `?url` импортов (тяжёлые PNG не нужны в JS bundle).

### R1-M4: NOT extending AppNavItem.id
Trophy — это **отдельная кнопка в overlay** (как mute/community), не часть bottom-nav.
`appNavHtml.ts` не трогаем. В `routeSceneOverlay.ts` добавляем `achievementsButtonHtml`
аналогично `muteBtnHtml` / `communityBtnHtml`.

### R1-M5: First-run gating
TitleScene button показывается только если `state.progress.prologueShown === true`.
На первом запуске не видна (как `continueEnabled=false`). После прохождения пролога
появляется при следующем визите Title.

### R1-M6: TitleScene button order
Без community (Yandex или GP без community URL):
- Начать (primary if не пройден)
- Продолжить (primary if пройден)
- Достижения (if prologueShown)
- Настройки

С community:
- Начать
- Продолжить
- Достижения
- Настройки
- Сообщество

При первом запуске «Достижения» отсутствует — back to 3 (или 4 с community).

### R1-M7: Preserve MapScene page
```ts
// От MapScene → AchievementsScene:
{ returnTo: "map", mapData: { page: this.currentPage } }

// AchievementsScene на close:
if (this.returnTo === "map") {
  this.scene.resume(SCENES.map, { page: this.mapData?.page });
  this.scene.stop();
}
```

### R1-M8: Scroll container
В overlay HTML:
```html
<div class="achievements-overlay">
  <header>...</header>
  <div class="achievements-overlay__scroll">  <!-- overflow-y: auto, fixed max-height -->
    <section class="achievements-section">...</section>
    ...
  </div>
  <button class="achievements-overlay__back">...</button>
</div>
```

CSS:
```css
.achievements-overlay__scroll {
  overflow-y: auto;
  max-height: calc(100% - 60px /* header */ - 60px /* back btn */);
  pointer-events: auto;  /* host overlay имеет pointer-events: none */
}
```

### R1-M9: Tests — VM + overlay + integration
- `buildAchievementsViewModel.test.ts` — pure VM логика (10+ cases: каждая группа, hidden masking, progress %, compute fallback when SDK unlocked but compute < max)
- `achievementsSceneOverlay.test.ts` — HTML rendering (sections, cards, scroll, back button, ARIA)
- `AchievementsScene.integration.test.ts` — scene routing: launch from Title, launch from Map preserves page, close resumes correct scene

### R1-M10: Inline i18n strings
3 новых i18n keys + group titles + 20 achievement titles + 20 descriptions = 43 ключа на UI-локаль.
**Решение:** хардкодим RU и EN сразу (полные). Для остальных 5 локалей (tr/es/pt/de/fr) —
fallback на EN через существующий механизм `locales.ts`. Это даст рабочий UI на день-один
для всех 7 локалей; качественные переводы — отдельным проходом.

Ключи:
- `achievements`, `achievementsLocked`, `achievementsAriaLabel`, `back`
- `ach_group_path`, `ach_group_archive`, `ach_group_voices`, `ach_group_mastery`, `ach_group_equipment`, `ach_group_community`
- `ach_<tag>_title` × 20
- `ach_<tag>_description` × 20

### R1-MIN1: safeImageUrl
В `src/ui/safeUrl.ts` уже есть `safeUrl`. Добавить `safeImageUrl(input, fallback)` — проверяет что path начинается с `./assets/achievements/` (whitelist).

### R1-MIN2: A11y
- Trophy button: `aria-label={i18n.t("achievementsAriaLabel")}` + `aria-pressed` если нужно
- Progress bar: `role="progressbar" aria-valuenow={progress} aria-valuemax={max}`
- Achievement card: `role="listitem"`, list-container `role="list"`
- Hidden achievements: `aria-label="Скрытое достижение"`
- Image: `alt=""` для декоративных (название уже в заголовке)

### R1-MIN3: Analytics
```ts
analytics.track("achievements_open", { origin: "title" | "map" });
```

## Files to create

### `public/assets/achievements/` (24 PNG)
Скопированы из `dist/achievement-icons/` скриптом `scripts/syncAchievementIcons.mjs`
(новый файл) — он же добавится в `npm run build` через pre-build hook.

### `src/assets/ui/nav-icons/trophy.svg`
Outline trophy 24×24, `stroke="currentColor"`, `stroke-width="2"`, `fill="none"`.
Образец: повторяющий dimensions/style существующих nav-icons (home.svg, archive.svg).

### `src/data/achievementUiMeta.ts`
UI metadata + group definitions (см. R1-C2 выше).

### `src/data/buildAchievementsViewModel.ts`
Pure функция: VM-construction (см. R1-C1 выше).

### `src/data/buildAchievementsViewModel.test.ts`
10+ unit tests:
- Group ordering matches ACHIEVEMENT_GROUPS
- Within group, items sorted by `order`
- `hidden && !unlocked` → title "???", description "", no progress
- `hidden && unlocked` → full info
- `compute() < max` + `sdkUnlockedTags.has(tag)` → marked unlocked
- `compute() >= max` → unlocked even without SDK
- One-shot achievements (no max): unlocked iff compute()===true
- Progress % calculation accurate
- All 6 groups present even if empty
- Empty progress (new player) → all locked

### `src/scenes/AchievementsScene.ts`
По образцу DiaryScene:
- `super(SCENES.achievements)`
- `create(data: { returnTo: "title" | "map"; mapData?: { page: number } })`
- Background gradient (без коллажа пока)
- Build VM → render overlay
- Bind back-button: stop self + resume parent scene (`scene.resume(returnTo)`)
- Bind achievement card click → (пока no-op, в v0.3.59+ можно открыть detail-overlay)

### `src/scenes/achievementsSceneOverlay.ts`
HTML builder, params:
```ts
type Params = {
  title: string;
  backLabel: string;
  groups: AchievementsGroupVm[];
  ariaLabels: { hidden: string; progressbar: string };
};
```

### `src/scenes/achievementsSceneOverlay.test.ts`
- 6 group sections rendered
- Hidden+locked → "???" + locked icon
- Progress bar width matches progress %
- ARIA: role="list", role="listitem", role="progressbar", aria-valuenow
- Back button rendered with proper data-attribute

### `src/scenes/AchievementsScene.integration.test.ts`
- Launch from Title → AchievementsScene активна, Title paused
- Launch from Map with page=2 → close → Map resumes with page=2
- Back button on close stops self + resumes parent

### `scripts/syncAchievementIcons.mjs`
Копирует все PNG из `dist/achievement-icons/` в `public/assets/achievements/`.
Идемпотентный (skip если уже на месте, та же mtime).

## Files to modify

### `src/app/config/gameConfig.ts`
Добавить `achievements: "achievements"` в `SCENES`.

### `src/app/bootstrap/createGame.ts`
Добавить `AchievementsScene` в `scenes` array (после `SettingsScene`).

### `src/scenes/titleSceneOverlay.ts`
Добавить optional `achievementsLabel?: string` параметр + button с
`data-title-action="achievements"`.

### `src/scenes/TitleScene.ts`
- Compute `showAchievementsButton = state.progress.prologueShown` (R1-M5)
- Передать в overlay только если показываем
- Обработчик клика → `scene.launch(SCENES.achievements, { returnTo: "title" }); scene.pause();`

### `src/scenes/routeSceneOverlay.ts`
Добавить в params:
- `coins: number`
- `showAchievementsButton?: boolean`
- `achievementsAriaLabel?: string`

Render:
- Top-LEFT coins block: `<div class="route-overlay__coins">{COIN_ICON_HTML}<span>{coins}</span></div>`
- Top-RIGHT trophy button (ПОД существующими mute/community — чтобы не конфликтовать):
  `<button class="route-overlay__achievements" data-route-action="open-achievements" aria-label="...">{trophyIcon}</button>`

CSS-стек top-right (R1-codex-M coll): `mute` (top), `community` (middle), `trophy` (bottom).

### `src/scenes/MapScene.ts`
- Прокинуть `coins: progress.coins` в renderOverlay
- Прокинуть `showAchievementsButton: sdk.canUseAchievements()`
- Добавить click handler:
  ```ts
  this.scene.launch(SCENES.achievements, { returnTo: "map", mapData: { page: this.currentPage } });
  this.scene.pause();
  analytics.track("achievements_open", { origin: "map" });
  ```

### `src/styles.css`
Стили (см. R1-M8 для scroll-container):
- `.route-overlay__coins`, `.route-overlay__achievements`
- `.achievements-overlay`, `.achievements-overlay__scroll`, `.achievements-overlay__back`
- `.achievements-section`, `.achievements-section__title`
- `.achievement-card`, `.achievement-card--unlocked`, `.achievement-card--locked`
- `.achievement-card__icon`, `.achievement-card__title`, `.achievement-card__description`
- `.achievement-card__progress-bar`, `.achievement-card__progress-fill`

Mobile-first responsive: icon `width: clamp(48px, 15vw, 64px)`.

### `src/services/i18n/locales.ts`
Добавить 43 ключа (см. R1-M10) на ru/en. Остальные 5 локалей fall back на en через
существующий механизм.

### `src/ui/safeUrl.ts`
Добавить `safeImageUrl(input, fallback)` — whitelist `./assets/achievements/`.

### `src/scenes/SettingsScene.ts`
Удалить stale `achievementsLabel`/`open-achievements` scaffold (если ещё есть).

### `package.json`
Bump 0.3.57 → 0.3.58. Добавить prebuild script:
```json
"prebuild": "node scripts/syncAchievementIcons.mjs"
```

## Existing code to reuse

- `ACHIEVEMENTS` from `src/data/achievements.ts` — compute meta (НЕ трогаем)
- `AchievementsReconciler` — НЕ читаем напрямую (architecture R1-M view-model)
- `sdk.getPlayerAchievements()` — для merge confirmation
- `COIN_ICON_HTML` from `src/ui/coinIcon.ts`
- `createCanvasAnchoredOverlay`, `createAppNavHtml`
- `escapeHtml`, `safeUrl`
- `analytics.track` for new event

## Verification

- `npm test` — 165 → ~190 (+25 тестов: VM 10, overlay 7, integration 3, locale 5)
- `npm run build` — typecheck чистый
- Manual QA (GP sandbox):
  1. TitleScene first-run (prologueShown=false): кнопки «Достижения» НЕТ
  2. После пролога: возврат в Title → видна «Достижения»
  3. Клик → AchievementsScene (overlay), Title paused
  4. Видны 6 групп, 20 ачивок. Hidden показаны «???» + locked-силуэт
  5. Progress bar для chapter_1_complete с 3 узлами → 30%
  6. Уже unlocked → ✓ галочка + золотая рамка
  7. Back button → resume Title
  8. MapScene: монеты в левом верхнем, trophy в правом верхнем (под mute)
  9. Клик по trophy → AchievementsScene, MapScene paused
  10. Back → MapScene с тем же `currentPage` (НЕ сбрасывается на page 1)
  11. Yandex build (`canUseAchievements=false`): trophy в MapScene нет, кнопка в Title нет
  12. Analytics: `achievements_open` event с origin=title/map
  13. Сетевой fail SDK: VM строится только из `progress.compute()` — UI работает offline
  14. Screen reader: trophy button читает aria-label, progress bars читают значение

## Out-of-scope (на v0.3.59+)

- Анимации unlock (золотой shimmer)
- Сортировка/фильтры
- Share-кнопка под ачивкой
- Daily-streak ачивки
- Качественные переводы для tr/es/pt/de/fr (сейчас EN fallback)
- Achievement detail overlay при клике на карточку
