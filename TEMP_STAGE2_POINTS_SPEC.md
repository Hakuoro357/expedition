# Solitaire: Expedition — Stage 2 Spec

## Тема

`Point ids + narrative point layer`

## Статус

`Временный рабочий файл`

- Это узкий spec только для второго runtime-шага.
- После внедрения его можно удалить.
- Основание:
- [TEMP_DATA_SCHEMA.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_DATA_SCHEMA.md)
- [TEMP_RUNTIME_REFACTOR_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_RUNTIME_REFACTOR_PLAN.md)
- [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md)

## Цель этапа

- Дать каждой из `30` точек маршрута собственную narrative identity.
- Сохранить legacy `dealId` формата `c1n1`.
- Подготовить базовый bridge `dealId -> point_id -> entry_id/reward_id`.

## Что входит

- новый слой narrative point metadata
- добавление `pointId`, `entryId`, `rewardId` в runtime mapping
- helpers для поиска point по `dealId`

## Что не входит

- тексты записей
- reward texts
- reward screen rebuild
- diary rebuild
- save migration

## Проблема сейчас

- [chapters.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts) знает только:
- `id`
- `seed`
- `difficulty`
- `artifactId`
- runtime не знает:
- какая это narrative point
- какая запись открывается
- какая сюжетная награда привязана к этой точке

## Целевой подход

### 1. Legacy `dealId` остаётся

- `c1n1`, `c1n2`, ... остаются основным gameplay id
- все текущие сейвы и progression продолжают работать на нём

### 2. Поверх него появляется canonical point layer

Для каждой точки должны появиться:

- `pointId`
- `entryId`
- `rewardId`

Минимальная форма:

```ts
type NarrativePoint = {
  pointId: string;
  chapterId: ChapterId;
  dealId: string;
  entryId: string;
  rewardId: string;
};
```

### 3. Sources of truth

- gameplay order и seeds остаются в `chapters.ts`
- narrative bindings живут отдельно в `src/data/narrative/points.ts`

## Файлы

### Create

- [src/data/narrative/types.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\types.ts)
- [src/data/narrative/points.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\points.ts)
- [src/data/narrative/points.test.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\points.test.ts)

### Modify

- [src/data/chapters.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts)

## Изменение по файлам

### `src/data/narrative/types.ts`

Добавить:

- `PointId`
- `EntryId`
- `RewardId`
- `NarrativePoint`

### `src/data/narrative/points.ts`

Добавить:

- таблицу на все `30` точек
- helpers:
- `getPointByDealId`
- `getPointByPointId`
- `getPointByRewardId` можно не добавлять на этом этапе, если не нужен

### `src/data/chapters.ts`

Минимально:

- добавить `pointId`, `entryId`, `rewardId` в `ChapterNode`
- заполнять их через point layer

Либо:

- оставить `chapters.ts` без narrative полей
- и использовать helper при чтении

### Рекомендация

- на этом этапе лучше добавить narrative ids прямо в `ChapterNode`
- это упростит дальнейшие `MapScene`, `RewardScene`, `SaveService`
- при этом source of truth всё равно остаётся в `points.ts`

## Канонический id pattern

- `pointId`: `pt_01` ... `pt_30`
- `entryId`: `entry_01` ... `entry_30`
- `rewardId`: брать уже из канонического naming production pattern:
- `reward_diary_page_01`
- `reward_expedition_stamp_01`
- ...

## Ограничения

- Никаких narrative текстов на этом этапе.
- Никаких новых экранов.
- Никакой миграции сейвов.
- `artifactId` пока может временно сосуществовать до следующего этапа.

## Критерии готовности

- каждая node знает свой `pointId`
- по `dealId` можно получить narrative point
- `chapters.ts` и `points.ts` не расходятся по порядку
- весь test/build остаётся зелёным

## Следующий шаг

- после этого можно безопасно вводить `rewards.ts` и отвязывать reward logic от старого `artifactId`
