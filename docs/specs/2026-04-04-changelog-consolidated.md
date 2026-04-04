# Solitaire: Expedition — Сводка изменений (v1.0)

## Общая сводка

За период разработки реализован полный редизайн игрового экрана GameScene, переведён с Phaser Canvas на DOM/SVG overlay для обеспечения чёткой графики на всех разрешениях. Исправлены баги анимаций, детектора ходов и визуальных артефактов.

---

## Изменения по файлам

### 1. `src/scenes/GameScene.ts` (~1260 строк изменений)
**Основная задача:** Полный перевод GameScene на DOM/SVG overlay

- **Удалён canvas flyContainer** — все анимации перелёта карт теперь через DOM overlay
- **Stock → Waste анимация**: DOM slide + flip/reveal (80ms Power2), z-index 200 поверх карт
- **Waste → Tableau анимация**: добавлена DOM fly-анимация при перемещении карты из Waste
- **Tableau → Tableau анимация**: stack fly с каскадом и правильным targetY (позиция новой карты, не текущей верхней)
- **Убраны дубликаты карт** при перемещении стопки — карты скрываются из источника ДО начала анимации
- **Flip detection**: определяется ДО мутации gameState, чтобы избежать рассинхрона
- **Loss Overlay ("Нет ходов")**: переписан на DOM (z-index 300), чёткий текст, кнопки "Рестарт" и "Домой"
- **Empty Tableau Targets**: теперь используют `Graphics.fillRoundedRect` (скруглённые углы)
- **Фоновые изображения**: загружаются как SVG, отображаются через Phaser.Image с альфа-каналом
- **Навигационная панель**: отрисовывается через Graphics (требует перевода на DOM)

### 2. `src/scenes/gameSceneOverlay.ts` (~205 строк)
**Основная задача:** Генерация HTML для DOM overlay

- **createGameSceneOverlayHtml**: единая точка генерации overlay HTML
- **createTopRowHtml**: Stock/Waste/Foundation слоты с поддержкой cardBackSvg
- **createCardsHtml**: face-up карты с SVG markup
- **createFaceDownCardsHtml**: face-down карты с card back SVG
- **createDragCardsHtml**: drag-preview карты при анимации перетаскивания
- **fixCardBackSvgAspect**: фиксит aspect ratio SVG рубашек (viewBox 0 0 300 420 → preserveAspectRatio="none")
- **Параметры**: faceDownCards[], cardBackSvg для поддержки рубашек на столе

### 3. `src/scenes/gameSceneOverlay.test.ts` (5 тестов)
- Рендеринг shared nav buttons и rules action
- Рендеринг DOM face-up карт
- Рендеринг face-down tableau карт с рубашками
- Корректные позиции face-down карт без дублирования
- Отсутствие face-down контейнера при пустом списке

### 4. `src/scenes/BootScene.ts`
- **SVG Card Backs**: загружаются с размером `44x70` (было `80x112` — не соответствовало пропорциям)
- **SVG Card Faces**: загружаются через `?raw` для остроты рендеринга

### 5. `src/styles.css` (~1653 строк добавлено/изменено)
**Основные CSS-классы:**

- `.game-overlay__dom-card`: абсолютное позиционирование, 44x70px, pointer-events: none
- `.game-overlay__dom-card-svg`: shape-rendering: geometricPrecision, 44x70px
- `.game-overlay__dom-card--facedown`: opacity 0.88, card-back стили
- `.game-overlay__slot`: 44x70px, border 2px, border-radius 4.5px
- `.game-overlay__slot--stock`: без рамки/фона, рубашка заполняет весь слот (inset: 0)
- `.game-overlay__top-row`: flex layout, gap 8px
- `.game-overlay__loss-screen`: DOM overlay для "Нет ходов", z-index 300
- Анимационные классы: `.game-overlay__stock-anim`, `.game-overlay__stack-anim-card`

### 6. `src/features/board/cardFaceMarkup.ts` (новый файл, ~121 строк)
**Основная задача:** Генерация SVG markup для карт

- **createCardFaceSvgMarkup**: создаёт SVG для face-up карты (ранг, масть, цвета)
- **Слиммеры масти**: центрированные, масштаб 0.55, diamonds 0.65
- **Угловые индексы**: 12px ранг + 12px масть, чёткие и читаемые

### 7. `src/core/klondike/engine.ts` (исправлен hasAnyMoves)
**Основная задача:** Фикс детектора доступных ходов

- **Исправлена логика**: проверяет ВСЕ подпоследовательности открытых карт, а не только полную стопку
- **Foundation проверка**: для нижних открытых карт в tableau
- **Stock recycling**: наличие карт в стоке считается ходом
- **Убраны ложные срабатывания**: проверка "нет ходов" теперь корректна

### 8. `src/core/klondike/engineMoves.test.ts` (новый файл, 6 тестов)
- Move to foundation from tableau
- Move to foundation from waste
- Move between tableau piles
- Move of sub-sequence in tableau (баг-фикс тест)
- Returns false when no moves possible
- Handles recycling stock as a move

---

## Технические детали

### Архитектура
- **Phaser + DOM Hybrid**: Phaser обрабатывает gameplay (boardLayer, hit-areas), DOM overlay обрабатывает text-heavy UI
- **Coordinate helpers**: `getGameCardLeft(x)` и `getGameCardTop(y)` конвертируют Phaser center-origin → DOM top-left
- **Zoom scaling**: DOM overlay использует `getScale()` для корректного позиционирования при масштабировании

### Производительность
- **SVG текстуры**: face-down карты используют Phaser.Image с SVG текстурами (один раз загружаются)
- **Face-up карты**: рендерятся как SVG DOM элементы (чёткие на любом разрешении)
- **Анимации**: CSS transitions вместо Phaser tweens для DOM overlay
- **z-index слои**: 200 для анимаций, 300 для loss overlay

### Анимации
| Анимация | Механизм | Длительность |
|----------|----------|--------------|
| Stock → Waste | DOM slide + flip | 150ms slide + 80ms flip |
| Waste → Tableau | DOM fly | 220ms ease-out |
| Tableau → Tableau (stack) | DOM fly с каскадом | 220ms + stagger 15ms |
| Tableau reveal (flip) | DOM scaleX(0→1) | 80ms Power2 |
| Auto-complete | DOM fly | 220ms ease-out |

---

## Что осталось на Phaser Canvas (требует перевода на DOM)

### Критичные (визуально заметны):
1. **Навигационная панель** (`this.add.graphics` — строка 148): рисуется поверх canvas, текст может быть нечётким
2. **Экран правил** (`this.add.text` — строки 422, 433): длинный текст, Phaser text blur заметен
3. **Экран автозавершения** (`this.add.text` — строки 1388, 1399): текст поверх overlay
4. **Экран победы** (`this.add.text` — строка 1850): заголовок "Победа!"
5. **Auto-complete анимация** (`this.add.graphics` — строка 1822): визуальная линия завершения

### Менее критичные:
6. **Empty Tableau Targets** (`this.add.graphics` — строка 948): уже скруглённые, но рендерятся через Phaser
7. **Hit-зоны** (`this.add.rectangle` — строка 955): невидимые, для ввода (можно оставить)

### Можно оставить на Phaser:
8. **Фоновое изображение** (`this.add.image` — строка 115): полупрозрачный фон, не мешает читаемости
9. **Drag preview карты** (`this.add.image`): временные при drag-and-drop

### Рекомендация по приоритетам:
- **Приоритет 1**: Навбар, экран правил, экран победы (текст нечёткий)
- **Приоритет 2**: Auto-complete overlay
- **Можно оставить**: Фоновое изображение, hit-зоны, drag-preview (не влияют на читаемость)

---

## Известные технические долги

- `GAME_FACE_UP_GAP_Y` и `GAME_FACE_DOWN_GAP_Y` оба 18px — может требовать настройки
- Временные файлы (`.tmp-*.png`) в рабочей директории
- Ветка `codex/reward-reveal-flow` замёржена, но не удалена локально
- Playwright не установлен в проекте (требует `npm install -D playwright`)

---

## Статус

- ✅ Build: успешен
- ✅ Tests: 89 passing (27 files)
- ✅ Branch: main, запушена
- 🔄 Canvas Sharpness: ~80% завершено (осталось 5 элементов для перевода на DOM)
