# Публикация Solitaire: Expedition в Яндекс Игры

Файл-памятка для ручной загрузки в [Yandex Games Console](https://yandex.ru/dev/games/console). Всё, что автоматизировать нельзя, собрано здесь как чеклист.

**Текущая версия:** см. `package.json` → `version` (бампается патчем на каждый build).

---

## 0. Состояние на 2026-04-09

- ✅ TypeScript типчек чистый, 94/94 тестов зелёные
- ✅ SDK инициализация: `/sdk.js` + polling `waitForYaGames(5000)` защищает от гонки
- ✅ SDK-функции: `LoadingAPI.ready()`, `GameplayAPI.start/stop`, авто-locale через `environment.i18n.lang`
- ✅ Локализации ru / en / tr — UI, нарратив (30 записей), артефакты, маршрутные точки, пролог
- ✅ Экономика перебалансирована: win 30 / daily 40 / ad +50 / undo 10 / hint 10 / restart 40, без chapter-bonus
- ✅ WebP портреты + крупные артефакты, dist ≈ 18 МБ
- ✅ `DevPreviewScene` исключена из production (tree-shake по `import.meta.env.DEV`), URL `127.0.0.1:4175` ушёл из бандла
- ✅ `<meta Content-Security-Policy>` убран — дублировал HTTP-CSP Яндекс-обёртки и блокировал sourcemap-загрузки SDK
- ✅ Промо-материалы в `promo/`: иконка, обложки RU/EN, 5 скриншотов 1080×1920 RU + EN, видео RU + EN (живой геймплей)

---

## 0.0. VK/OK tester feedback — v0.3.27 (2026-04-23)

Тестировщики ВКонтакте и Одноклассников потребовали полноценное стартовое меню как блокер модерации.

- ✅ **Стартовое меню.** `BootScene` теперь всегда открывает `SettingsScene` в режиме `returnTo: "startmenu"` — прямой переход в Prologue/Map убран. В этом режиме заголовок «Меню», скрыт bottom-nav и кнопка «← Назад», показываются только две primary-action кнопки.
- ✅ **«Новая игра».** Крупная акцентная кнопка вверху меню. При клике — inline DOM-модалка подтверждения (`src/ui/confirmDialog.ts`, в стиле игры), при OK — полный сброс `SaveState` (progress + `currentGame=null`), сохранён только выбранный язык, переход в `Prologue`.
- ✅ **«Продолжить».** На первом запуске (`prologueShown=false`) задизейблена. После — ведёт в активную партию (`currentGame.status === "in_progress"`) через `resumeCurrentGame: true` либо на `MapScene`, если активной партии нет. В режимах `game`/`map`/`archive` «Продолжить» = «Назад» в origin (переиспользует `handleGoBack`).
- ✅ **Переименование «Настройки» → «Меню».** На всех сценах (`GameScene` action-bar, `MapScene`/`DiaryScene`/`DetailScene`/`RewardScene` bottom-nav, `SettingsScene` game-style nav) label теперь `i18n.t("menu")`.
- ✅ **Единая позиция кнопки «Меню» (thumb-zone).** В GameScene game-bar порядок поменялся на `[undo, hint, home, settings]` — «Меню» теперь в правом нижнем углу, как и на Map/Diary. Одна и та же позиция на всех сценах под большой палец.
- ✅ **Удалена сервисная кнопка `reset-save`.** Её функцию полностью покрывает «Новая игра» с подтверждением.
- ✅ **SFX-ползунок переименован.** Локали обновлены: `sound: "Эффекты" / "Effects" / "Efektler"` — пользователь спутывал с разделом «Звук» (mute), где тоже было «Звук».
- ✅ **Новые i18n ключи.** `newGame`, `confirmResetProgress` для ru/en/tr.

**Критичные файлы:** `src/scenes/BootScene.ts`, `src/scenes/SettingsScene.ts`, `src/scenes/settingsSceneOverlay.ts`, `src/scenes/gameSceneOverlay.ts`, `src/scenes/GameScene.ts`, `src/scenes/MapScene.ts`, `src/scenes/DiaryScene.ts`, `src/scenes/DetailScene.ts`, `src/scenes/RewardScene.ts`, `src/ui/confirmDialog.ts` (новый), `src/services/i18n/locales.ts`, `src/styles.css`.

---

## 0.1. GamePush tester feedback — v0.3.0 (2026-04-16)

Отчёт тестировщика [moderator.sceef.space/p/976mguna](https://moderator.sceef.space/p/976mguna) — устранено:

- ✅ **Сейвы только через GamePush Player.** `SaveService` больше не использует `localStorage`: snapshot держится in-memory, `init(sdk)` подтягивает `gp.player.get('save')`, `save()` fire-and-forget пишет через `gp.player.set('save', …)`. Никакого `mergeSaveStates`, cloud — единственный источник истины.
- ✅ **Явный sync после ключевых действий.** `save.flush()` (async обёртка над `setCloudSave`) вызывается после списания монет за подсказку (`GameScene.handleHintAction`) и после начисления rewarded-ad-бонуса (`RewardScene.onAdClick`).
- ✅ **Подписка на глобальный mute.** `SdkService.onMuteChange` + `isMuted()` → `SoundService.setPlatformMuted()`. Платформенный mute применяется как отдельный коэффициент (`gain 0` на `sfxBus`/`musicBus`), не затирая пользовательские ползунки громкости.
- ✅ **Sticky-banner.** `BootScene` вызывает `ads.showStickyBanner('boot')` после `signalReady()`; API расширен (`showSticky/closeSticky/refreshSticky`).
- ✅ **Preloader ad.** `BootScene` вызывает `await ads.showPreloader()` перед `signalReady()`, обёрнут в try/catch — падение рекламы не блокирует бут.
- ✅ **Защита от повторного hint-клика.** `GameScene.handleHintAction` игнорирует клик, пока жив `hintHighlightTimer`; кнопка визуально задизейблена (`game-overlay__action--disabled` + `disabled` attr) до снятия подсветки.
- ✅ **Rewarded-cooldown через сейв.** `ProgressState.lastRewardedAt` заменил `localStorage` constant — всё хранится в облаке GP-профиля игрока.
- ✅ **RU-обложки.** `promo/gamepush/cover-1920x1080-ru.png` и `cover-1080x1920-ru.png` перегенерированы — название «Пасьянс Экспедиция» вместо «Solitaire Expedition». EN/TR обложки не менялись. Генерация через `node scripts/renderPromo.mjs`.
- ⚠️ **Landscape-промо-видео** — TODO пользователя: записать/смонтировать `promo/video-ru-landscape.mp4` и `promo/video-en-landscape.mp4` (16:9, до 30 сек) и загрузить в GP-панель.

**Верификация:** `npx tsc --noEmit` чисто, `npx vitest run` — 99/99 зелёные.

---

## 1. Сборка и упаковка

**Процесс (обязателен versioned zip):**

```bash
# 1. Бампнуть patch в package.json (0.1.8 → 0.1.9)
# 2. Типчек
npx tsc --noEmit

# 3. Build
npx vite build

# 4. Упаковка через adm-zip (НЕ через PowerShell Compress-Archive!)
node scripts/packBuild.mjs
```

Выход: `solitaire-expedition-v{version}.zip` в корне репозитория.

**Почему НЕ PowerShell:** `Compress-Archive` пишет пути с `\` (backslash), и Yandex S3-экстрактор не распознаёт их как директории — `assets/` не появляется, игра падает с 404 на `index-*.js/css`. `adm-zip` в `packBuild.mjs` нормализует пути на `/`.

**Что внутри zip (проверка):**
- `index.html` — содержит `<script src="/sdk.js"></script>` и относительные пути `./assets/...`
- `assets/index-*.js` — основной бандл (~1.4 МБ)
- `assets/index-*.css` — стили (~35 КБ)
- `assets/*.webp` — портреты + крупные артефакты
- `assets/*.png` — гриды и блюр-версии артефактов
- `audio/music/*.mp3` — 5 фоновых треков (~14 МБ)
- `audio/sfx/*.mp3` — звуковые эффекты (~750 КБ)

**Старые версии zip не удалять** — оставляем историю для отката.

---

## 2. Промо-материалы

Все файлы в `promo/`.

### Обложки

| Файл | Размер | Язык | Назначение |
|---|---|---|---|
| `icon-512.png` | 512×512 | — | Иконка игры |
| `cover-800x470-gold.png` | 800×470 | RU | Обложка каталога (RU) — **правильная версия** |
| `cover-800x470-gold-en.png` | 800×470 | EN | Обложка каталога (EN) |

### Скриншоты (1080×1920, 9:16)

**RU:**
- `9x16_screenshot-1-prologue.png`
- `9x16_screenshot-2-map.png`
- `9x16_screenshot-3-game.png`
- `9x16_screenshot-4-reward.png`
- `9x16_screenshot-5-diary.png`

**EN:**
- `9x16_screenshot-1-prologue-en.png`
- `9x16_screenshot-2-map-en.png`
- `9x16_screenshot-3-game-en.png`
- `9x16_screenshot-4-reward-en.png`
- `9x16_screenshot-5-diary-en.png`

### Видео

| Файл | Размер | Длит. | Содержимое |
|---|---|---|---|
| `promo/video-ru.mp4` | ~1.9 МБ | 26 с | Живой геймплей (solver-driven), русский UI, 1080×1920 H.264 |
| `promo/video-en.mp4` | ~2.0 МБ | 26 с | Живой геймплей, английский UI, 1080×1920 H.264 |

Видео пересобирается через `scripts/captureVideo.mjs` (Playwright + dev-only `window.__solitaireDebug.solveAndStep` прогоняет жадный солвер с визуальной анимацией ходов).

---

## 3. Тексты для формы публикации

**Важно (канонические глобальные имена для EN/TR):** лидер = **Adrian Cole** (не Воронов), имена остальных — см. `project_naming_pack.md`. В EN/TR ни одно русское имя не появляется.

### Ключевые слова (теги)

**RU:**
```
пасьянс, косынка, карты, экспедиция, история, детектив, сюжет, приключение, тайна, карточная игра, расследование, дневник, архив, путешествие, казуальная
```

**EN:**
```
solitaire, klondike, cards, expedition, story, narrative, mystery, relaxing, singleplayer, adventure, detective, diary, archive, journey, casual
```

**TR:**
```
solitaire, klondike, kart, keşif, hikâye, gizem, macera, dedektif, günlük, arşiv, yolculuk, rahatlatıcı, tek oyunculu, kart oyunu, bulmaca
```

### Название

| Локаль | Текст (≤50) |
|---|---|
| **RU** | `Пасьянс Косынка: Экспедиция` |
| **EN** | `Solitaire: Expedition` |
| **TR** | `Solitaire: Keşif` |

### Описание для SEO (≤160)

**RU:**
```
Пасьянс Косынка с сюжетом: раскладывайте карты и раскрывайте тайну пропавшей экспедиции по найденным дневникам участников.
```

**EN:**
```
Klondike Solitaire with a story: lay out the cards and uncover the mystery of a lost expedition through the diaries of its members.
```

**TR:**
```
Hikâyeli Klondike Solitaire: kartları dizin ve kayıp keşif ekibinin günlüklerinden gizemini çözün.
```

### Об игре (≤1000)

**RU** (951):
```
Семнадцать лет назад экспедиция Воронова ушла на северо-восток и не вернулась. Поисковые партии искали два сезона и вернулись ни с чем — дело закрыли «без вести». Месяц назад охотник принёс в архив жестяную коробку с тетрадями и разрозненными листами: дневник начальника, полевые заметки картографа, страницы остальных участников. Листы отсырели и перепутаны, часть просто отсутствует.

Вы — архивариус, которому поручили раскрыть тайну пропавшей экспедиции. Раскладываете листы по датам и стоянкам, идёте по маршруту точка за точкой. Каждая точка — партия в Косынку. За каждую собранную колоду открывается фрагмент истории: страница из дневника, набросок, фотокарточка. Шаг за шагом восстанавливается, что случилось с людьми Воронова на северо-востоке.

30 точек, три главы, пять участников экспедиции со своими записями, девять артефактов. Одиночный темп, облачные сохранения. Без энергии, без таймеров — только карты и медленно проступающая правда.
```

**EN** (966):
```
Seventeen years ago, an expedition led by Adrian Cole went northeast and never returned. Search parties spent two seasons and came back empty-handed — the case was closed as "missing". A month ago, a hunter brought a tin box to the archive with notebooks and loose pages: the leader's diary, the cartographer's field notes, pages from the rest of the team. The sheets are damp and scrambled, parts are simply gone.

You are the archivist assigned to uncover the mystery of the lost expedition. You sort the pages by dates and campsites, moving along the route point by point. Each point is a game of Klondike Solitaire. Every deck you complete reveals a fragment of the story: a diary page, a sketch, a photograph. Step by step, you reconstruct the story of Cole's expedition.

Thirty points, three chapters, five expedition members with their own notes, nine artifacts. Single-player pace, cloud saves. No energy, no timers — just cards and a slowly emerging truth.
```

**TR** (959):
```
On yedi yıl önce Adrian Cole'un keşif ekibi kuzeydoğuya gitti ve geri dönmedi. Arama ekipleri iki sezon boyunca aradı, eli boş döndü — dava "kayıp" olarak kapatıldı. Bir ay önce bir avcı, arşive defterler ve dağınık sayfalarla dolu teneke bir kutu getirdi: liderin günlüğü, kartografın saha notları, ekibin geri kalanının sayfaları. Yapraklar nemli ve karışık, bir kısmı tamamen kayıp.

Siz kayıp keşfin gizemini çözmekle görevli arşivcisiniz. Sayfaları tarihlere ve kamplara göre sıralıyorsunuz, rota boyunca nokta nokta ilerliyorsunuz. Her nokta bir Klondike Solitaire oyunu. Tamamladığınız her deste hikâyenin bir parçasını ortaya çıkarır: bir günlük sayfası, bir eskiz, bir fotoğraf. Adım adım Cole'un keşif ekibinin hikâyesini yeniden kuruyorsunuz.

Otuz nokta, üç bölüm, kendi notlarıyla beş keşif ekibi üyesi, dokuz eser. Tek oyunculu tempo, bulut kayıtları. Enerji yok, zamanlayıcı yok — sadece kartlar ve yavaşça beliren gerçek.
```

### Как играть (≤1000)

**RU:**
```
Пасьянс Косынка (Klondike): собирайте четыре стопки по мастям от туза до короля. На поле семь колонок — карты выкладываются по убыванию в чередующихся цветах (красная на чёрную, чёрная на красную). Из резерва открывайте по одной карте. Пустые колонки заполняются королями.

Перетаскивайте карту или стопку на нужное место. Двойной тап отправляет карту на дом автоматически. Кнопка «Подсказка» покажет доступный ход. Кнопка «Отмена» откатывает последнее действие.

Собрав расклад, вы разблокируете следующую точку маршрута на карте. В «Архиве» можно перечитать все найденные записи, рассмотреть артефакты и восстановить картину экспедиции целиком. Прогресс сохраняется в облаке — можно продолжить с любого устройства.
```

**EN:**
```
Klondike Solitaire: build four foundation piles by suit, from Ace to King. The tableau has seven columns — cards stack in descending order with alternating colors (red on black, black on red). Draw one card at a time from the stock. Empty columns are filled with Kings.

Drag a card or a stack to move it. Double-tap sends a card to the foundation automatically. The "Hint" button shows an available move. The "Undo" button reverts your last action.

Completing a deal unlocks the next point on the expedition map. In the "Archive" you can re-read every page you've found, examine artifacts and piece together the full story. Progress is saved to the cloud — you can continue on any device.
```

**TR:**
```
Klondike Solitaire: dört temel yığını asa'dan krala kadar renge göre oluşturun. Tabloda yedi sütun var — kartlar dönüşümlü renklerle azalan sırada dizilir (siyahın üstüne kırmızı, kırmızının üstüne siyah). Stoktan birer kart çekin. Boş sütunlar krallarla doldurulur.

Bir kartı veya yığını taşımak için sürükleyin. Çift dokunma kartı otomatik olarak temele gönderir. "İpucu" düğmesi mevcut bir hamleyi gösterir. "Geri al" düğmesi son işlemi geri alır.

Bir eli tamamlamak keşif haritasında bir sonraki noktanın kilidini açar. "Arşiv"de bulduğunuz tüm sayfaları yeniden okuyabilir, eserleri inceleyebilir ve keşfin tüm hikâyesini bir araya getirebilirsiniz. İlerleme buluta kaydedilir — herhangi bir cihazdan devam edebilirsiniz.
```

### Обзор игры для GamePush (Об игре / уникальные особенности, лор, механики)

**RU:**
```
Пасьянс с историей. Семнадцать лет назад экспедиция Воронова ушла на северо-восток и не вернулась. Месяц назад охотник принёс в архив жестяную коробку с дневниками — листы перепутаны, многое отсырело. Вы — архивариус, которому поручили раскрыть тайну пропавшей экспедиции.

Механика: классическая Косынка (Klondike). Семь колонок, четыре дома, чередование цветов. Перетаскивайте карты или тапайте для автосбора на базу. Подсказки и отмена хода — за внутриигровую валюту.

Что делает игру особенной:
— Каждая выигранная партия открывает фрагмент истории: страницу дневника, набросок картографа или фотокарточку
— 30 точек маршрута, три главы, пять участников экспедиции со своими записями
— 9 коллекционных артефактов
— Ежедневный маршрут — уникальный расклад на каждый день
— Архив: перечитывайте найденные записи и восстанавливайте картину экспедиции
— Облачные сохранения — продолжайте с любого устройства
— Без энергии, без таймеров, без давления
```

**EN:**
```
Solitaire with a story. Seventeen years ago, an expedition led by Adrian Cole went northeast and never returned. A month ago, a hunter brought a tin box of journals to the archive — pages scrambled, much of it water-damaged. You are the archivist assigned to uncover the mystery.

Mechanics: classic Klondike Solitaire. Seven columns, four foundations, alternating colors. Drag cards or tap to auto-send to foundations. Hints and undo cost in-game currency.

What makes it unique:
— Every win reveals a story fragment: a diary page, a cartographer's sketch, or a photograph
— 30 route points, three chapters, five expedition members with their own records
— 9 collectible artifacts
— Daily Route — a unique deal every day
— Archive: re-read discovered entries and piece together the full expedition story
— Cloud saves — continue on any device
— No energy, no timers, no pressure
```

**TR:**
```
Hikâyeli solitaire. On yedi yıl önce Adrian Cole'un keşif ekibi kuzeydoğuya gitti ve geri dönmedi. Bir ay önce bir avcı, arşive içinde günlüklerin olduğu teneke bir kutu getirdi — sayfalar karışık, çoğu nemden kararmış. Siz gizemi çözmekle görevli arşivcisiniz.

Mekanik: klasik Klondike Solitaire. Yedi sütun, dört temel, dönüşümlü renkler. Kartları sürükleyin veya otomatik yerleştirme için dokunun. İpuçları ve geri alma oyun içi para ile.

Oyunu benzersiz kılan:
— Her kazanılan el hikâyenin bir parçasını açar: bir günlük sayfası, kartografın eskizi veya bir fotoğraf
— 30 rota noktası, üç bölüm, kendi kayıtlarıyla beş keşif ekibi üyesi
— 9 koleksiyon eseri
— Günlük Rota — her gün benzersiz bir el
— Arşiv: keşfedilen kayıtları yeniden okuyun ve keşif hikâyesini bir araya getirin
— Bulut kayıtları — herhangi bir cihazdan devam edin
— Enerji yok, zamanlayıcı yok, baskı yok
```

---

### Возрастной рейтинг, категория, монетизация

- **Возраст:** 0+ (нет насилия, шок-контента, азартных механик)
- **Категория:** Карточные → Пасьянсы
- **Управление:** Мышь / тач
- **Языки:** Русский, English, Türkçe (авто-detect, можно переключить в настройках)
- **Монетизация:** только Rewarded Video (опционально удваивает награду). Нет interstitial, нет покупок, нет leaderboards, нет achievements.

---

## 4. Экономика (для справки при ревью)

| Параметр | Значение |
|---|---|
| Стартовый капитал | 30 |
| Победа (win) | 30 |
| Победа daily | 40 |
| Бонус за rewarded после победы | +50 |
| Бонус за rewarded после daily | +60 |
| Chapter complete bonus | отсутствует |
| Undo | 10 |
| Hint (после первой бесплатной) | 10 |
| Restart после проигрыша | 40 |

Реклама теперь даёт 167% к доходу за партию — сильный стимул смотреть rewarded без принуждения.

---

## 5. Чеклист загрузки в консоль

### Подготовка
- [ ] Открыть [yandex.ru/dev/games/console](https://yandex.ru/dev/games/console)
- [ ] Залогиниться под учёткой разработчика
- [ ] Создать новую игру ИЛИ открыть существующий драфт
- [ ] При проблемах валидатора с застрявшей плашкой — **удалить draft и создать заново** (чистый способ сбросить кеш валидации)

### Загрузка билда
- [ ] Собрать `solitaire-expedition-v{version}.zip` через `node scripts/packBuild.mjs`
- [ ] Загрузить zip
- [ ] Дождаться обработки (проверка CSP, размера, структуры)
- [ ] Проверить на вкладке превью:
  - [ ] Игра запускается без белого экрана
  - [ ] Загрузочный спиннер Яндекса исчезает (= `LoadingAPI.ready()` сработал)
  - [ ] Язык интерфейса соответствует выбранному в Яндексе (`?lang=ru/en/tr`)
  - [ ] Пролог показывается при первом запуске
  - [ ] Звуки и музыка играют
  - [ ] Карты раздаются, ходы работают, победный экран открывается
  - [ ] Архив открывается с мобильного превью консоли
- [ ] Консоль браузера чистая: ни одного `Uncaught`, ни одной CSP-блокировки

### Заполнение карточки RU
- [ ] Название: `Пасьянс Косынка: Экспедиция`
- [ ] Описание SEO: см. п.3
- [ ] Об игре: см. п.3 (951 символ)
- [ ] Как играть: см. п.3
- [ ] Теги: см. п.3 (15 тегов)
- [ ] Возрастной рейтинг: 0+
- [ ] Иконка: `promo/icon-512.png`
- [ ] Обложка: `promo/cover-800x470-gold.png`
- [ ] Скриншоты: `promo/9x16_screenshot-{1..5}.png` (5 штук)
- [ ] Видео: `promo/video-ru.mp4`

### Заполнение карточки EN
- [ ] Название: `Solitaire: Expedition`
- [ ] Описание SEO: см. п.3
- [ ] Об игре: см. п.3 (966 символов)
- [ ] Как играть: см. п.3
- [ ] Теги: см. п.3
- [ ] Иконка: та же
- [ ] Обложка: `promo/cover-800x470-gold-en.png`
- [ ] Скриншоты: `promo/9x16_screenshot-{1..5}-en.png`
- [ ] Видео: `promo/video-en.mp4`

### Платформы и монетизация
- [ ] Platforms: Desktop + Mobile
- [ ] Monetization → Rewarded Video: **on**
- [ ] Interstitial: **off**
- [ ] Sticky banner: по желанию (см. анализ монетизации)
- [ ] Leaderboards: **off**
- [ ] Achievements: **off**

### Отправка на модерацию
- [ ] Сохранить черновик
- [ ] Проверить превью в каждой локали отдельно (`?lang=ru`, `?lang=en`)
- [ ] Убедиться что валидатор в дашборде не показывает красных плашек
- [ ] Отправить на проверку
- [ ] Дождаться решения модератора (обычно 1–3 рабочих дня)

---

## 6. Что делать при отказе

| Причина | Проверка |
|---|---|
| Ссылка на сервисное хранилище | `grep -rEoh 'https?://[a-zA-Z0-9.-]+' dist/` — должны быть только `http://www.w3.org` и `https://phaser.io`. Других хостов быть не должно. |
| Игра не грузится в iframe | Проверить `<script src="/sdk.js">` в `dist/index.html`, относительные пути `./assets/...` |
| Висит loading-спиннер | `LoadingAPI.ready()` не вызвался — проверить `BootScene.signalReady()` и отсутствие эксепшенов до него |
| Языки не переключаются | `YandexSdkService.detectLocale()` должен возвращать `sdk.environment.i18n.lang` или navigator.language. Вызов из `BootScene` |
| Реклама не показывается | `sdk.showRewardedVideo()` в `RewardScene`. Нужна учётка с включённой монетизацией в консоли |
| Облачное сохранение не работает | `getPlayer()` → `setData/getData` в `YandexSdkService`. Анонимный игрок должен пропускаться |
| Русский текст в EN/TR | grep по `src/data/narrative/` и `src/services/i18n/locales.ts` на Воронов, Мирская и т.д. — в EN/TR только global-имена |

После фиксов: бампнуть patch, пересобрать, перепаковать, перезалить.

---

## 7. После публикации

- [ ] Открыть страницу игры в каталоге Яндекс Игр
- [ ] Сыграть с реального аккаунта (не разработческого)
- [ ] Проверить аналитику в консоли Яндекса (`session_start`, `deal_win_reward_applied`, `reward_screen_continue`, `rewarded_offer_complete`)
- [ ] Проверить cloud save: сыграть на одном устройстве → залогиниться на другом → прогресс должен подтянуться
- [ ] Записать видео геймплея и добавить в карточку (если ещё не добавлено)

---

## 8. Контакты и документация

- Консоль: https://yandex.ru/dev/games/console
- SDK-документация: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
- Требования к играм: https://yandex.ru/dev/games/doc/ru/concepts/requirements
- Требование об абсолютных URL (S3): https://yandex.ru/dev/games/doc/ru/concepts/requirements — «Для корректной работы из любой точки мира в программном коде не используются абсолютные URL, ссылающиеся на серверы S3 Яндекса»
- Поддержка разработчиков: через консоль, раздел «Помощь»
