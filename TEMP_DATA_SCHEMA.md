# Solitaire: Expedition — Temporary Data Schema Draft

## Статус

`Временный рабочий файл`

- Этот файл фиксирует целевую схему данных перед runtime-синхронизацией.
- После внедрения в код его можно удалить.
- Канон остаётся в:
- [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\STORY.md)
- [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\NAMING.md)
- [LOCALIZATION_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\LOCALIZATION_PLAN.md)
- [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md)

## Принятое решение

- Берём `вариант 1`.
- `artifacts` остаются отдельной коллекцией предметов.
- Весь story progression, записи, point rewards и narrative unlocks выносятся в отдельный `narrative pack`.

## Почему это правильный вариант

- Запись дневника, карта, фото, записка и предмет не должны притворяться одним типом сущности.
- UI `Diary` должен уметь показывать и историю, и коллекцию, не смешивая их в один список.
- Локализация narrative-текстов должна жить отдельно от карточек предметов.
- Production ids из [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md) естественно ложатся в narrative слой.

## Архитектурный принцип

- Gameplay node = `deal instance`
- Narrative point = `story progression unit`
- Reward = `unlock payload`
- Artifact = `collectible item`
- Naming = `display dictionary`
- Text pack = `localized strings by layer`

То есть:

- один deal двигает одну narrative point;
- одна narrative point открывает одну запись;
- одна narrative point может дать один narrative reward;
- только часть narrative rewards попадает в коллекцию `artifacts`.

## Целевые сущности

### 1. Chapter

- Отвечает за главу маршрута.
- Держит канонический `chapter_id`.
- Держит gameplay seeds и список точек.

Поля:

- `chapter_id`
- `legacy_numeric_id`
- `title_key`
- `point_ids`

Пример id:

- `chapter_01`
- `chapter_02`
- `chapter_03`

### 2. Route Point

- Это основная единица progression.
- Связывает gameplay node с narrative.

Поля:

- `point_id`
- `chapter_id`
- `legacy_deal_id`
- `node_index`
- `seed`
- `difficulty`
- `entry_id`
- `reward_id`

Пример:

- `pt_01`
- `legacy_deal_id: c1n1`
- `entry_id: entry_01`
- `reward_id: reward_diary_page_01`

### 3. Narrative Entry

- Это запись экспедиции.
- Текстовая сущность.
- Не обязана быть предметом или коллекционкой.

Поля:

- `entry_id`
- `point_id`
- `chapter_id`
- `speaker_entity_id`
- `text_key`
- `unlock_title_key`
- `kind`

Допустимые `kind`:

- `journal`
- `field_note`
- `photo_caption`
- `archive_note`

### 4. Narrative Reward

- Это то, что визуально и продуктово открывается после точки.
- Может быть предметом, картой, фото, запиской, печатью, схемой или финальным bundle.

Поля:

- `reward_id`
- `point_id`
- `chapter_id`
- `reward_type`
- `title_key`
- `description_key`
- `asset_ref`
- `naming_ref`
- `collectible_artifact_id`

Допустимые `reward_type`:

- `diary_page`
- `map_piece`
- `map_variant`
- `map_marker`
- `photo`
- `photo_major`
- `clue_note`
- `lore_note`
- `anonymous_note`
- `paper_fragment`
- `archive_note`
- `archive_seal`
- `artifact_fragment`
- `artifact_case`
- `artifact_case_major`
- `personal_item`
- `logistics_note`
- `chapter_piece`
- `finale_reward`

Правило:

- `collectible_artifact_id` заполняется только если награда должна появиться в коллекции предметов.

### 5. Collectible Artifact

- Остаётся отдельной сущностью.
- Это именно коллекционный предмет, который показывается в коллекции.
- Не каждая narrative reward становится artifact.

Поля:

- `artifact_id`
- `chapter_id`
- `title_key`
- `description_key`
- `icon`
- `reward_source_id`

Правило:

- `artifacts.ts` больше не источник story progression.
- Это только коллекционный слой.

### 6. Naming Entity

- Стабильный словарь имён и названий по `entity_id`.
- Отделён от UI-переводов и от narrative-текстов.

Поля:

- `entity_id`
- `ru`
- `global`

Ключевые `entity_id`:

- `game_title`
- `expedition_name`
- `artifact_main`
- `chapter_01`
- `chapter_02`
- `chapter_03`
- `leader`
- `cartographer`
- `archaeologist`
- `quartermaster_guide`
- `photographer_archivist`

### 7. Text Pack

- Отдельный слой локализуемых строк.
- Не смешивается с naming entities.

Слои:

- `ui`
- `narrative_entries`
- `narrative_rewards`
- `artifact_texts`

## Правило локалей

- Runtime работает не с десятком story packs, а с двумя display layers:
- `ru`
- `global`

Правило:

- если locale = `ru`, брать `ru`
- если locale != `ru`, брать `global`

Это касается:

- имён персонажей;
- названий глав;
- названия экспедиции;
- главного артефакта;
- narrative texts;
- reward texts;
- artifact texts.

## Предлагаемая структура файлов

### Runtime data

- `src/data/chapters.ts`
- остаётся как gameplay entry point, но переводится на `chapter_id` и `point_id`

- `src/data/narrative/points.ts`
- mapping `point_id -> gameplay/narrative binding`

- `src/data/narrative/entries.ru.ts`
- русский master-текст записей

- `src/data/narrative/entries.global.ts`
- international master-текст записей для всех non-`ru`

- `src/data/narrative/rewards.ts`
- reward metadata и типы наград

- `src/data/narrative/artifacts.ts`
- коллекционные предметы, если решим отделить новый слой от legacy `artifacts.ts`

- `src/data/naming.ts`
- `entity_id -> ru/global`

### Localization runtime

- `src/services/i18n/locales.ts`
- только UI и системные строки

- narrative и naming тексты не держать внутри `locales.ts`

## Минимальный runtime contract

### Route Point contract

- по `dealId` можно получить:
- `point_id`
- `chapter_id`
- `entry_id`
- `reward_id`

### Reward contract

- по `reward_id` можно получить:
- `reward_type`
- display title
- display description
- `asset_ref`
- optional `collectible_artifact_id`

### Entry contract

- по `entry_id` можно получить:
- `speaker_entity_id`
- text body
- chapter binding

## Как это ляжет в UI

### Map

- показывает главы и точки по `chapter_id` / `point_id`
- display title берёт через naming layer

### Reward screen

- после победы получает `dealId`
- по нему находит `point_id`
- по `point_id` находит `reward_id`
- по `reward_id` получает display и payload

### Diary

- показывает:
- открытые записи по `entry_id`
- открытые коллекционные предметы по `artifact_id`
- прогресс по главам через `chapter_id`

## Что остаётся от legacy-модели

- `legacy_deal_id` формата `c1n1` пока сохраняем
- existing save state по completed nodes не ломаем
- migration идёт через mapping:
- `completedNodes[]` -> `point_id[]`

## Что не тащить в runtime

- `file_id`
- `suggested_filename`
- полный art pipeline metadata

Это должно жить только в production docs, не в игровом коде.

## Что обязательно тащить в runtime

- `chapter_id`
- `point_id`
- `entry_id`
- `reward_id`
- `entity_id`
- `asset_ref` только если нужен экрану награды или дневника

## Практический порядок внедрения

1. Ввести `chapter_id` и новые chapter titles.
2. Ввести `point_id` поверх существующих `dealId`.
3. Ввести `reward_id` и narrative reward metadata.
4. Вынести naming в отдельный слой.
5. Вынести `ru/global` narrative texts в отдельные packs.
6. Только потом пересобирать `Diary` и `Reward`.

## Что можно считать успешным результатом

- runtime знает канонические главы;
- каждая из `30` точек имеет narrative identity;
- reward flow не зависит от старого `artifactId`;
- `ru/global` правило работает на уровне данных;
- `artifacts` остаются коллекцией, а не суррогатом narrative-системы.
