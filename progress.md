Original prompt: route sheet UX redesign with route pages, route point modal, archive split, and reward reveal cleanup.

2026-04-03
- Canvas Sharpness Pass: переведены все заметные анимации из canvas в DOM overlay.
- Stock -> waste анимация добора теперь использует DOM slide + flip/reveal вместо canvas flyContainer.
- Flying-card анимации (waste -> foundation, tableau -> foundation, auto-complete) переведены на DOM overlay.
- Удалён старый canvas `flyContainer` и `createFlyingCard` метод.
- Экран партии теперь полностью использует DOM/SVG для анимаций, сохраняя Phaser для boardLayer и hit-areas.
- Все тесты проходят (80/80), сборка успешна.
- Next: финальная проверка в браузере и подготовка к релизу.

2026-04-02
- Added route sheet data model with 4 pages: 8 / 8 / 7 / 7.
- Reworked MapScene into route-sheet main screen while keeping the existing scene id to avoid breaking transitions.
- Route now runs bottom-to-top and uses a softer meandering path instead of a diagonal line.
- Replaced floating next-point caption with a fixed lower hint block inside the sheet above the bottom nav.
- Added atmospheric route sheet titles: "Начало пути", "Каменная гряда", "Разорванный маршрут", "Последняя стоянка".
- Started route point modal as a DOM overlay with tabs for "Запись" and "Артефакт".
- Verified passed-point modal in live browser.
- Entry tab opens full canonical text with scroll.
- Artifact tab switches correctly and now uses direct Vite asset URLs instead of Phaser blob URLs for large images.
- Archive now shows tabs `Записи / Артефакты`.
- `Артефакты` shows only opened artifacts; locked/blurred placeholders and total counter were removed.
- Archive header back arrow was removed; return to route now goes through the bottom nav.
- Removed hard borders from route and archive meta screens.
- Route and Archive now use the same separated bottom-nav zone instead of a framed page container.
- Background stripes were removed.
- Route sheets now support per-page background themes via `routeSheets.background`.
- Next: polish Archive cards and remove unused blur artifact loading from BootScene.
