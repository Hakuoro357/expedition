# Reward + Diary DOM Polish

## Статус

`Approved for implementation`

## Цель

- Перевести текстовые блоки экранов `Reward` и `Diary` на внешний `DOM overlay`.
- Сохранить `Phaser` для фонов, панелей, иконок, сеток, hit areas и анимаций.
- Повысить читаемость `ru/global` текстов без переделки логики экранов.

## Решение

### Reward

В `DOM`:

- заголовок экрана;
- список наград / narrative title;
- статус ad bonus;
- labels кнопок.

В `Phaser`:

- фон;
- панель;
- декоративная линия;
- фоны кнопок;
- hit areas кнопок.

### Diary

В `DOM`:

- заголовок;
- stats row;
- блок последней записи;
- список последних записей;
- тексты chapter progress;
- label кнопки назад.

В `Phaser`:

- фон;
- панели;
- артефактные ячейки;
- иконки;
- рамки;
- hit areas.

## Reusable Pattern

- Использовать тот же `canvas rect`-anchored overlay, что уже применён на карте.
- Для кнопок использовать DOM только для label-текста.
- Не использовать `Phaser DOMElement` для layout крупных текстовых блоков.

## Вне scope

- не менять save/model;
- не менять narrative data;
- не менять reward logic;
- не переделывать общую композицию экранов сильнее, чем нужно для читабельности.
