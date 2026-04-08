# Публикация Solitaire: Expedition в Яндекс Игры

Файл-памятка для ручной загрузки билда в [Yandex Games Console](https://yandex.ru/dev/games/console). Всё, что автоматизировать нельзя, собрано здесь как чеклист.

---

## 0. Что уже готово (на момент сборки)

- ✅ TypeScript типчек чистый
- ✅ 94/94 тестов зелёные
- ✅ Code review (M1–M6, H1–H3) применён
- ✅ Security review (M1–M4) применён, CSP в `index.html`
- ✅ SDK интеграция: `LoadingAPI.ready()`, `GameplayAPI.start/stop`, авто-locale через `environment.i18n.lang`
- ✅ Локализации ru / en / tr — UI, нарратив (30 записей), артефакты, точки маршрута, пролог
- ✅ Звуки: 5 BGM + SFX
- ✅ Пролог сцена (показывается раз)
- ✅ WebP конвертация портретов и крупных артефактов
- ✅ Промо-материалы в `public/promo/`: иконка 512×512, обложка 800×470, скриншоты
- ✅ Билд `dist/` собран, упакован в `solitaire-expedition.zip` (18 МБ)

---

## 1. Артефакт для загрузки

**Файл:** `solitaire-expedition.zip` (в корне репозитория)
**Размер:** ~18 МБ (лимит Яндекса 100 МБ)
**Содержимое:** `index.html`, `assets/`, `audio/` — всё, что лежит в `dist/`

### Если нужно пересобрать:

```bash
npx tsc --noEmit                    # типчек обязателен перед билдом
npx vite build                       # собирает dist/
powershell -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'solitaire-expedition.zip' -Force"
```

### Что должно быть внутри zip (проверка):
- `index.html` — содержит `<script src="/sdk.js"></script>` и относительные пути `./assets/...`
- `assets/index-*.js` — основной бандл (~1.4 МБ)
- `assets/index-*.css` — стили (~35 КБ)
- `assets/*.webp` — портреты + крупные артефакты
- `assets/*.png` — гриды и блюр-версии артефактов
- `audio/music/*.mp3` — 5 фоновых треков (~14 МБ)
- `audio/sfx/*.mp3` — звуковые эффекты (~750 КБ)

---

## 2. Промо-материалы

Все лежат в `public/promo/`:

| Файл | Размер | Назначение |
|---|---|---|
| `icon-512.png` | 512×512 | Иконка игры |
| `cover-800x470.png` | 800×470 | Обложка для каталога |
| `screenshot-*.png` | 1280px+ | Скриншоты (минимум 3) |

**Видео:** не сделано — поле необязательное, можно добавить позже после публикации.

---

## 3. Тексты для формы публикации

### Название
**Solitaire: Expedition**

### Краткое описание (для каталога)

**RU (~200 символов):**
> Раскройте тайну пропавшей экспедиции, раскладывая пасьянс. Каждая партия открывает фрагмент дневника — записи, артефакты, наброски. Соберите карты — соберите историю.

**EN (~200 символов):**
> Uncover the mystery of a lost expedition by playing solitaire. Each game reveals a fragment of the diary — entries, artifacts, sketches. Lay out the cards, piece together the story.

**TR (~200 символов):**
> Solitaire oynayarak kayıp keşif gezisinin gizemini çözün. Her oyun günlüğün bir parçasını ortaya çıkarır — notlar, eserler, eskizler. Kartları açın, hikâyeyi bir araya getirin.

### Полное описание
*(если форма требует развёрнутый текст — расширить на 4–6 абзацев из материалов в `public/promo/` или из истории в `src/data/narrative/prologue.ts`)*

### Теги
`solitaire`, `klondike`, `cards`, `expedition`, `story`, `mystery`, `casual`

### Возрастной рейтинг
**0+** — нет насилия, шок-контента, азартных механик. Реклама только rewarded video по желанию игрока.

### Категория
Карточные / Casual

### Языки игры
Русский, English, Türkçe (определяется автоматически по `environment.i18n.lang` Яндекса; пользователь может переключить вручную в настройках)

### Монетизация
- Только rewarded video (через Yandex Ads SDK)
- Никаких покупок, никаких interstitial
- Нет leaderboards, нет achievements

---

## 4. Чеклист загрузки в консоль

### Подготовка
- [ ] Открыть [yandex.ru/dev/games/console](https://yandex.ru/dev/games/console)
- [ ] Залогиниться под учёткой разработчика
- [ ] Создать новую игру (или открыть существующий драфт)

### Загрузка билда
- [ ] Загрузить `solitaire-expedition.zip`
- [ ] Дождаться обработки (проверка CSP, размера, структуры)
- [ ] Открыть превью в консоли — убедиться, что:
  - [ ] Игра запускается без белого экрана
  - [ ] Загрузочный спиннер Яндекса исчезает (= `LoadingAPI.ready()` сработал)
  - [ ] Язык интерфейса соответствует выбранному в Яндексе (ru/en/tr)
  - [ ] Пролог показывается при первом запуске
  - [ ] Звуки и музыка играют
  - [ ] Карты раздаются, ходы работают, победный экран открывается
  - [ ] Архив открывается с мобильного превью консоли

### Заполнение карточки игры
- [ ] Название: `Solitaire: Expedition`
- [ ] Описание RU / EN / TR (см. п.3)
- [ ] Категория: Карточные
- [ ] Теги: solitaire, klondike, cards, expedition, story, mystery, casual
- [ ] Возрастной рейтинг: 0+
- [ ] Иконка: `public/promo/icon-512.png`
- [ ] Обложка: `public/promo/cover-800x470.png`
- [ ] Скриншоты: все из `public/promo/screenshot-*.png`
- [ ] Видео: пропустить (необязательно)
- [ ] Языки: RU, EN, TR
- [ ] Платформы: Desktop + Mobile (адаптивный canvas, breakpoints в `gameConfig.ts`)
- [ ] Монетизация: Rewarded video → on
- [ ] Leaderboards: off
- [ ] Achievements: off

### Отправка на модерацию
- [ ] Сохранить черновик
- [ ] Проверить превью ещё раз
- [ ] Отправить на проверку
- [ ] Дождаться решения модератора (обычно 1–3 рабочих дня)

---

## 5. Что делать, если модерация отклонит

Типовые причины отказа Яндекса:
1. **Игра не загружается в их iframe** → проверить, что `<script src="/sdk.js">` есть в `index.html`, а пути `./assets/...` относительные
2. **Висит loading-спиннер** → значит `LoadingAPI.ready()` не вызвался; проверить, что `BootScene` доходит до `sdk.signalReady()` без эксепшенов
3. **Реклама не показывается** → проверить вызов `sdk.showRewardedVideo()` в `RewardScene` (кнопка ad)
4. **Не работает облачное сохранение** → `YandexSdkService.setCloudSave/getCloudSave` ожидают что `getPlayer()` вернёт игрока с `signed-in` правами; проверить, что Яндекс пускает анонимного игрока
5. **Содержит русский текст в EN/TR** → проверить grep по нарративным и data-файлам (правило из `project_naming_pack.md`)

После фиксов — пересобрать `dist/`, перепаковать zip, перезалить.

---

## 6. После публикации

- [ ] Открыть страницу игры в каталоге Яндекс Игр
- [ ] Сыграть с реального аккаунта (не разработческого)
- [ ] Проверить аналитику в консоли Яндекса (`session_start`, `deal_win_reward_applied`, `reward_screen_continue`)
- [ ] Проверить cloud save: сыграть на одном устройстве → залогиниться на другом → прогресс должен подтянуться
- [ ] Записать видео геймплея и добавить в карточку (опционально)

---

## 7. Контакты Яндекса

- Документация SDK: https://yandex.ru/dev/games/doc/dg/sdk/sdk-about.html
- Поддержка разработчиков: через консоль, раздел «Помощь»
- Требования к играм: https://yandex.ru/dev/games/doc/dg/concepts/requirements.html
