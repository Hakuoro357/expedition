# Solitaire: Expedition — Temporary Runtime Refactor Plan

## Статус

`Временный рабочий файл`

- Этот файл раскладывает runtime-синхронизацию по конкретным файлам и шагам.
- После внедрения в код его можно удалить.
- Основание:
- [TEMP_GAP_LIST.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_GAP_LIST.md)
- [TEMP_DATA_SCHEMA.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_DATA_SCHEMA.md)

## Главный принцип

- Сначала меняем `data layer`.
- Потом подключаем `naming`.
- Потом подключаем `narrative texts`.
- Только потом переделываем `Diary` и `Reward`.

Так мы не ломаем gameplay-ядро и не делаем UI поверх нестабильных данных.

## Что не трогаем в первом проходе

- solver и правила пасьянса;
- seeds и core klondike engine;
- cloud save transport;
- rewarded ads transport;
- heavy asset pipeline.

## Что важно сохранить

- legacy `dealId` формата `c1n1`;
- текущий save format без жёсткой миграции;
- completed/unlocked progression через существующие массивы;
- текущую играбельность MVP.

## Этап 1. Naming foundation

### Цель

- провести канонические названия и `entity_id` в runtime.

### Файлы

- Create: [src/data/naming.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\naming.ts)
- Modify: [src/data/chapters.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts)
- Modify: [src/scenes/MapScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\MapScene.ts)
- Modify: [src/scenes/DiaryScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DiaryScene.ts)

### Что сделать

- завести `entity_id -> ru/global`;
- убрать из `chapters.ts` старые display titles;
- перевести главы на `chapter_id`;
- подключить канонические chapter titles на карте и в дневнике.

### Результат

- runtime показывает `Trailhead / False Trail / Last Camp`;
- chapter display не зависит от случайных строк в `chapters.ts`.

## Этап 2. Narrative point layer

### Цель

- дать каждой из `30` точек собственную narrative identity.

### Файлы

- Create: [src/data/narrative/types.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\types.ts)
- Create: [src/data/narrative/points.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\points.ts)
- Modify: [src/data/chapters.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts)
- Modify: [src/scenes/MapScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\MapScene.ts)
- Modify: [src/scenes\GameScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\GameScene.ts)

### Что сделать

- связать legacy `dealId` с `point_id`;
- завести `entry_id` и `reward_id` для каждой точки;
- сохранить seeds и difficulty как есть;
- не ломать текущую логику старта партии.

### Результат

- по `dealId` можно достать `point_id`, `entry_id`, `reward_id`.

## Этап 3. Narrative rewards metadata

### Цель

- вынести reward logic из старого `artifactId`-drop подхода.

### Файлы

- Create: [src/data/narrative/rewards.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.ts)
- Modify: [src/data/artifacts.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\artifacts.ts)
- Modify: [src/services/save/SaveService.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\save\SaveService.ts)
- Modify: [src/scenes/RewardScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts)

### Что сделать

- завести metadata narrative rewards;
- решить, какие rewards становятся collectible artifacts;
- отвязать `completeNode()` от прямой зависимости на `artifactId` из node;
- вернуть в reward screen reward по `reward_id`, а не по старому `artifactAwarded` only.

### Результат

- reward flow знает разницу между:
- `diary_page`
- `map_piece`
- `photo`
- `artifact_case`
- `finale_reward`

## Этап 4. Narrative text packs

### Цель

- вынести story texts в отдельный локализуемый слой.

### Файлы

- Create: [src/data/narrative/entries.ru.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.ru.ts)
- Create: [src/data/narrative/entries.global.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.global.ts)
- Create: [src/data/narrative/rewardTexts.ru.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewardTexts.ru.ts)
- Create: [src/data/narrative/rewardTexts.global.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewardTexts.global.ts)
- Modify: [src/services/i18n/I18nService.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\i18n\I18nService.ts)
- Keep mostly unchanged: [src/services/i18n/locales.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\i18n\locales.ts)

### Что сделать

- `locales.ts` оставить для UI;
- narrative texts вынести отдельно;
- завести rule:
- `ru` locale -> `ru`
- любой non-`ru` -> `global`
- добавить удобный runtime helper для выбора слоя.

### Результат

- narrative локализуется отдельно от UI.

## Этап 5. Diary rebuild

### Цель

- превратить дневник из collection-grid в narrative screen.

### Файлы

- Modify: [src/scenes/DiaryScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DiaryScene.ts)
- Read from: [src/data/narrative/points.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\points.ts)
- Read from: [src/data/narrative/entries.ru.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.ru.ts)
- Read from: [src/data/narrative/entries.global.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.global.ts)
- Read from: [src/data/artifacts.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\artifacts.ts)

### Что сделать

- показать открытые записи по пройденным точкам;
- отдельно показать collection artifacts;
- сохранить счётчики прогресса по главам;
- не перегрузить экран сразу всеми `30` длинными текстами.

### Результат

- дневник показывает историю и коллекцию, но не смешивает их.

## Этап 6. Reward rebuild

### Цель

- сделать экран награды story-aware.

### Файлы

- Modify: [src/scenes/RewardScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts)
- Read from: [src/data/narrative/rewards.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.ts)
- Read from: [src/data/narrative/rewardTexts.ru.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewardTexts.ru.ts)
- Read from: [src/data/narrative/rewardTexts.global.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewardTexts.global.ts)

### Что сделать

- показывать reward title/body по `reward_id`;
- отдельно показывать collectible artifact, если он есть;
- сохранить coin reward и chapter completion reward;
- подготовить место под финальную narrative reward логику.

### Результат

- reward screen перестаёт быть generic и начинает совпадать со story canon.

## Этап 7. Save/state adjustments

### Цель

- убедиться, что narrative integration не ломает прогресс.

### Файлы

- Review/Modify if needed: [src/core/game-state/types.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\core\game-state\types.ts)
- Modify if needed: [src/services/save/SaveService.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\save\SaveService.ts)

### Что сделать

- по возможности не вводить новую save migration в первом проходе;
- вычислять narrative unlocks через `completedNodes`;
- добавить новые поля только если без них нельзя.

### Результат

- migration risk минимальный;
- текущие сейвы не становятся мусором.

## Этап 8. UI string audit

### Цель

- определить, что ещё осталось захардкоженным.

### Файлы

- Review: [src/scenes/MapScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\MapScene.ts)
- Review: [src/scenes/RewardScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts)
- Review: [src/scenes/DiaryScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DiaryScene.ts)
- Review: [src/scenes/GameScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\GameScene.ts)
- Review: [src/services/i18n/locales.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\i18n\locales.ts)

### Что сделать

- собрать список оставшихся runtime strings;
- разделить их на:
- UI strings
- naming strings
- narrative strings
- asset labels

### Результат

- локализационный слой становится предсказуемым.

## Рекомендуемый порядок выполнения

1. `src/data/naming.ts`
2. `src/data/chapters.ts`
3. `src/data/narrative/types.ts`
4. `src/data/narrative/points.ts`
5. `src/data/narrative/rewards.ts`
6. `src/data/narrative/entries.ru.ts`
7. `src/data/narrative/entries.global.ts`
8. `src/data/narrative/rewardTexts.ru.ts`
9. `src/data/narrative/rewardTexts.global.ts`
10. `src/services/i18n/I18nService.ts`
11. `src/data/artifacts.ts`
12. `src/services/save/SaveService.ts`
13. `src/scenes/MapScene.ts`
14. `src/scenes/RewardScene.ts`
15. `src/scenes/DiaryScene.ts`
16. audit `src/scenes/GameScene.ts`

## Что можно считать хорошей первой интеграцией

- карта показывает канонические главы;
- награда после победы знает `point_id` и `reward_id`;
- дневник открывает записи экспедиции;
- narrative texts берутся из `ru/global` packs;
- legacy save не ломается;
- artifacts остаются коллекцией.
