# Solitaire: Expedition — Temporary Work Checklist

## Статус

`Временный рабочий файл`

- Этот файл нужен как operational checklist на ближайшие доработки.
- После синхронизации проекта его можно удалить.
- Канон и long-term source of truth остаются в:
- [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\STORY.md)
- [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\NAMING.md)
- [LOCALIZATION_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\LOCALIZATION_PLAN.md)
- [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md)
- [ASSET_EXPORT_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\ASSET_EXPORT_SHEET.md)

## Главная цель

- Довести текущий кодовый MVP до состояния, в котором он совпадает с новым story/naming/localization canon и готов к платформенной проверке.

## Фаза 1. Свести спеки и runtime

- [x] Зафиксировать spec для этапа `naming + chapter canon sync`.
- Результат:
- есть отдельный mini-spec: [TEMP_STAGE1_NAMING_CHAPTERS_SPEC.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_STAGE1_NAMING_CHAPTERS_SPEC.md).

- [x] Сделать `gap list` между кодом и каноном.
- Результат:
- отдельный список расхождений `docs ↔ runtime`: [TEMP_GAP_LIST.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_GAP_LIST.md).

- [x] Проверить и зафиксировать расхождения по названиям глав.
- Результат:
- runtime chapter titles совпадают с [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\NAMING.md).

- [ ] Проверить и зафиксировать расхождения по артефактам и наградам.
- Результат:
- текущие `artifacts.ts` и reward flow сопоставлены с [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\STORY.md) и [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md).

- [x] Проверить, какие тексты сейчас хардкодятся в runtime.
- Результат:
- список runtime-строк собран; явные строки из `DiaryScene` вынесены в `locales.ts`.

## Фаза 2. Подготовить data model под мультиязычный канон

- [x] Зафиксировать runtime refactor order по файлам.
- Результат:
- есть рабочий порядок внедрения: [TEMP_RUNTIME_REFACTOR_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_RUNTIME_REFACTOR_PLAN.md).

- [x] Ввести стабильные ids для narrative-слоя.
- Результат:
- используются `chapter_id`, `point_id`, `reward_id`, `entity_id`.

- [x] Развести `ru` и `global` значения по правилу variant B.
- Результат:
- `ru` локаль использует ru pack;
- все `non-ru` локали используют global pack.

- [x] Определить формат хранения narrative texts.
- Результат:
- понятно, где лежат:
- diary entries;
- reward titles;
- artifact titles;
- chapter titles.
- Черновая схема данных зафиксирована в [TEMP_DATA_SCHEMA.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\TEMP_DATA_SCHEMA.md).

- [x] Убрать зависимость runtime от старых display names.
- Результат:
- код опирается на ids и locale pack, а не на случайные строки в данных.

## Фаза 3. Интегрировать новый narrative pack

- [x] Подключить канонические названия глав.
- Результат:
- карта и прогресс используют актуальный naming canon.

- [ ] Подключить новые названия экспедиции и артефакта.
- Результат:
- runtime не расходится с [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\STORY.md) и [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\NAMING.md).

- [x] Привязать `30` точек к каноническим записям экспедиции.
- Результат:
- каждая точка имеет свой narrative entry.

- [x] Привязать `30` точек к narrative rewards.
- Результат:
- reward flow совпадает с [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md).

- [x] Пересобрать Diary screen под новый narrative layer.
- Результат:
- дневник показывает не только коллекцию, но и story progression.

- [x] Пересобрать Reward screen под новый canon.
- Результат:
- награда после победы соответствует point/reward/story logic.

## Фаза 4. Локализация

- [x] Зафиксировать `ru` как master text pack.
- Результат:
- канонический текст сначала живёт в `ru`.

- [x] Подготовить `global/en` narrative pack.
- Результат:
- есть рабочая international master-версия для всех non-`ru` локалей.

- [ ] Проверить, что длинные строки влезают в mobile UI.
- Результат:
- нет явного overflow на `map`, `reward`, `diary`, `settings`.

- [ ] Подготовить wave-based localization rollout.
- Результат:
- `Wave 1`: `ru`, `en/global`;
- `Wave 2`: `tr`, `zh`, `hi`, `vi`;
- `Wave 3`: `es`, `pt`, `ar`, `id`, затем `fr`, `de`, `ja`, `it`, `ko`.

- [ ] Проверить, что текст не вшивается в графику без необходимости.
- Результат:
- ключевые ассеты остаются language-agnostic.

## Фаза 5. Ассеты

- [ ] Синхронизировать runtime с [ASSET_EXPORT_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\ASSET_EXPORT_SHEET.md).
- Результат:
- понятно, какие реальные файлы должны появиться в проекте дальше.

- [ ] Определить список `P0` ассетов для первой замены текущих заглушек.
- Результат:
- готов shortlist первых production assets.

- [ ] Проверить, какие текущие svg являются финальными, а какие временными.
- Результат:
- список `keep / replace`.

- [ ] Подготовить P0 prompt pack для генерации или отрисовки.
- Результат:
- можно начать производство ассетов без повторного анализа.

## Фаза 6. Платформа и продуктовая проверка

- [ ] Проверить игру в окружении Яндекс Игр.
- Результат:
- подтверждена работа SDK, авторизации, рекламы, сохранений.

- [ ] Проверить cloud save end-to-end.
- Результат:
- локальное и облачное сохранение не конфликтуют.

- [ ] Проверить rewarded ads end-to-end.
- Результат:
- ad flow не ломает игру и награду.

- [ ] Проверить первую сессию на мобильном.
- Результат:
- игрок доходит до первой партии и первой награды без лишнего трения.

- [ ] Проверить первые `5` раскладов вручную.
- Результат:
- стартовая кривая сложности приемлемая.

## Фаза 7. Публикационный пакет

- [ ] Финализировать title/subtitle/store messaging.
- Результат:
- карточка игры соответствует новому positioning.

- [ ] Подготовить final icon, cover, screenshots.
- Результат:
- есть store-ready media pack.

- [ ] Пройти финальный smoke test.
- Результат:
- сборка, UX, локализация, save, ads проверены перед релизом.

## Приоритеты

- `P0`
- sync `docs ↔ runtime`
- narrative data model
- `ru + global` text integration
- platform smoke test

- `P1`
- diary/reward UX rebuild
- first P0 assets
- mobile string overflow check

- `P2`
- wave 2 localization
- asset polish
- analytics hardening

## Что можно отложить

- `Quick Play`
- streak UI
- advanced analytics
- extra chapters
- expanded cosmetics
- full audio pack beyond MVP baseline

## Критерии завершения этого файла

- [ ] runtime синхронизирован с новым каноном
- [ ] narrative layer живёт в данных, а не в хардкоде
- [ ] `ru/global` локализация работает по принятому правилу
- [ ] P0 ассеты определены и частично заведены
- [ ] игра проверена в окружении Яндекс Игр
- [ ] публикационный пакет готов

## После завершения

- удалить этот файл
- оставить канон только в основных спеках и production docs
