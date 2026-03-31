# Solitaire: Expedition — Stage 3 Spec

## Тема

`Narrative rewards metadata + reward flow sync`

## Статус

`Временный рабочий файл`

- Это узкий spec только для третьего runtime-шага.
- После внедрения его можно удалить.
- Основание:
- [TEMP_DATA_SCHEMA.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_DATA_SCHEMA.md)
- [TEMP_RUNTIME_REFACTOR_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_RUNTIME_REFACTOR_PLAN.md)
- [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md)

## Цель этапа

- Вынести narrative reward metadata в отдельный слой.
- Перестать опираться только на `artifactId` внутри node.
- Сделать reward flow aware о `rewardId`, но без narrative texts и без большого UI rebuild.

## Что входит

- новый `src/data/narrative/rewards.ts`
- минимальная адаптация `SaveService`
- минимальная адаптация `RewardScene`

## Что не входит

- reward texts `ru/global`
- полный narrative reward screen
- diary rebuild
- save migration

## Проблема сейчас

- награда после победы знает:
- монеты
- иногда `artifactAwarded`
- иногда `chapterCompleted`
- она не знает:
- какой `rewardId` привязан к точке
- какой тип награды это вообще
- должна ли награда стать коллекционным artifact

## Целевой подход

### 1. Отдельный reward metadata layer

Создать [src/data/narrative/rewards.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.ts), где reward определяется по `rewardId`.

Минимальные поля:

```ts
type NarrativeReward = {
  rewardId: string;
  rewardType: string;
  namingRef?: string;
  collectibleArtifactId?: string;
};
```

### 2. Node completion возвращает `rewardId`

`SaveService.completeNode()` должен возвращать:

- `rewardId`
- `artifactAwarded`
- `coinsAwarded`
- `chapterCompleted`

### 3. RewardScene начинает читать reward metadata

- экран награды пока не показывает полный story body
- но уже знает:
- `rewardId`
- `rewardType`
- есть ли collectible artifact

## Файлы

### Create

- [src/data/narrative/rewards.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.ts)
- [src/data/narrative/rewards.test.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewards.test.ts)

### Modify

- [src/services/save/SaveService.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\save\SaveService.ts)
- [src/scenes/RewardScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts)
- [src/data/artifacts.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\artifacts.ts) only if mapping needs adjustment

## Минимальная reward модель

- `reward_diary_page_01` -> not collectible
- `reward_map_piece_*` -> not collectible
- `reward_photo_*` -> not collectible
- `reward_artifact_case_*` -> not collectible
- только часть reward ids должна иметь `collectibleArtifactId`

### Решение для первого прохода

- не пытаться сейчас покрыть все `30` rewards коллекцией
- оставить collectible artifacts только там, где это уже совместимо с текущей коллекцией
- остальные narrative rewards пока живут без collectible artifact

## Ограничения

- не ломать текущие сейвы
- не добавлять обязательную миграцию
- не переписывать полностью `RewardScene`

## Критерии готовности

- существует reward metadata layer
- `completeNode()` возвращает `rewardId`
- `RewardScene` умеет читать reward metadata
- код больше не зависит только от `artifactId` на узле
- тесты и build остаются зелёными

## Следующий шаг

- после этого можно вводить `entries.ru/global` и `rewardTexts.ru/global`
