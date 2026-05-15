# Achievements UI page + entry points (v0.3.58) — draft-r6

## Round 1+2+3+4+5 итог (codex + xiaomi)

**R5: Xiaomi → NO SIGNIFICANT CONCERNS ✅** (двойной consensus уже близко).
Codex 1 NEW MAJOR — реальный coin-progress display bug. Принят.

R5 codex fix:
1. **VM учитывает SDK + persisted progress для max-ачивок** — `effectiveProgress = max(compute, sdkProgress, persistedProgress)`. Это закрывает coin-economy кейс: игрок пиково имел 1000, потратил до 300 → UI показывает 1000/2000 (как заслужил), не 300/2000

## Round 1+2+3+4 итог (codex + xiaomi)

**R4: Xiaomi → NO SIGNIFICANT CONCERNS ✅** (8/8 R3 closed). Codex 3 MAJOR + 1 MINOR.

R4 codex fixes:
1. **CSS step-vars без `*`** — `--top-action-step: calc(size + gap)`, второй offset `+ step + step`
2. **One-shot unification** — `isUnlocked = compute || sdk || persisted` для всех ачивок (max и one-shot одинаково). Только progressbar conditional on `meta.max`
3. **Drop `iconKey` из ACHIEVEMENT_UI_META** — всегда derive filename из tag (`<tag>.png` + `locked-generic.png` для hidden+locked). Один источник истины (tag) → parity test покрывает всё
4. **TitleScene button order** — оба упоминания включают SDK gate

## Round 1+2+3 итог (codex + xiaomi)

R1: codex 2 CRIT + 11 MAJOR + 5 MINOR; xiaomi 8 MAJOR + 6 MINOR. 14 concerns, все приняты.
R2: codex 4 prior-MAJOR + 4 new-MAJOR + 2 MINOR; xiaomi 3 new-MAJOR + 3 MINOR. 11 concerns, все приняты.
R3: codex 3 prior-MAJOR + 4 new-MAJOR + 1 MINOR + 1 prior-MIN; xiaomi 1 prior-MAJOR + 1 new-MAJOR + 2 MIN. 8 concerns, все приняты:
1. **TitleScene secondary section** теперь явно `showAchievementsButton = sdk.canUseAchievements() && state.progress.prologueShown` (R3 codex+xiaomi)
2. **Concrete top-bar CSS** с `top: env(safe-area-inset-top) + 12px`, `right: env(safe-area-inset-right) + 12px`, `z-index: 100`, `--top-action-size: 44px`, `--top-action-gap: 8px`
3. **Async-render lifecycle guard** — `isClosed` флаг, проверка перед re-render (R3 codex-M3)
4. **Clamp formula только для max-ачивок** — `progressbar` рендерится только если `typeof meta.max === "number"`. One-shot: только ✓/locked, без bar (R3 codex-M4)
5. **Parity test ACHIEVEMENT_UI_META vs ACHIEVEMENTS** — unit-test что все tags матчатся (R3 codex-M5)
6. **PNG filesystem test** — `npm test` проверяет что все 21 файл существуют в `public/assets/achievements/` (R3 codex-M6)
7. **i18n count 51** (+1 для `ariaLabel_progressbar`) или drop the param — выбран drop: aria-label прогресс-бара = `<title>: <progress>/<max>` ин-line (R3 codex-MIN)
8. **Scroll preservation** — на re-render сохраняем/восстанавливаем `scrollTop` (R3 xiaomi-MIN)
9. **Non-hidden locked treatment** — показываем `<tag>.png` с `opacity: 0.5` + lock-overlay badge (бронзовый замочек bottom-right) (R3 xiaomi-MIN)

## Round 1+2 итог (codex + xiaomi)

R2-fixes:
1. **SDK confirmation = async progressive enhancement** — VM строится из compute() мгновенно, затем `sdk.getPlayerAchievements()` (await `fetchAchievements()`) → re-render с подтверждениями. try/catch вокруг SDK call.
2. **Hidden masking — общий `locked-generic.png`** (НЕ CSS-grayscale реальной иконки — leak темы). Один shared файл для всех hidden+locked.
3. **Asset path — commit `public/assets/achievements/` в git напрямую.** Drop `dist/` source + sync-скрипт.
4. **Availability — единое правило**: trophy/button показывается только если `sdk.canUseAchievements() === true`. Для TitleScene дополнительно требуется `prologueShown`.
5. **Backdrop modal**: `.achievements-overlay__backdrop` full-screen `pointer-events: auto` + `background: rgba(0,0,0,0.5)` — блокирует клики через гаппы в parent.
6. **Unlocked + compute<max → clamp** display progress на max (показываем 10/10 вместо ✓+3/10).
7. **Drop `mapData: { page }`** — `scene.pause/resume` сам сохраняет runtime state Phaser-сцены. Передавать ничего не нужно.
8. **safeImageUrl strict regex**: `^[a-z0-9_-]+(_locked)?\.png$` + хардкод prefix `./assets/achievements/`.
9. **i18n key count exact = 50**: 4 UI + 6 group + 20 titles + 20 descriptions.
10. **Drop `locale` param из buildAchievementsViewModel** — locale resolution в overlay-renderer через `i18n.t(key)`.
11. **Analytics в обоих entry-points** — Title click + Map click обе фаерят `achievements_open` с правильным `origin`.

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
4. **TitleScene** — 4-я кнопка «Достижения», gated by `sdk.canUseAchievements() && prologueShown` (R1-M5 + R4)
5. **MapScene top-bar** — монеты-слева, trophy-справа (под mute). `currentPage` сохраняется автоматически через Phaser pause/resume — без явной передачи (R3 codex-MIN1)
6. **Local icons** — `public/assets/achievements/<tag>.png` единственный источник (R1-M3)
7. **Scroll container** — bounded list в overlay (R1-M8)
8. **Полный i18n** — все 21 строк сразу для 7 локалей (R1-M10)
9. **A11y + analytics** — role/aria + `achievements_open` event (R1-MIN1-3)

## Key design decisions

### R1-C1 + R2: Compute primary, SDK as async progressive enhancement
VM строится из `ACHIEVEMENTS.compute({ progress })` мгновенно при `create()` —
синхронный, offline-capable расчёт. SDK confirmation подключается **асинхронно**:

```ts
async function AchievementsScene.create() {
  this.isClosed = false;
  this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.isClosed = true; });

  // 1. Сразу рендерим из compute() + persistedUnlocked + persistedProgress (save).
  const persistedUnlocked = progress.achievementUnlocked ?? {};
  const persistedProgress = progress.achievementProgress ?? {};
  this.renderFromVm(buildAchievementsViewModel({
    progress,
    sdkUnlockedTags: new Set(),       // unknown yet
    sdkProgressByTag: new Map(),      // unknown yet
    persistedUnlocked,
    persistedProgress,
  }));

  // 2. Async-подгружаем GP confirmation.
  try {
    await sdk.fetchAchievements();
    // R3 fix codex-M3: lifecycle guard — async resolved after scene closed?
    if (this.isClosed) return;
    const sdkList = sdk.getPlayerAchievements();
    const sdkUnlockedTags = new Set(sdkList.filter((a) => a.unlocked).map((a) => a.tag));
    const sdkProgressByTag = new Map(sdkList.map((a) => [a.tag, a.progress])); // R5
    // 3. Re-render с подтверждениями (R3 fix xiaomi-MIN: preserve scrollTop).
    const scrollEl = this.overlay?.getInnerElement().querySelector<HTMLElement>(".achievements-overlay__scroll");
    const prevScrollTop = scrollEl?.scrollTop ?? 0;
    this.renderFromVm(buildAchievementsViewModel({
      progress,
      sdkUnlockedTags,
      sdkProgressByTag,
      persistedUnlocked,
      persistedProgress,
    }));
    const scrollElAfter = this.overlay?.getInnerElement().querySelector<HTMLElement>(".achievements-overlay__scroll");
    if (scrollElAfter) scrollElAfter.scrollTop = prevScrollTop;
  } catch (err) {
    if (this.isClosed) return;
    console.warn("[ach-ui] SDK confirmation failed", err);
  }
}
```

**R2: dropped `locale` param** — locale resolution делает overlay-renderer через `i18n.t(key)`.

```ts
function buildAchievementsViewModel({
  progress,            // ProgressState
  sdkUnlockedTags,     // Set<string>
  sdkProgressByTag,    // Map<string, number> from sdk.getPlayerAchievements()
  persistedUnlocked,   // progress.achievementUnlocked
  persistedProgress,   // progress.achievementProgress (R5 codex)
}): AchievementsViewModel {
  return { groups: ... };
}
```

**R2+R3+R5: monotonic progress display** — для max-ачивок берём максимум из всех
источников (compute, SDK, persisted), чтобы UI отражал «как заслужил», а не текущий
balance:

```ts
const rawCompute = typeof compute === "number" ? compute : 0;
const sdkProgress = sdkProgressByTag.get(meta.tag) ?? 0;
const persistedProg = persistedProgress?.[meta.tag] ?? 0;

const isUnlocked =
  Boolean(compute === true) ||
  sdkUnlockedTags.has(meta.tag) ||
  persistedUnlocked?.[meta.tag] === true ||
  (typeof meta.max === "number" && Math.max(rawCompute, sdkProgress, persistedProg) >= meta.max);

if (typeof meta.max === "number") {
  // R5 codex: max источников = «пик», игнорирует регрессии (потраченные монеты).
  const effectiveProgress = Math.max(rawCompute, sdkProgress, persistedProg);
  const displayProgress = isUnlocked ? meta.max : Math.min(effectiveProgress, meta.max);
  vm.displayProgress = displayProgress;
  vm.displayPct = (displayProgress / meta.max) * 100;
} else {
  // one-shot — без progress-bar
  vm.displayProgress = undefined;
  vm.displayPct = undefined;
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
  // R4 codex-M3: iconKey убран — filename всегда `<tag>.png` (для hidden+locked
  // используем общий `locked-generic.png`). Один источник истины (tag) →
  // parity-test покрывает все случаи.
};

export const ACHIEVEMENT_UI_META: AchievementUiMeta[] = [
  { tag: "first_win", groupTag: "path", order: 1, titleKey: "ach_first_win_title", descriptionKey: "ach_first_win_description" },
  // ... 20 entries
];

export const ACHIEVEMENT_GROUPS: Array<{ tag: GroupTag; titleKey: string }> = [
  { tag: "path", titleKey: "ach_group_path" },
  // ... 6 entries
];
```

### R1-M1: Parallel scene (launch+pause)
```ts
// От MapScene (R2: drop mapData — pause preserves currentPage):
this.scene.launch(SCENES.achievements, { returnTo: "map" });
this.scene.pause();   // MapScene paused, currentPage field preserved

// AchievementsScene close-handler:
this.scene.resume(this.returnTo === "map" ? SCENES.map : SCENES.title);
this.scene.stop();
```

Для TitleScene (без сохранённого состояния) — `scene.start` тоже OK, но единообразно
используем `launch+pause` везде.

### R1-M2 + R2: Hidden masking — full anonymization
Для `hidden && !unlocked`:
- icon: **общий `locked-generic.png`** (один shared файл в `public/assets/achievements/`) —
  НЕ используем CSS-grayscale реальной иконки и НЕ `<tag>_locked.png` (R2-codex: эти
  варианты утечь тему ачивки — все 4 hidden дают визуально-разные силуэты).
- title: «???»
- description: пустая строка
- progress label: скрыт
- progress bar: скрыт
- a11y label: «Скрытое достижение»

`locked-generic.png` — простой brass-замок на тёмно-теаловом фоне, 256×256, общий
для всех hidden+locked ачивок. Создаём один раз, кладём в `public/assets/achievements/`.

Существующие `<tag>_locked.png` (epilogue_locked, no_undo_win_locked, no_hint_win_locked,
all_artifacts_locked) — больше не используются в UI (но остаются в GP dashboard,
где GP показывает их как «not unlocked» иконку отдельно от нашего UI).

**Non-hidden locked treatment** (R3 xiaomi-MIN) — для обычных (visible) ачивок,
ещё не открытых:
- icon: `<tag>.png` с CSS `opacity: 0.5` + lock-badge-overlay (бронзовый замок 14×14
  в правом нижнем углу карточки)
- title + description: показываем нормально (anti-spoiler здесь не нужен — задача
  открыта)
- progress: рендерится для max-ачивок (например "3/10")

### R1-M3 + R2-codex-new-M: Asset strategy — committed `public/`
Иконки коммитятся **напрямую** в `public/assets/achievements/`:
- 20 PNG: `<tag>.png` (256×256, из текущего `dist/achievement-icons/`)
- 1 PNG: `locked-generic.png` (новый, 256×256, общий силуэт-замок для hidden)

Никаких scripts/syncAchievementIcons.mjs (R2-codex: `dist/` cleaned by build — fresh
checkout/CI рушится). Никаких CDN-URL в коде клиента. Никаких `?url` импортов.

В коде ссылка через `./assets/achievements/<tag>.png` — Vite копирует public/ в dist
автоматически. Прибавка к финальному zip: ~24 PNG × ~30 KB = 720 KB (всё в zip ≤ 37 MB лимит).

### R1-M4: NOT extending AppNavItem.id
Trophy — это **отдельная кнопка в overlay** (как mute/community), не часть bottom-nav.
`appNavHtml.ts` не трогаем. В `routeSceneOverlay.ts` добавляем `achievementsButtonHtml`
аналогично `muteBtnHtml` / `communityBtnHtml`.

### R1-M5 + R2: Unified availability rule
**Единое правило** для обоих entry-points:
- **Trophy/button visible iff** `sdk.canUseAchievements() === true`
- **+ для TitleScene дополнительно** `state.progress.prologueShown === true` (anti-spoiler).

```ts
// TitleScene
const showAchievementsButton =
  sdk.canUseAchievements() && state.progress.prologueShown;

// MapScene
const showAchievementsButton = sdk.canUseAchievements();
```

На Yandex (`canUseAchievements=false`) ачивки скрыты везде. На GP first-run (пролог
не пройден) — скрыты в Title, доступны в Map после первой партии (но first-run
игрок попадает в Map только через пролог — так что эффективно тоже после пролога).

### R1-M6 + R4: TitleScene button order
**Все упоминания «Достижения» гейтятся** `sdk.canUseAchievements() && state.progress.prologueShown`.
На Yandex (`canUseAchievements=false`) кнопка отсутствует всегда, независимо от пролога.

Без community (Yandex или GP без community URL):
- Начать (primary if пролог не пройден)
- Продолжить (primary if пройден)
- Достижения (only if `sdk.canUseAchievements() && prologueShown`)
- Настройки

С community (GP с настроенным community URL):
- Начать
- Продолжить
- Достижения (only if `sdk.canUseAchievements() && prologueShown`)
- Настройки
- Сообщество

При первом запуске «Достижения» отсутствует (пролог не пройден) — обратно к 3
кнопкам (или 4 с community). На Yandex также 3/4 кнопки.

### R1-M7 + R2-xiaomi-M: Preserve MapScene page — via pause/resume only
**R2 fix**: `scene.resume(key, data)` НЕ пробрасывает data в running-сцену (Phaser
implementation detail — data передаётся только в `init()` при `scene.start()`).
А `pause/resume` сам сохраняет runtime state — `this.currentPage` остаётся в
паузнутой сцене как обычное поле.

Поэтому `mapData` — избыточен и вводит в заблуждение. Drop его.

```ts
// От MapScene → AchievementsScene:
this.scene.launch(SCENES.achievements, { returnTo: "map" });
this.scene.pause();   // pause MapScene; this.currentPage preserved

// AchievementsScene на close:
this.scene.resume(this.returnTo === "map" ? SCENES.map : SCENES.title);
this.scene.stop();
```

### R1-M8 + R2-codex-new-M: Scroll container + full-screen modal backdrop
В overlay HTML:
```html
<div class="achievements-overlay__backdrop">  <!-- pointer-events: auto, blocks parent clicks -->
  <div class="achievements-overlay">
    <header>...</header>
    <div class="achievements-overlay__scroll">  <!-- overflow-y: auto, bounded -->
      <section class="achievements-section">...</section>
      ...
    </div>
    <button class="achievements-overlay__back">...</button>
  </div>
</div>
```

CSS:
```css
/* R2 fix: full-screen backdrop с pointer-events:auto блокирует клики через */
/* гаппы parent overlay'я (host имеет pointer-events: none по умолчанию). */
.achievements-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: auto;
}

.achievements-overlay {
  position: absolute;
  inset: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  display: flex;
  flex-direction: column;
}

.achievements-overlay__scroll {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;  /* mobile: предотвращает pull-to-refresh */
}
```

### R1-M9: Tests — VM + overlay + integration
- `buildAchievementsViewModel.test.ts` — pure VM логика (10+ cases: каждая группа, hidden masking, progress %, compute fallback when SDK unlocked but compute < max)
- `achievementsSceneOverlay.test.ts` — HTML rendering (sections, cards, scroll, back button, ARIA)
- `AchievementsScene.integration.test.ts` — scene routing: launch from Title, launch from Map preserves page, close resumes correct scene

### R1-M10 + R2-codex-MIN: Inline i18n strings — точно 50 ключей
- 4 UI: `achievements`, `achievementsLocked`, `achievementsAriaLabel`, `back`
- 6 group titles: `ach_group_path`, `..._archive`, `..._voices`, `..._mastery`, `..._equipment`, `..._community`
- 20 ach titles: `ach_<tag>_title` × 20
- 20 ach descriptions: `ach_<tag>_description` × 20

**Итого: 50 ключей × 2 базовых локали (ru+en) = 100 строк inline в `locales.ts`.**

Для остальных 5 локалей (tr/es/pt/de/fr) — fallback на en через существующий
механизм `locales[locale][key] ?? locales.en[key]`. Тест-regression проверяет
что все 50 ключей присутствуют в ru и en.

### R1-MIN1 + R2-codex-MIN: safeImageUrl — strict basename regex
В `src/ui/safeUrl.ts` уже есть `safeUrl`. Добавить:

```ts
const ACHIEVEMENT_ICON_BASENAME = /^[a-z0-9_-]+(_locked)?\.png$/;

export function safeAchievementIconUrl(basename: string, fallback: string): string {
  if (!ACHIEVEMENT_ICON_BASENAME.test(basename)) return fallback;
  return `./assets/achievements/${basename}`;
}
```

Используем `safeAchievementIconUrl("first_win.png", "./assets/achievements/locked-generic.png")` —
strict regex отбрасывает path-traversal, encoded chars, dynamic keys.

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

### `public/assets/achievements/` (21 PNG, committed in git)
20 PNG: `<tag>.png` 256×256 (копируем содержимое существующего `dist/achievement-icons/<tag>.png` —
которые уже сгенерированы) + 1 новый: `locked-generic.png` 256×256 (общий силуэт-замок
для всех hidden ачивок). Коммитим напрямую в git (R2-codex: `dist/` cleaned by build).

### `src/assets/ui/nav-icons/trophy.svg`
Outline trophy 24×24, `stroke="currentColor"`, `stroke-width="2"`, `fill="none"`.
Образец: повторяющий dimensions/style существующих nav-icons (home.svg, archive.svg).

### `src/data/achievementUiMeta.ts`
UI metadata + group definitions (см. R1-C2 выше).

### `src/data/buildAchievementsViewModel.ts`
Pure функция: VM-construction (см. R1-C1 выше).

### `src/data/buildAchievementsViewModel.test.ts`
12+ unit tests:
- Group ordering matches ACHIEVEMENT_GROUPS
- Within group, items sorted by `order`
- `hidden && !unlocked` → title "???", description "", no progress
- `hidden && unlocked` → full info
- `compute() < max` + `sdkUnlockedTags.has(tag)` → marked unlocked, display clamps to max
- `compute() >= max` → unlocked even without SDK
- One-shot achievements (no max): unlocked iff `compute===true || sdkUnlockedTags.has(tag) || persistedUnlocked[tag]` (R4 codex-M2 unified rule across max+one-shot), **NO progressbar in VM** (R3 codex-M4)
- One-shot unlocked → ✓ check, no max/progress fields
- **R4 codex-M2**: persisted one-shot unlocked but `compute===false` (например local progress wiped) → still marked unlocked (cross-device safety)
- **R5 codex**: coin regression — `compute=300, persisted=1000, max=2000` → `effectiveProgress=1000` → display 1000/2000 (а не 300/2000). Если `compute=300, sdkProgress=1500` → display 1500/2000. UI отражает «как заслужил», а не текущий balance
- Progress % calculation accurate for max-ачивок only
- All 6 groups present even if empty
- Empty progress (new player) → all locked
- **R3 codex-M5**: `ACHIEVEMENT_UI_META.map(m => m.tag).sort()` strictly equals `ACHIEVEMENTS.map(a => a.tag).sort()` — все 20 tags матчатся 1:1
- **R3 codex-M5**: `ACHIEVEMENT_UI_META` имеет уникальные tag/order/groupTag валидные

### `src/data/achievementIconsExist.test.ts` (R3 codex-M6)
Node fs-based test (vitest):
- Для каждого `tag` из `ACHIEVEMENTS` проверяет `public/assets/achievements/<tag>.png` exists
- Проверяет `public/assets/achievements/locked-generic.png` exists
- Total 21 PNG check. Test fails если хоть один не на месте.

### `src/scenes/AchievementsScene.ts`
По образцу DiaryScene:
- `super(SCENES.achievements)`
- `create(data: { returnTo: "title" | "map" })` — `mapData` НЕ нужен (R2-xiaomi-M: pause/resume preserves MapScene runtime state via Phaser, scene.resume не пробрасывает data)
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
  hiddenLabel: string;  // i18n: "Скрытое достижение" / "Hidden achievement"
};
```

**R3 codex-MIN: `aria-label` для progressbar inline** — `aria-label="{title}: {progress}/{max}"`
(построено в overlay из VM-данных, не нужен отдельный i18n key). Это держит i18n count
ровно на 50.

### `src/scenes/achievementsSceneOverlay.test.ts`
- 6 group sections rendered
- Hidden+locked → "???" + locked icon
- Progress bar width matches progress %
- ARIA: role="list", role="listitem", role="progressbar", aria-valuenow
- Back button rendered with proper data-attribute

### `src/scenes/AchievementsScene.integration.test.ts`
- Launch from Title → AchievementsScene active, Title paused
- Launch from Map (с любым currentPage) → close → MapScene resumes, currentPage остаётся
  как был (verify via spy на MapScene.currentPage value before launch === after resume)
- Back button on close stops self + resumes parent
- Click outside backdrop НЕ passes through to paused parent (modal correctness)

## Files to modify

### `src/app/config/gameConfig.ts`
Добавить `achievements: "achievements"` в `SCENES`.

### `src/app/bootstrap/createGame.ts`
Добавить `AchievementsScene` в `scenes` array (после `SettingsScene`).

### `src/scenes/titleSceneOverlay.ts`
Добавить optional `achievementsLabel?: string` параметр + button с
`data-title-action="achievements"`.

### `src/scenes/TitleScene.ts`
- Compute `showAchievementsButton = sdk.canUseAchievements() && state.progress.prologueShown` (R3 codex+xiaomi)
- Передать в overlay только если showAchievementsButton === true
- Обработчик клика:
  ```ts
  analytics.track("achievements_open", { origin: "title" });
  this.scene.launch(SCENES.achievements, { returnTo: "title" });
  this.scene.pause();
  ```

### `src/scenes/routeSceneOverlay.ts`
Добавить в params:
- `coins: number`
- `showAchievementsButton?: boolean`
- `achievementsAriaLabel?: string`

Render:
- Top-LEFT coins block: `<div class="route-overlay__coins">{COIN_ICON_HTML}<span>{coins}</span></div>`
- Top-RIGHT trophy button (ПОД существующими mute/community — чтобы не конфликтовать):
  `<button class="route-overlay__achievements" data-route-action="open-achievements" aria-label="...">{trophyIcon}</button>`

CSS-стек top-right (R1-codex-M coll + R3 codex/xiaomi-M2 — конкретные позиции):

```css
:root {
  --top-action-size: 44px;
  --top-action-gap: 8px;
  --top-action-step: calc(var(--top-action-size) + var(--top-action-gap));
  --top-pad: 12px;
}

.route-overlay__coins {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + var(--top-pad));
  left: calc(env(safe-area-inset-left, 0px) + var(--top-pad));
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 100;
  /* читаемость поверх коллажа — тёмная плашка с brass-текстом */
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(16, 32, 31, 0.78);
  color: #d4a962;
}

/* стек правого верхнего: mute (top) → community (middle) → trophy (bottom) */
.route-overlay__mute {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + var(--top-pad));
  right: calc(env(safe-area-inset-right, 0px) + var(--top-pad));
  width: var(--top-action-size); height: var(--top-action-size);
  z-index: 100;
}
.route-overlay__community {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + var(--top-pad) + var(--top-action-step));
  right: calc(env(safe-area-inset-right, 0px) + var(--top-pad));
  width: var(--top-action-size); height: var(--top-action-size);
  z-index: 100;
}
.route-overlay__achievements {
  position: absolute;
  /* R4 codex-M1: no `*` in calc — use precomputed step var, repeated additively */
  top: calc(env(safe-area-inset-top, 0px) + var(--top-pad) + var(--top-action-step) + var(--top-action-step));
  right: calc(env(safe-area-inset-right, 0px) + var(--top-pad));
  width: var(--top-action-size); height: var(--top-action-size);
  z-index: 100;
}
.route-overlay--no-community .route-overlay__achievements {
  top: calc(env(safe-area-inset-top, 0px) + var(--top-pad) + var(--top-action-step));
}
```

Mobile QA: проверить что на 320px viewport + notch coins и trophy не пересекают
route-labels (SVG route-overlay__route-point-title clamped в `EDGE_PADDING=8` —
безопасный зазор от края).

### `src/scenes/MapScene.ts`
- Прокинуть `coins: progress.coins` в renderOverlay
- Прокинуть `showAchievementsButton: sdk.canUseAchievements()`
- Добавить click handler (R2: drop mapData — pause сохраняет currentPage):
  ```ts
  analytics.track("achievements_open", { origin: "map" });
  this.scene.launch(SCENES.achievements, { returnTo: "map" });
  this.scene.pause();
  ```

### `src/styles.css`
Стили (см. R1-M8+R2 для scroll-container + backdrop):
- `.route-overlay__coins`, `.route-overlay__achievements`
- `.achievements-overlay__backdrop` (full-screen modal, `pointer-events: auto`)
- `.achievements-overlay`, `.achievements-overlay__scroll`, `.achievements-overlay__back`
- `.achievements-section`, `.achievements-section__title`
- `.achievement-card`, `.achievement-card--unlocked`, `.achievement-card--locked`
- `.achievement-card__icon`, `.achievement-card__title`, `.achievement-card__description`
- `.achievement-card__progress-bar`, `.achievement-card__progress-fill`

Mobile-first responsive: icon `width: clamp(48px, 15vw, 64px)`. Safe-area-inset на overlay.

### `src/services/i18n/locales.ts`
Добавить 50 ключей (см. R1-M10+R2) на ru/en. Остальные 5 локалей fall back на en через
существующий механизм. Regression-test проверяет что все 50 ключей в ru и en.

### `src/ui/safeUrl.ts`
Добавить `safeAchievementIconUrl(basename, fallback)` — strict regex
`^[a-z0-9_-]+(_locked)?\.png$`, prefix `./assets/achievements/` хардкодим внутри (R2-codex-MIN).

### `src/scenes/SettingsScene.ts`
Удалить stale `achievementsLabel`/`open-achievements` scaffold (если ещё есть).

### `src/scenes/TitleScene.ts` (analytics — R2-codex-MIN)
В click-handler «Достижения» track event:
```ts
analytics.track("achievements_open", { origin: "title" });
this.scene.launch(SCENES.achievements, { returnTo: "title" });
this.scene.pause();
```

### `package.json`
Bump 0.3.57 → 0.3.58. **Никаких prebuild-скриптов** — иконки коммитим напрямую (R2 fix).

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
