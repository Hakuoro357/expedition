# Solitaire: Expedition — Narrative Production Sheet

## Статус

`Зафиксировано как рабочий production-sheet для narrative rewards и связанных файлов`

## Назначение

- Этот документ раскладывает narrative-награды по стабильным `ids`, типам файлов и production-форматам.
- Основа берётся из [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\STORY.md), [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\NAMING.md) и [ASSETS.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\ASSETS.md).
- Это рабочая таблица для подготовки графических ассетов, а не для геймдизайна или кода.

## Общие правила

- Во внутренних таблицах использовать `point_id`, `reward_id`, `asset_id`, `file_id`.
- Отображаемые строки не хардкодить в графику без необходимости.
- Для `ru` использовать названия из `ru`, для всех `non-ru` локалей использовать `global`.
- Тексты дневника, подписи и заголовки хранить отдельным текстовым слоем.
- Все имена файлов держать на латинице, в `snake_case`, без пробелов и кириллицы.
- Версии файлов отмечать суффиксами вида `_v01`, `_v02`.

## Базовые технические правила

- `PNG` использовать для предметов, бумажных фрагментов, карт, штампов и UI-наград.
- `JPG` допустим для полноформатных фото без прозрачности, если нужен более лёгкий мастер.
- Для narrative reward-ассетов по умолчанию готовить мастер не меньше `1600x1200`.
- Для карт, крупных схем и финальной сборки маршрута готовить мастер не меньше `2048x2048`.
- Если на изображении есть текст, он должен быть отдельным слоем или отдельным экспортом под локализацию.

## Поля таблицы

- `point_id` — стабильный id точки прогресса.
- `chapter_id` — глава маршрута.
- `reward_id` — стабильный id narrative-награды.
- `asset_type` — тип визуального ассета.
- `naming_ref` — ссылка на `entity_id` из [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\NAMING.md), если применимо.
- `file_id` — стабильный production-id файла.
- `suggested_filename` — рекомендуемое имя экспортируемого файла.
- `master_spec` — целевой мастер-формат.
- `text_layer` — как держать текст.
- `priority` — production priority.

## Рекомендуемая структура папок

- `docs/prod/narrative/diary`
- `docs/prod/narrative/map`
- `docs/prod/narrative/photo`
- `docs/prod/narrative/artifact`
- `docs/prod/narrative/archive`
- `docs/prod/narrative/reward`

## Таблица narrative rewards

| point_id | chapter_id | reward_id | asset_type | naming_ref | file_id | suggested_filename | master_spec | text_layer | priority |
|---|---|---|---|---|---|---|---|---|---|
| pt_01 | chapter_01 | reward_diary_page_01 | diary_page | leader | narrative_diary_page_01 | narrative_diary_page_01_v01.png | `1600x1200 PNG` | separate | P0 |
| pt_02 | chapter_01 | reward_expedition_stamp_01 | stamp | expedition_name | narrative_expedition_stamp_01 | narrative_expedition_stamp_01_v01.png | `1600x1200 PNG` | none | P1 |
| pt_03 | chapter_01 | reward_map_piece_01 | map_piece | chapter_01 | narrative_map_piece_01 | narrative_map_piece_01_v01.png | `2048x2048 PNG` | none | P0 |
| pt_04 | chapter_01 | reward_camp_marker_01 | map_marker | chapter_01 | narrative_camp_marker_01 | narrative_camp_marker_01_v01.png | `1600x1200 PNG` | none | P1 |
| pt_05 | chapter_01 | reward_stone_sign_note_01 | clue_note | chapter_01 | narrative_clue_note_01 | narrative_clue_note_01_v01.png | `1600x1200 PNG` | separate | P1 |
| pt_06 | chapter_01 | reward_unknown_item_01 | artifact_fragment | artifact_main | narrative_artifact_fragment_01 | narrative_artifact_fragment_01_v01.png | `1600x1200 PNG` | none | P0 |
| pt_07 | chapter_01 | reward_photo_ridge_01 | photo | chapter_01 | narrative_photo_ridge_01 | narrative_photo_ridge_01_v01.jpg | `1600x1200 JPG` | separate_caption | P0 |
| pt_08 | chapter_01 | reward_map_variant_01 | map_variant | chapter_01 | narrative_map_variant_01 | narrative_map_variant_01_v01.png | `2048x2048 PNG` | separate | P0 |
| pt_09 | chapter_01 | reward_map_piece_02 | map_piece | chapter_01 | narrative_map_piece_02 | narrative_map_piece_02_v01.png | `2048x2048 PNG` | none | P0 |
| pt_10 | chapter_01 | reward_chapter_piece_01 | chapter_piece | chapter_01 | narrative_chapter_piece_01 | narrative_chapter_piece_01_v01.png | `2048x2048 PNG` | none | P0 |
| pt_11 | chapter_02 | reward_diary_page_damaged_01 | diary_page_damaged | leader | narrative_diary_page_damaged_01 | narrative_diary_page_damaged_01_v01.png | `1600x1200 PNG` | separate | P0 |
| pt_12 | chapter_02 | reward_map_variant_02 | map_variant | chapter_02 | narrative_map_variant_02 | narrative_map_variant_02_v01.png | `2048x2048 PNG` | separate | P0 |
| pt_13 | chapter_02 | reward_levin_note_01 | lore_note | archaeologist | narrative_lore_note_01 | narrative_lore_note_01_v01.png | `1600x1200 PNG` | separate | P1 |
| pt_14 | chapter_02 | reward_hidden_camp_marker_01 | map_marker | chapter_02 | narrative_hidden_camp_marker_01 | narrative_hidden_camp_marker_01_v01.png | `1600x1200 PNG` | none | P1 |
| pt_15 | chapter_02 | reward_torn_paper_01 | paper_fragment | chapter_02 | narrative_torn_paper_01 | narrative_torn_paper_01_v01.png | `1600x1200 PNG` | separate | P1 |
| pt_16 | chapter_02 | reward_anonymous_note_01 | anonymous_note | chapter_02 | narrative_anonymous_note_01 | narrative_anonymous_note_01_v01.png | `1600x1200 PNG` | separate | P1 |
| pt_17 | chapter_02 | reward_false_map_piece_01 | false_map_piece | chapter_02 | narrative_false_map_piece_01 | narrative_false_map_piece_01_v01.png | `2048x2048 PNG` | none | P0 |
| pt_18 | chapter_02 | reward_artifact_case_01 | artifact_case | artifact_main | narrative_artifact_case_01 | narrative_artifact_case_01_v01.png | `1600x1200 PNG` | none | P0 |
| pt_19 | chapter_02 | reward_photo_key_01 | photo | photographer_archivist | narrative_photo_key_01 | narrative_photo_key_01_v01.jpg | `1600x1200 JPG` | separate_caption | P0 |
| pt_20 | chapter_02 | reward_chapter_piece_02 | chapter_piece | chapter_02 | narrative_chapter_piece_02 | narrative_chapter_piece_02_v01.png | `2048x2048 PNG` | none | P0 |
| pt_21 | chapter_03 | reward_map_major_01 | map_major | chapter_03 | narrative_map_major_01 | narrative_map_major_01_v01.png | `2048x2048 PNG` | none | P0 |
| pt_22 | chapter_03 | reward_diary_page_02 | diary_page | leader | narrative_diary_page_02 | narrative_diary_page_02_v01.png | `1600x1200 PNG` | separate | P0 |
| pt_23 | chapter_03 | reward_final_camp_scheme_01 | map_major | chapter_03 | narrative_final_camp_scheme_01 | narrative_final_camp_scheme_01_v01.png | `2048x2048 PNG` | separate | P0 |
| pt_24 | chapter_03 | reward_personal_item_01 | personal_item | chapter_03 | narrative_personal_item_01 | narrative_personal_item_01_v01.png | `1600x1200 PNG` | none | P1 |
| pt_25 | chapter_03 | reward_artifact_case_major_01 | artifact_case_major | artifact_main | narrative_artifact_case_major_01 | narrative_artifact_case_major_01_v01.png | `1600x1200 PNG` | none | P0 |
| pt_26 | chapter_03 | reward_group_photo_final_01 | photo_major | photographer_archivist | narrative_group_photo_final_01 | narrative_group_photo_final_01_v01.jpg | `1600x1200 JPG` | separate_caption | P0 |
| pt_27 | chapter_03 | reward_logistics_note_01 | logistics_note | quartermaster_guide | narrative_logistics_note_01 | narrative_logistics_note_01_v01.png | `1600x1200 PNG` | separate | P1 |
| pt_28 | chapter_03 | reward_archive_note_01 | archive_note | chapter_03 | narrative_archive_note_01 | narrative_archive_note_01_v01.png | `1600x1200 PNG` | separate | P1 |
| pt_29 | chapter_03 | reward_archive_seal_01 | archive_seal | expedition_name | narrative_archive_seal_01 | narrative_archive_seal_01_v01.png | `1600x1200 PNG` | none | P0 |
| pt_30 | chapter_03 | reward_finale_bundle_01 | finale_reward | artifact_main | narrative_finale_bundle_01 | narrative_finale_bundle_01_v01.png | `2048x2048 PNG` | separate | P0 |

## Bundle-расшифровка для финальной точки

Для `pt_30` нужен не один предмет, а финальный набор:

- `narrative_final_disc_01_v01.png` — собранный `artifact_main`
- `narrative_final_map_01_v01.png` — полная карта маршрута
- `narrative_final_archive_01_v01.png` — завершённый архивный комплект
- `narrative_finale_bundle_01_v01.png` — key art для экрана финальной награды

## Что локализуется отдельно

- тексты дневника;
- подписи под фото;
- заголовки наград;
- названия глав;
- короткие описания найденных предметов.

## Что не вшивать в графику

- длинные дневниковые абзацы;
- имена персонажей;
- названия локалей;
- store-фразы;
- финальные объясняющие тексты.

## Минимальный production order

1. `P0` дневниковые страницы и повреждённые страницы.
2. `P0` куски карты, ложные карты и крупные схемы.
3. `P0` ключевые фотографии.
4. `P0` контейнеры и визуалы `artifact_main`.
5. `P0` печать архива и финальный bundle.
6. `P1` записки, бумажные фрагменты и личные предметы.

## Синхронизация с каноном

- Сюжетный источник: [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\STORY.md)
- Naming source: [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\NAMING.md)
- Общий ассет-лист: [ASSETS.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\ASSETS.md)
- Языковые правила: [LOCALIZATION_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\LOCALIZATION_PLAN.md)
