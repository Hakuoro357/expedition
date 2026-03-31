# Solitaire: Expedition — Naming Pack

## Статус

`Зафиксировано как канонический naming pack для ru/global локализации`

## Правило использования

- В локали `ru` использовать `ru` значения.
- Во всех `non-ru` локалях использовать `global` значения.
- Отдельные имена под каждый язык не делать.
- Во всех данных, narrative-материалах и таблицах держать стабильные `entity_id`.
- Этот набор прошёл `first-pass screening`, а не native QA по всем языкам.

## Naming table

| entity_id | ru | global | status | notes |
|---|---|---|---|---|
| game_title | Solitaire: Expedition | Solitaire: Expedition | safe | можно держать единым |
| expedition_name | Экспедиция "Перевал" | The Pass Expedition | safe | нейтрально и понятно |
| artifact_main | Навигационный диск | Wayfinder Disc | safe | лучше по тону, чем `Navigation Disc` |
| chapter_01 | Начало маршрута | Trailhead | safe | хороший стартовый тон |
| chapter_02 | Следы и расхождения | False Trail | safe | хорошо поддерживает интригу |
| chapter_03 | Последняя стоянка | Last Camp | safe | звучит спокойно и финально |
| leader | Алексей Воронов | Adrian Cole | watch | `cole` в `es` имеет бытовое значение `school`, но не критично |
| cartographer | Елена Мирская | Tessa Marlowe | safe | на текущем скрининге чисто |
| archaeologist | Георгий Левин | Julian Mercer | safe | на текущем скрининге чисто |
| quartermaster_guide | Михаил Руденко | Simon Calder | safe | лучший из проверенных вариантов |
| photographer_archivist | Софья Климова | Clara Reed | safe | на текущем скрининге чисто |

## Что уже можно считать каноном

- игра: `Solitaire: Expedition`
- экспедиция: `Экспедиция "Перевал"` / `The Pass Expedition`
- главный артефакт: `Навигационный диск` / `Wayfinder Disc`
- главы:
- `Начало маршрута` / `Trailhead`
- `Следы и расхождения` / `False Trail`
- `Последняя стоянка` / `Last Camp`
- команда:
- `Алексей Воронов` / `Adrian Cole`
- `Елена Мирская` / `Tessa Marlowe`
- `Георгий Левин` / `Julian Mercer`
- `Михаил Руденко` / `Simon Calder`
- `Софья Климова` / `Clara Reed`

## Что держать под наблюдением

- `Adrian Cole` имеет `watch`-пометку из-за бытового значения `cole` в испанском.
- Это не блокирующий риск.
- Если позже потребуется довести naming pack до более строгого уровня, первым кандидатом на замену будет именно `leader.global`.

## Практическое правило для ассетов и текстов

- В графике по возможности не вшивать имена и названия.
- Для `promo`, `diary`, `map`, `reward` и `store` использовать отдельный текстовый слой.
- Во внутренних таблицах и production-файлах использовать `entity_id`, а не хардкодить отображаемые строки.
