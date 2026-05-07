# GamePush social actions integration (future-work stub)

**Status:** parked / not scheduled. Recorded 2026-05-04 как future-work
после фидбека пользователя по доке `docs.gamepush.com/ru/docs/social-actions/`.

**Priority:** low — реализация после стабилизации основного gameplay
loop'а и подтверждения квоты.

## Цель

Связать игру с платформенной community-страницей (VK Group / Odnoklassniki
Community / Telegram-канал — зависит от платформы публикации) и
задействовать `gp.socials.*` для share / invite / join-community.
Цель — органический рост аудитории через социальные сигналы (поделился
победой → друг видит у себя в ленте → клик по карточке → запуск игры
с автоматическим credit'ом инвайтеру).

## API surface (по docs.gamepush.com/ru/docs/social-actions/)

| Method | Что делает |
|---|---|
| `gp.socials.share({ title, description, imageUrl })` | Постит ссылку на игру в платформенный feed (VK wall / OK feed / Telegram chat). Контент карточки берётся либо из Open Graph мета-тегов в index.html, либо из аргумента (если платформа поддерживает override). |
| `gp.socials.invite({ friendId? })` | Отправляет приглашение другу. Без `friendId` — открывает платформенный picker. Платформенно-зависимо: на VK работает через `VK.api`, на OK — через `FAPI.UI.showInvite`. |
| `gp.socials.joinCommunity()` | Открывает диалог вступления в community, заранее настроенную в panel.gamepush.com. Без аргументов; community URL хранится в дашборде. |

Точные сигнатуры и параметры подтвердить непосредственно перед
реализацией — на момент записи stub'а полный TypeScript-typedef из GP
SDK не загружался.

## Prerequisites (что нужно до интеграции)

1. **Создать community** на каждой платформе, где публикуется игра:
   - **VK**: создать сообщество (vk.com/groups → создать) с типом
     «Сообщество разработчиков» или «Игра». Прикрепить аватар +
     краткое описание игры с упоминанием экспедиционного нарратива.
   - **OK**: создать группу на ok.ru с тем же позиционированием.
   - **Telegram** (если применимо): создать публичный канал
     `@solitaire_expedition` или похожий.
2. **Зарегистрировать community URL** в `panel.gamepush.com → Project
   27547 → Settings → Social`. Это активирует `gp.socials.joinCommunity()` —
   без записи в дашборде SDK-метод вернёт ошибку.
3. **Open Graph мета-теги** в `index.html`:
   ```html
   <meta property="og:title" content="Solitaire: Expedition">
   <meta property="og:description" content="...">
   <meta property="og:image" content="https://.../promo/cover-1200x630.png">
   <meta property="og:url" content="https://...">
   <meta property="og:type" content="website">
   ```
   Без них `gp.socials.share()` не будет красиво рендерить карточку
   в VK/OK ленте.
4. **Cover-картинка 1200×630** для og:image (отдельно от существующих
   GamePush promo). Уже есть `promo/cover-800x470-gold.png` —
   downscale в 1200×630 + перегенерация webp/png пары.

## Quota implications (открытый вопрос)

Документация явно НЕ упоминает квоту для `gp.socials.*`. Гипотеза —
эти вызовы НЕ списываются с 100k/day analytics-квоты, потому что
это платформенные действия (VK/OK API проксируются через GP SDK), а
не GP-events. Гипотезу подтвердить запросом в GP support перед
интеграцией.

Если квота тратится — добавить throttling: лимит 1 share / 1 invite
на сессию через cooldown в `localStorage` или поле игрока (для
cross-device persistence).

См. директиву «Игры с GamePush: каждый вызов SDK — платная квота» в
`~/.claude/CLAUDE.md` и `~/.claude/plan-mistakes/gamepush.md` (gp-001…008).

## Recommended integration touchpoints

Минимальный набор для первой итерации (отдельный план/ревью на каждый):

### 1. RewardScene → «Поделиться победой»
После `reveal-items` показа в RewardScene добавить опциональную
кнопку «Поделиться» рядом с continue. Клик → `gp.socials.share` с:
- title: «Глава N — точка X пройдена!» (локализованно)
- description: первая фраза найденной записи
- imageUrl: full-size картинка артефакта (если получен), иначе
  cover-1200x630.

**Cooldown**: одна share-кнопка на партию, не на каждой победе.
**Гейт**: не показывать кнопку на repeat-победах (`returnFromDetail=true`).

### 2. TitleScene или Settings → «Сообщество»
Кнопка «Наше сообщество» вызывает `gp.socials.joinCommunity()`.
Виден ТОЛЬКО если community настроена в дашборде — иначе скрыть
(защита от мёртвой кнопки). Размещение:
- Вариант A: 4-я кнопка на TitleScene (после Settings) — высокая
  заметность, но шумит на минималистичном экране.
- Вариант B: отдельная секция в Settings → новая категория «О игре» с
  links к community и к credits. Менее шумно.

Рекомендуется вариант B как для первого захода — легко скрыть, если
квота окажется проблемой.

## Что не делаем сейчас

- Rewarded-видео-за-share (тактика удержания) — отдельный план.
- Invite boosts (бонус монет за приглашение друга) — нужен server-side
  validation, у нас его нет.
- Leaderboards — выходит за рамки социалов как таковых, отдельная
  механика.
- Achievements UI — `gp.achievements.*` это другая категория, не socials.

## Открытые вопросы для пользователя

1. Какие community уже созданы / нужно ли создавать с нуля?
2. На какой платформе пилотировать интеграцию первой — VK или OK?
3. Тратится ли квота на `gp.socials.*`? (Запрос в GP support.)
4. Хотим ли «Поделиться» на каждой победе (с throttling) или только
   после прохождения главы?
5. Где разместить «Сообщество» — TitleScene 4-я кнопка vs Settings
   отдельная секция?
6. Какой контент share-карточки на каждый из 7 локалей — генерим из
   нарратива или фиксированный «Я играю в Solitaire: Expedition»?

## Acceptance шага сейчас

Документ существует в `docs/specs/`. Никакого SDK-кода не написано.
Stub служит чек-листом для следующей итерации.
