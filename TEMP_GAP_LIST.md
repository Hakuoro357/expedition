# Solitaire: Expedition — Temporary Gap List

## Статус

`Временный рабочий файл`

- Этот файл фиксирует расхождения между текущим runtime и каноном из спек.
- После синхронизации проекта его можно удалить.
- Основные source of truth:
- [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\STORY.md)
- [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\NAMING.md)
- [LOCALIZATION_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\LOCALIZATION_PLAN.md)
- [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md)

## Краткий вывод

- Gameplay-ядро и прогресс работают.
- Главный разрыв сейчас не в механике, а в `content/runtime sync`.
- Код всё ещё живёт в более ранней контентной версии, чем текущие story/naming/localization спеки.

## Gap 1. Названия глав не совпадают с каноном

- `runtime`: [src/data/chapters.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts)
- Сейчас:
- `Северный маршрут` / `Northern Route`
- `Горный перевал` / `Mountain Pass`
- `Речной лагерь` / `River Camp`
- Канон:
- `Начало маршрута` / `Trailhead`
- `Следы и расхождения` / `False Trail`
- `Последняя стоянка` / `Last Camp`
- Критичность: `P0`
- Что сделать:
- перевести runtime chapter titles на naming canon;
- проверить все места, где chapter title показывается в UI.

## Gap 2. Артефакты и награды пока из старой версии лора

- `runtime`: [src/data/artifacts.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\artifacts.ts)
- Сейчас:
- простые collectables типа `компас`, `кирк`, `удочка`, `котелок`
- Канон:
- narrative rewards и находки из [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\STORY.md) и [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md)
- Разрыв:
- текущий `artifacts.ts` не отражает историю `Пропавшей экспедиции`;
- нет связи с `point_id` и `reward_id`;
- нет главного артефакта как narrative center.
- Критичность: `P0`
- Что сделать:
- решить, остаётся ли `artifacts.ts` как отдельная коллекция или заменяется на narrative reward model;
- свести текущие artifact drops к каноническим rewards.

## Gap 3. У точек маршрута нет narrative identity

- `runtime`: [src/data/chapters.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\data\chapters.ts)
- Сейчас:
- у узла есть `id`, `seed`, `difficulty`, иногда `artifactId`
- Нет:
- `point_id`
- `reward_id`
- `chapter_id` в каноническом виде
- связи с записью дневника
- связи с narrative reward
- Канон:
- `30` точек с фиксированными записями и наградами в [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\STORY.md)
- Критичность: `P0`
- Что сделать:
- расширить data model точки маршрута под narrative layer.

## Gap 4. Дневник в runtime не показывает историю

- `runtime`: [src/scenes/DiaryScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DiaryScene.ts)
- Сейчас:
- экран показывает:
- монеты
- прогресс по главам
- сетку артефактов
- Нет:
- записей экспедиции
- progression по `30` точкам
- голосов персонажей
- story beats
- Канон:
- diary должен быть narrative-носителем, а не только экраном коллекции
- Критичность: `P0`
- Что сделать:
- решить новую структуру diary screen:
- либо список открытых записей;
- либо гибрид `story progression + collected rewards`.

## Gap 5. Reward screen пока общий, а не сюжетный

- `runtime`: [src/scenes/RewardScene.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts)
- Сейчас:
- выдаёт монеты;
- иногда показывает artifact drop;
- может показать `chapter complete`
- Нет:
- narrative reward title/body;
- привязки к конкретной записи;
- привязки к `point_id`;
- финальной развязки по канону.
- Критичность: `P0`
- Что сделать:
- связать reward flow с point-based narrative rewards из [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md).

## Gap 6. Локализация пока только UI-уровня

- `runtime`: [src/services/i18n/locales.ts](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\services\i18n\locales.ts)
- Сейчас:
- только базовые UI-строки `ru/en`
- Нет:
- narrative text packs
- chapter naming по новому канону
- rule `ru` vs `global`
- подготовленной архитектуры под `Wave 1 / Wave 2 / Wave 3`
- Критичность: `P0`
- Что сделать:
- выбрать формат хранения:
- `ru master`
- `global master`
- дополнительные locale overlays при необходимости.

## Gap 7. Naming canon не проведён в runtime

- Канон: [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\NAMING.md)
- Сейчас в runtime нет явной модели для:
- `entity_id`
- `ru/global` display values
- expedition naming
- main artifact naming
- global names персонажей
- Критичность: `P0`
- Что сделать:
- завести отдельный naming/data layer, чтобы UI и narrative не опирались на случайные display-строки.

## Gap 8. Story canon существует только в docs

- Канон: [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\STORY.md)
- Сейчас:
- story fully written in docs
- runtime эту историю не проигрывает
- Нет:
- narrative pack в `src/data`
- связки `point -> entry -> reward`
- финального hook на продолжение
- Критичность: `P0`
- Что сделать:
- вынести канон в игровые данные, а не держать его только в markdown.

## Gap 9. Production ids из спек не заведены в коде

- Канон: [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md)
- Сейчас в коде нет:
- `point_id`
- `reward_id`
- `asset_id`
- `file_id`
- Критичность: `P1`
- Что сделать:
- определить, какие ids нужны прямо в runtime, а какие только для art pipeline;
- не тащить в код лишнее, но завести минимум для narrative sync.

## Gap 10. Новые мультиязычные правила ещё не отражены в UX

- Канон: [LOCALIZATION_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\LOCALIZATION_PLAN.md)
- Сейчас не подтверждено:
- как будут переключаться `ru` и `global`;
- как длинные narrative тексты лягут в mobile UI;
- какие экраны останутся text-light;
- какие строки безопасно вшивать, а какие нет.
- Критичность: `P1`
- Что сделать:
- сначала внедрить data architecture, потом проверять layout и string overflow.

## Gap 11. Ассеты в runtime пока частично заглушечные относительно новых спек

- Канон: [ASSET_EXPORT_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\ASSET_EXPORT_SHEET.md)
- Сейчас:
- базовые SVG и черновые UI-ассеты есть;
- narrative rewards и новые key visuals в runtime не используются
- Критичность: `P1`
- Что сделать:
- после narrative integration собрать список `keep / replace` для текущих ассетов.

## Gap 12. Платформенная часть ещё не закрыта end-to-end

- Сейчас частично готовы:
- save
- cloud wrapper
- rewarded wrapper
- Не закрыто:
- smoke test в Яндекс Играх
- cloud save end-to-end
- rewarded ads end-to-end
- string/layout checks на мобиле
- Критичность: `P1`
- Что сделать:
- идти сюда после синхронизации narrative и localization architecture.

## Порядок закрытия gaps

1. `Gap 1`, `Gap 3`, `Gap 6`, `Gap 7`
2. `Gap 2`, `Gap 4`, `Gap 5`, `Gap 8`
3. `Gap 9`, `Gap 10`, `Gap 11`
4. `Gap 12`

## Следующий шаг

- Подготовить целевую data schema для:
- `chapter_id`
- `point_id`
- `reward_id`
- `entity_id`
- `ru/global` text packs
- После этого можно начинать править код без риска снова разъехаться со спеками.
