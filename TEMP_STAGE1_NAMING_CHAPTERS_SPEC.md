# Solitaire: Expedition — Stage 1 Spec

## Тема

`Naming layer + chapter canon sync`

## Статус

`Временный рабочий файл`

- Это узкий spec только для первого runtime-шага.
- После внедрения его можно удалить.
- Основание:
- [TEMP_DATA_SCHEMA.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_DATA_SCHEMA.md)
- [TEMP_RUNTIME_REFACTOR_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_RUNTIME_REFACTOR_PLAN.md)
- [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\NAMING.md)

## Цель этапа

- Вынести канонические имена и названия в отдельный runtime layer.
- Убрать из `chapters.ts` старые display names.
- Перевести runtime на канонические chapter titles без поломки existing progression.

## Что входит

- новый `src/data/naming.ts`
- обновление `src/data/chapters.ts`
- минимальная адаптация мест, где chapter title уже показывается

## Что не входит

- narrative entries
- reward metadata
- diary rebuild
- reward rebuild
- save migration
- новые narrative text packs

## Проблема сейчас

- [src/data/chapters.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts) хранит display titles прямо в данных главы
- эти display titles уже не совпадают с каноном:
- `Северный маршрут` / `Northern Route`
- `Горный перевал` / `Mountain Pass`
- `Речной лагерь` / `River Camp`

Канон должен быть:

- `chapter_01` -> `Начало маршрута` / `Trailhead`
- `chapter_02` -> `Следы и расхождения` / `False Trail`
- `chapter_03` -> `Последняя стоянка` / `Last Camp`

## Целевой подход

### 1. Отдельный naming layer

Создать [src/data/naming.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\naming.ts), где будут лежать canonical display values по `entity_id`.

Минимальный scope для первого этапа:

- `chapter_01`
- `chapter_02`
- `chapter_03`
- `expedition_name`
- `artifact_main`

Персонажей можно добавить сразу, но UI этого этапа на них ещё не зависит.

### 2. Chapters опираются на ids, а не на display strings

`chapters.ts` должен хранить:

- numeric legacy id
- canonical `chapter_id`
- список nodes

`chapters.ts` не должен быть главным источником display-строк.

### 3. Display title получается через helper

UI не должен сам выбирать между `titleRu` и `titleEn` внутри главы.
UI должен работать через naming helper:

- если locale = `ru`, вернуть `ru`
- если locale != `ru`, вернуть `global`

## Целевая модель

### Naming entity

Минимальный тип:

```ts
export type NamingEntityId =
  | "chapter_01"
  | "chapter_02"
  | "chapter_03"
  | "expedition_name"
  | "artifact_main";

export type NamingEntity = {
  id: NamingEntityId;
  ru: string;
  global: string;
};
```

### ChapterDef

`ChapterDef` после первого этапа:

```ts
export type ChapterId = "chapter_01" | "chapter_02" | "chapter_03";

export type ChapterDef = {
  id: number;
  chapterId: ChapterId;
  nodes: ChapterNode[];
};
```

### Helper API

Минимально нужны:

```ts
getNamingValue(entityId, locale)
getChapterTitle(chapterId, locale)
```

## Какие файлы меняются

### Create

- [src/data/naming.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\naming.ts)

### Modify

- [src/data/chapters.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts)
- [src/scenes/MapScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\MapScene.ts)
- [src/scenes/DiaryScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DiaryScene.ts)

## Изменение по файлам

### `src/data/naming.ts`

Добавить:

- canonical naming table
- типы `NamingEntityId`, `ChapterId`
- helper для выбора `ru/global`
- helper для chapter titles

### `src/data/chapters.ts`

Изменить:

- убрать `titleRu`
- убрать `titleEn`
- добавить `chapterId`
- оставить старый `id: number`, чтобы не ломать текущую логику

Не менять:

- seeds
- difficulty tiers
- node ids формата `c1n1`
- `getNodeById`
- `getNextNodeId`
- `getFirstNodeOfChapter`

### `src/scenes/MapScene.ts`

Изменить:

- заголовок главы брать не из `chapter.titleRu/titleEn`
- а через `getChapterTitle(chapter.chapterId, locale)`

### `src/scenes/DiaryScene.ts`

Изменить:

- блок chapter progress должен брать display title через naming helper

## Ограничения

- Никакой save migration на этом этапе.
- Никаких новых narrative ids на этом этапе.
- Никаких изменений reward logic.
- Никаких новых UI-экранов.

## Риски

### Риск 1

- случайно сломать код, который ожидает `titleRu/titleEn`

Снижение риска:

- заменить только реально используемые обращения;
- после правки проверить `MapScene` и `DiaryScene`.

### Риск 2

- смешать `en` и `global`

Снижение риска:

- в naming helper сразу зафиксировать правило:
- `ru` -> `ru`
- любой другой locale -> `global`

## Критерии готовности

- существует отдельный runtime naming layer
- `chapters.ts` больше не хранит chapter display strings
- карта показывает канонические главы
- дневник показывает канонические главы
- existing gameplay и progression не ломаются

## Что будет следующим шагом

- после этого можно безопасно вводить `point_id` и narrative point layer поверх текущих `dealId`
