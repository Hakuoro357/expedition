# Solitaire: Expedition — Stage 4 Spec

## Тема

`Narrative text packs + ru/global layer`

## Статус

`Временный рабочий файл`

- Это узкий spec только для четвёртого runtime-шага.
- После внедрения его можно удалить.
- Основание:
- [TEMP_DATA_SCHEMA.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_DATA_SCHEMA.md)
- [TEMP_RUNTIME_REFACTOR_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_RUNTIME_REFACTOR_PLAN.md)
- [LOCALIZATION_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\LOCALIZATION_PLAN.md)

## Цель этапа

- Вынести narrative texts в отдельный слой.
- Развести `ui` и `narrative` локализацию.
- Зафиксировать runtime-правило:
- `ru` -> `ru`
- любой non-`ru` -> `global`

## Что входит

- `entries.ru.ts`
- `entries.global.ts`
- `rewardTexts.ru.ts`
- `rewardTexts.global.ts`
- минимальный runtime helper для выбора narrative language layer

## Что не входит

- полноценный diary rebuild
- полноценный reward screen rebuild
- новые экраны
- wave 2 локализация

## Проблема сейчас

- [locales.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\i18n\locales.ts) хранит только UI
- narrative texts в runtime вообще отсутствуют
- reward scene знает `rewardId`, но не знает display title/body

## Целевой подход

### 1. UI и narrative живут отдельно

- `locales.ts` остаётся для UI и системных строк
- narrative texts выносятся в `src/data/narrative/*`

### 2. Narrative layer двуслойный

- `ru` = master для русской версии
- `global` = единый international pack для всех non-`ru`

### 3. I18nService получает минимальный helper

Не нужно запихивать narrative texts в `locales.ts`, но нужен удобный способ понять:

- какой narrative layer активен сейчас

Минимально достаточно:

```ts
getNarrativeLocale(): "ru" | "global"
```

## Файлы

### Create

- [src/data/narrative/entries.ru.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.ru.ts)
- [src/data/narrative/entries.global.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\entries.global.ts)
- [src/data/narrative/rewardTexts.ru.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewardTexts.ru.ts)
- [src\data\narrative\rewardTexts.global.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\rewardTexts.global.ts)
- [src\data\narrative\texts.test.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\narrative\texts.test.ts)

### Modify

- [src\services\i18n\I18nService.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\i18n\I18nService.ts)

## Минимальный содержательный scope

### Entries

- В первом проходе достаточно завести все `30` `entryId`
- Каждая запись должна содержать:
- `speakerEntityId`
- `body`

### Reward texts

- В первом проходе достаточно:
- `title`
- optional `description`

### Global pack

- Не нужно пока делать финальную литературную локализацию
- Но нужен рабочий international master
- Можно использовать:
- аккуратный сокращённый английский/global вариант
- или технически чистый neutral global text

## Критерии готовности

- narrative texts живут отдельно от UI
- существует `ru/global` helper
- по `entryId` можно получить текст
- по `rewardId` можно получить title/description
- `RewardScene` и `DiaryScene` в следующем этапе смогут читать готовые данные без смены архитектуры

## Следующий шаг

- после этого можно безопасно перестраивать `RewardScene` и `DiaryScene` на narrative display layer
