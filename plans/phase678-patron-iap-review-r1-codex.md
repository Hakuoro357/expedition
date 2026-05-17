[MAJOR] (1) `src/data/narrative/entries.tr.ts:34-35` добавляет `author_thanks` на английском, хотя `tr` pack уже содержит турецкие narrative entries и `getNarrativeEntry(..., "tr")` берет `entries.tr.ts` до global fallback. (2) Для Turkish locale paid archive reward будет выбиваться из языка архива; fallback на global здесь не сработает. (3) Перевести `author_thanks` в `entries.tr.ts` на турецкий либо явно удалить tr override и зафиксировать, что для этой записи Turkish намеренно использует global EN fallback.

Tests/build не запускал: review в read-only sandbox, проверял diff и локальные файлы.

CONCERNS REMAIN