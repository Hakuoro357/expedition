# Solitaire: Expedition — Stage 5 Spec

## Тема

`RewardScene -> narrative reward display`

## Статус

`Временный рабочий файл`

- Это узкий spec только для пятого runtime-шага.
- После внедрения его можно удалить.

## Цель этапа

- Подключить `rewardTexts.ru/global` к reward flow.
- Убрать технический вывод `rewardType` в `RewardScene`.
- Начать показывать нормальный display title по `rewardId`.

## Что входит

- helper для reward display text
- wiring в `RewardScene`

## Что не входит

- полный redesign reward screen
- diary rebuild
- narrative body в reward screen

## Критерии готовности

- `RewardScene` показывает человеческий title по `rewardId`
- переключение идёт через `i18n.getNarrativeLocale()`
- tests/build остаются зелёными
