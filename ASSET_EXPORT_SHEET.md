# Solitaire: Expedition — Asset Export Sheet

## Статус

`Зафиксировано как production-sheet для promo, core, meta и audio ассетов`

## Назначение

- Этот документ раскладывает `promo`, `core`, `meta` и `audio` ассеты по стабильным `asset_id`, `file_id`, форматам и export-правилам.
- Narrative rewards вынесены отдельно в [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\PRODUCTION_SHEET.md).
- Этот лист нужен для реального производства и передачи в генерацию, отрисовку или сборку финальных файлов.

## Общие правила

- Во всех таблицах использовать стабильные `asset_id` и `file_id`.
- Имена файлов держать на латинице, в `snake_case`, без пробелов и кириллицы.
- Версии файлов помечать суффиксами вида `_v01`, `_v02`.
- Текст по возможности не вшивать в растровую графику.
- Для `ru` и `global` использовать отдельный текстовый слой, а не отдельный фон.

## Рекомендуемая структура production-папок

- `docs/prod/promo`
- `docs/prod/core/cards`
- `docs/prod/core/ui`
- `docs/prod/meta/map`
- `docs/prod/meta/journal`
- `docs/prod/meta/reward`
- `docs/prod/audio/music`
- `docs/prod/audio/sfx`

## Таблица promo-ассетов

| asset_id | file_id | suggested_filename | folder | master_spec | export_spec | text_policy | priority |
|---|---|---|---|---|---|---|---|
| promo_icon_main | promo_icon_main | promo_icon_main_v01.png | `docs/prod/promo` | `1024x1024 PNG` | `512x512 PNG` | no_text | P0 |
| promo_icon_maskable | promo_icon_maskable | promo_icon_maskable_v01.png | `docs/prod/promo` | `1024x1024 PNG` | `512x512 PNG` | no_text | P0 |
| promo_cover_main | promo_cover_main | promo_cover_main_v01.png | `docs/prod/promo` | `1600x940 PNG` | `800x470 PNG` | separate_if_needed | P0 |
| promo_hero_image | promo_hero_image | promo_hero_image_v01.png | `docs/prod/promo` | `3120x1040 PNG` | `1560x520 PNG/JPG` | separate_if_needed | P1 |
| promo_screenshot_table | promo_screenshot_table | promo_screenshot_table_v01.png | `docs/prod/promo` | `2560x1440 PNG` | `store screenshot` | ui_text_runtime | P0 |
| promo_screenshot_map | promo_screenshot_map | promo_screenshot_map_v01.png | `docs/prod/promo` | `2560x1440 PNG` | `store screenshot` | ui_text_runtime | P0 |
| promo_screenshot_journal | promo_screenshot_journal | promo_screenshot_journal_v01.png | `docs/prod/promo` | `2560x1440 PNG` | `store screenshot` | ui_text_runtime | P0 |
| promo_screenshot_reward | promo_screenshot_reward | promo_screenshot_reward_v01.png | `docs/prod/promo` | `2560x1440 PNG` | `store screenshot` | ui_text_runtime | P0 |
| promo_screenshot_victory | promo_screenshot_victory | promo_screenshot_victory_v01.png | `docs/prod/promo` | `2560x1440 PNG` | `store screenshot` | ui_text_runtime | P1 |
| promo_screenshot_collection | promo_screenshot_collection | promo_screenshot_collection_v01.png | `docs/prod/promo` | `2560x1440 PNG` | `store screenshot` | ui_text_runtime | P1 |

## Таблица core-ассетов

| asset_id | file_id | suggested_filename | folder | master_spec | export_spec | text_policy | priority |
|---|---|---|---|---|---|---|---|
| core_cards_front_set | core_cards_front_set | core_cards_front_set_v01 | `docs/prod/core/cards` | `card master set` | `52 PNG exports` | indexes_built_in | P0 |
| core_cards_front_pattern | core_cards_front_pattern | card_front_{rank}_{suit}_v01.png | `docs/prod/core/cards/fronts` | `900x1260 PNG` | `runtime card export` | indexes_built_in | P0 |
| core_card_back_base | core_card_back_base | card_back_base_v01.png | `docs/prod/core/cards/backs` | `900x1260 PNG` | `runtime card export` | no_text | P0 |
| core_card_back_reward_01 | core_card_back_reward_01 | card_back_compass_v01.png | `docs/prod/core/cards/backs` | `900x1260 PNG` | `runtime card export` | no_text | P1 |
| core_card_back_reward_02 | core_card_back_reward_02 | card_back_archive_seal_v01.png | `docs/prod/core/cards/backs` | `900x1260 PNG` | `runtime card export` | no_text | P1 |
| core_table_bg | core_table_bg | core_table_bg_v01.png | `docs/prod/core` | `2560x1440 PNG` | `desktop/mobile crop` | no_text | P0 |
| core_slot_set | core_slot_set | core_slot_set_v01.png | `docs/prod/core/ui` | `2048x2048 PNG` | `sprite export` | no_text | P0 |
| core_glow_victory | core_glow_victory | core_glow_victory_v01.png | `docs/prod/core/ui` | `2048x2048 PNG` | `fx sprite export` | no_text | P1 |
| core_ui_buttons | core_ui_buttons | core_ui_buttons_v01.png | `docs/prod/core/ui` | `2048x2048 PNG` | `sprite export` | icon_only | P0 |
| core_ui_panels | core_ui_panels | core_ui_panels_v01.png | `docs/prod/core/ui` | `2048x2048 PNG` | `panel slices` | no_text | P0 |
| core_ui_icons | core_ui_icons | core_ui_icons_v01.png | `docs/prod/core/ui` | `2048x2048 PNG` | `icon atlas` | no_text | P0 |

## Таблица meta-ассетов

| asset_id | file_id | suggested_filename | folder | master_spec | export_spec | text_policy | priority |
|---|---|---|---|---|---|---|---|
| meta_map_screen_base | meta_map_screen_base | meta_map_screen_base_v01.png | `docs/prod/meta/map` | `2560x1440 PNG` | `desktop/mobile crop` | no_text | P0 |
| meta_map_route_line | meta_map_route_line | meta_map_route_line_v01.png | `docs/prod/meta/map` | `2048x2048 PNG` | `overlay export` | no_text | P0 |
| meta_map_nodes_set | meta_map_nodes_set | meta_map_nodes_set_v01.png | `docs/prod/meta/map` | `2048x2048 PNG` | `node sprite export` | no_text | P0 |
| meta_map_decor_set | meta_map_decor_set | meta_map_decor_set_v01.png | `docs/prod/meta/map` | `2048x2048 PNG` | `overlay export` | no_text | P1 |
| meta_chapter_bg_01 | meta_chapter_bg_01 | meta_chapter_bg_01_trailhead_v01.png | `docs/prod/meta/map` | `2560x1440 PNG` | `desktop/mobile crop` | no_text | P1 |
| meta_chapter_bg_02 | meta_chapter_bg_02 | meta_chapter_bg_02_false_trail_v01.png | `docs/prod/meta/map` | `2560x1440 PNG` | `desktop/mobile crop` | no_text | P1 |
| meta_chapter_bg_03 | meta_chapter_bg_03 | meta_chapter_bg_03_last_camp_v01.png | `docs/prod/meta/map` | `2560x1440 PNG` | `desktop/mobile crop` | no_text | P1 |
| meta_journal_screen | meta_journal_screen | meta_journal_screen_v01.png | `docs/prod/meta/journal` | `2560x1440 PNG` | `desktop/mobile crop` | text_separate | P1 |
| meta_journal_page_template | meta_journal_page_template | meta_journal_page_template_v01.png | `docs/prod/meta/journal` | `1600x1200 PNG` | `page export` | text_separate | P1 |
| meta_reward_screen | meta_reward_screen | meta_reward_screen_v01.png | `docs/prod/meta/reward` | `2560x1440 PNG` | `desktop/mobile crop` | text_separate | P1 |
| meta_reward_card | meta_reward_card | meta_reward_card_v01.png | `docs/prod/meta/reward` | `1600x1200 PNG` | `card export` | text_separate | P1 |
| meta_chapter_complete | meta_chapter_complete | meta_chapter_complete_v01.png | `docs/prod/meta/reward` | `1600x1200 PNG` | `reward export` | text_separate | P1 |
| meta_daily_reward | meta_daily_reward | meta_daily_reward_v01.png | `docs/prod/meta/reward` | `1600x1200 PNG` | `reward export` | text_separate | P2 |

## Таблица audio-ассетов

| asset_id | file_id | suggested_filename | folder | master_spec | export_spec | text_policy | priority |
|---|---|---|---|---|---|---|---|
| music_menu_theme | music_menu_theme | music_menu_theme_v01.wav | `docs/prod/audio/music` | `WAV 48k/24bit stereo` | `OGG runtime + WAV master` | n/a | P1 |
| music_gameplay_loop | music_gameplay_loop | music_gameplay_loop_v01.wav | `docs/prod/audio/music` | `WAV 48k/24bit stereo` | `OGG runtime + WAV master` | n/a | P0 |
| music_map_loop | music_map_loop | music_map_loop_v01.wav | `docs/prod/audio/music` | `WAV 48k/24bit stereo` | `OGG runtime + WAV master` | n/a | P1 |
| music_reward_sting | music_reward_sting | music_reward_sting_v01.wav | `docs/prod/audio/music` | `WAV 48k/24bit stereo` | `OGG runtime + WAV master` | n/a | P1 |
| music_victory_sting | music_victory_sting | music_victory_sting_v01.wav | `docs/prod/audio/music` | `WAV 48k/24bit stereo` | `OGG runtime + WAV master` | n/a | P1 |
| sfx_ui_click | sfx_ui_click | sfx_ui_click_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P0 |
| sfx_ui_back | sfx_ui_back | sfx_ui_back_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P1 |
| sfx_card_pick | sfx_card_pick | sfx_card_pick_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P0 |
| sfx_card_place | sfx_card_place | sfx_card_place_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P0 |
| sfx_card_flip | sfx_card_flip | sfx_card_flip_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P0 |
| sfx_valid_move | sfx_valid_move | sfx_valid_move_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P0 |
| sfx_invalid_move | sfx_invalid_move | sfx_invalid_move_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P0 |
| sfx_hint | sfx_hint | sfx_hint_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P1 |
| sfx_undo | sfx_undo | sfx_undo_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P1 |
| sfx_claim_reward | sfx_claim_reward | sfx_claim_reward_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P1 |
| sfx_map_node_unlock | sfx_map_node_unlock | sfx_map_node_unlock_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P1 |
| sfx_reward_open | sfx_reward_open | sfx_reward_open_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P1 |
| sfx_journal_open | sfx_journal_open | sfx_journal_open_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P1 |
| sfx_artifact_found | sfx_artifact_found | sfx_artifact_found_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P1 |
| sfx_chapter_complete | sfx_chapter_complete | sfx_chapter_complete_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P1 |
| sfx_rare_reward_glow | sfx_rare_reward_glow | sfx_rare_reward_glow_v01.wav | `docs/prod/audio/sfx` | `WAV 48k/24bit mono/stereo` | `OGG/WAV runtime` | n/a | P2 |

## Карточная нотация

- Для лицевых карт использовать шаблон:
- `card_front_a_spades_v01.png`
- `card_front_10_hearts_v01.png`
- `card_front_k_diamonds_v01.png`
- Для мастей использовать только:
- `spades`
- `hearts`
- `clubs`
- `diamonds`
- Для рангов использовать:
- `a`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `j`, `q`, `k`

## Export checklist

Перед фиксацией ассета проверять:

1. Имя файла соответствует `asset_id/file_id`.
2. Версия указана.
3. Формат соответствует таблице.
4. Нет случайно вшитого текста там, где нужен отдельный слой.
5. Для `promo` ассетов объект не вылезает за safe area.
6. Для `core` карт индексы читаемы на мобильном размере.
7. Для `meta` экранов есть запас под длинные локализованные строки.
8. Для `audio` есть и мастер, и runtime-экспорт.

## Порядок производства

1. `promo_icon_main`
2. `promo_cover_main`
3. `core_cards_front_set`
4. `core_card_back_base`
5. `core_table_bg`
6. `core_ui_buttons`
7. `core_ui_panels`
8. `core_ui_icons`
9. `meta_map_screen_base`
10. `meta_journal_screen`
11. `meta_reward_screen`
12. `music_gameplay_loop`
13. базовый набор `sfx_*`

## Связанные документы

- Общий ассет-лист: [ASSETS.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\ASSETS.md)
- Narrative rewards: [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\PRODUCTION_SHEET.md)
- Naming: [NAMING.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\NAMING.md)
- Локализация: [LOCALIZATION_PLAN.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\LOCALIZATION_PLAN.md)
