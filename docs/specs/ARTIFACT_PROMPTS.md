# Solitaire: Expedition — Artifact Prompt Pack

## Статус

`Зафиксировано как рабочая спека для генерации сюжетных артефактов`

Связанные документы:

- общий список ассетов: [ASSETS.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\ASSETS.md)
- narrative rewards: [PRODUCTION_SHEET.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\PRODUCTION_SHEET.md)
- сюжет и находки: [STORY.md](C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\STORY.md)

## Назначение

- этот документ задаёт единый визуальный подход для `9` сюжетных артефактов;
- промпты предназначены для генерации `master illustration`, из которой потом можно получить:
- большой экран находки;
- среднюю иллюстрацию для дневника;
- малую иконку для сетки.

## Художественное решение

- стиль: `archival collectible realism`;
- подача: один предмет или небольшой набор связанных деталей, как ценная архивная находка;
- тон: спокойный, взрослый, исследовательский;
- свет: мягкий тёплый боковой или верхне-боковой;
- фон: нейтральный архивный, тёмно-зелёный, пыльно-песочный, бумажный или стол исследователя;
- композиция: центрированная, чистая, с хорошим силуэтом предмета;
- детализация: высокая, но без перегруза;
- без фэнтези-магии;
- без мультяшности;
- без глянцевой mobile-game стилизации;
- без текста, букв, подписей и UI;
- все `9` артефактов должны ощущаться частью одной коллекции.

## Технические рекомендации

- master size: `1536x2048`;
- aspect ratio: `3:4`;
- безопасные поля по краям для будущего кропа;
- объект должен хорошо читаться и в крупном, и в среднем размере;
- фон не должен спорить с предметом;
- допустимы лёгкие следы времени: пыль, потёртости, сгибы, окисление, царапины.

## Общий negative block

```text
no readable text, no labels, no UI, no logo, no fantasy glow, no magic effects, no cartoon, no chibi, no glossy mobile game style, no cluttered background
```

## OpenAI Images Prompts

### 1. Штамп экспедиции

```text
Create a realistic archival collectible illustration of an old brass expedition stamp. The stamp should have worn engraved markings, slight oxidation, and visible signs of field use. Present it like a carefully documented museum-archive find, with soft warm side lighting, a dark green and dusty sand palette, a clean centered composition, and elegant negative space. Keep it realistic, calm, and premium. No text, no labels, no fantasy magic, no cartoon style, no glossy mobile-game look.
```

### 2. Первый фрагмент карты

```text
Create a realistic archival collectible illustration of a torn map fragment. Show faded route lines, pencil corrections, creases, and aged paper texture. Present it as a carefully documented expedition find with soft warm side lighting, a dark green and dusty sand palette, and a clean centered composition. No text, no labels, no fantasy, no cartoon style, no glossy game look.
```

### 3. Неописанный предмет

```text
Create a realistic archival collectible illustration of a small unidentified expedition object made of dark stone and metal. It should feel plausible and historical, with subtle tool marks and aged surfaces. Present it like a carefully documented archive find, centered, softly lit, and easy to read as a silhouette. No text, no labels, no fantasy magic, no cartoon style.
```

### 4. Заметка Левина

```text
Create a realistic archival collectible illustration of a folded field note page with dense handwritten observations, pencil pressure marks, and slightly frayed corners. It should feel like a scientist’s expedition note, presented as a documented archive find. Use warm side lighting, aged paper texture, and a calm historical atmosphere. Do not render readable text or labels.
```

### 5. Записка без подписи

```text
Create a realistic archival collectible illustration of a small unsigned handwritten note on worn paper. It should feel important and restrained, with careful folds and a subtle sense of tension. Present it as a museum-archive expedition find, with warm side lighting and a clean centered composition. Do not include readable text or labels.
```

### 6. Футляр от артефакта

```text
Create a realistic archival collectible illustration of an empty protective artifact case. Use worn leather, metal fittings, and an interior shaped to hold something valuable. Present it as a carefully documented expedition find, centered, softly lit, and realistic. No text, no labels, no fantasy elements, no cartoon style.
```

### 7. Крупный фрагмент скрытой карты

```text
Create a realistic archival collectible illustration of a larger hidden map fragment. Show layered route marks, corrections, faint contour lines, folds, and weathered paper edges. Present it as a documented expedition archive object with warm side light and a calm premium historical tone. No text, no labels, no fantasy, no cartoon.
```

### 8. Контейнер диска

```text
Create a realistic archival collectible illustration of a sturdy expedition container designed to hold a circular artifact. Use aged leather, reinforced corners, clasps, and subtle signs of careful handling. Present it like a museum-archive expedition find with warm side lighting and clean centered composition. No text, no labels, no fantasy, no cartoon style.
```

### 9. Печать архива

```text
Create a realistic archival collectible illustration of an official archive seal tool together with a wax impression. It should feel formal, restrained, and slightly worn, connected to preserved expedition records. Present it as a carefully documented archival object with warm side lighting, centered composition, and premium historical tone. No text, no labels, no fantasy, no cartoon style.
```

## Master Prompt

```text
A realistic archival collectible illustration of [ARTIFACT], shown as a carefully documented expedition find. Calm museum-archive presentation, soft warm side lighting, dark green and dusty sand palette, subtle paper-and-fieldwork atmosphere, highly readable silhouette, refined material detail, realistic wear, no fantasy magic, no cartoon style, no glossy mobile game look, no text, no labels, no extra decorative clutter. Centered composition, elegant negative space, premium historical adventure game asset, cohesive with a quiet lost-expedition theme.
```

## Prompt Table

| asset_id | artifact | OpenAI Images |
|---|---|---|
| `artifact_stamp` | Штамп экспедиции | `Create a realistic archival collectible illustration of an old brass expedition stamp. The stamp should have worn engraved markings, slight oxidation, and visible signs of field use. Present it like a carefully documented museum-archive find, with soft warm side lighting, a dark green and dusty sand palette, a clean centered composition, and elegant negative space. Keep it realistic, calm, and premium. No text, no labels, no fantasy magic, no cartoon style, no glossy mobile-game look.` |
| `artifact_map_fragment_01` | Первый фрагмент карты | `Create a realistic archival collectible illustration of a torn map fragment. Show faded route lines, pencil corrections, creases, and aged paper texture. Present it as a carefully documented expedition find with soft warm side lighting, a dark green and dusty sand palette, and a clean centered composition. No text, no labels, no fantasy, no cartoon style, no glossy game look.` |
| `artifact_unidentified_object` | Неописанный предмет | `Create a realistic archival collectible illustration of a small unidentified expedition object made of dark stone and metal. It should feel plausible and historical, with subtle tool marks and aged surfaces. Present it like a carefully documented archive find, centered, softly lit, and easy to read as a silhouette. No text, no labels, no fantasy magic, no cartoon style.` |
| `artifact_levin_note` | Заметка Левина | `Create a realistic archival collectible illustration of a folded field note page with dense handwritten observations, pencil pressure marks, and slightly frayed corners. It should feel like a scientist’s expedition note, presented as a documented archive find. Use warm side lighting, aged paper texture, and a calm historical atmosphere. Do not render readable text or labels.` |
| `artifact_unsigned_note` | Записка без подписи | `Create a realistic archival collectible illustration of a small unsigned handwritten note on worn paper. It should feel important and restrained, with careful folds and a subtle sense of tension. Present it as a museum-archive expedition find, with warm side lighting and a clean centered composition. Do not include readable text or labels.` |
| `artifact_case` | Футляр от артефакта | `Create a realistic archival collectible illustration of an empty protective artifact case. Use worn leather, metal fittings, and an interior shaped to hold something valuable. Present it as a carefully documented expedition find, centered, softly lit, and realistic. No text, no labels, no fantasy elements, no cartoon style.` |
| `artifact_hidden_map_large` | Крупный фрагмент скрытой карты | `Create a realistic archival collectible illustration of a larger hidden map fragment. Show layered route marks, corrections, faint contour lines, folds, and weathered paper edges. Present it as a documented expedition archive object with warm side light and a calm premium historical tone. No text, no labels, no fantasy, no cartoon.` |
| `artifact_disc_container` | Контейнер диска | `Create a realistic archival collectible illustration of a sturdy expedition container designed to hold a circular artifact. Use aged leather, reinforced corners, clasps, and subtle signs of careful handling. Present it like a museum-archive expedition find with warm side lighting and clean centered composition. No text, no labels, no fantasy, no cartoon style.` |
| `artifact_archive_seal` | Печать архива | `Create a realistic archival collectible illustration of an official archive seal tool together with a wax impression. It should feel formal, restrained, and slightly worn, connected to preserved expedition records. Present it as a carefully documented archival object with warm side lighting, centered composition, and premium historical tone. No text, no labels, no fantasy, no cartoon style.` |
