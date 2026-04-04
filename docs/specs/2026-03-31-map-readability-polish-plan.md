# Map Readability Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Улучшить читаемость экрана карты без редизайна и без изменения игрового цикла.

**Architecture:** Геометрию карты и spacing оставить в helper-слое, а верхний текстовый блок карты перевести на DOM overlay, чтобы он рендерился браузером, а не canvas-текстом Phaser. `MapScene` будет собирать canvas-часть и DOM-часть вместе.

**Tech Stack:** TypeScript, Phaser, Vitest

---

## File Structure

- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\mapSceneLayout.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\mapSceneLayout.test.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\mapSceneOverlay.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\mapSceneOverlay.test.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\MapScene.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\app\bootstrap\createGame.ts`

`mapSceneLayout.ts` отвечает только за:
- шрифтовые константы для `serif-led` варианта;
- размеры ключевых текстовых блоков;
- генерацию целочисленных точек маршрута.

`mapSceneOverlay.ts` отвечает только за HTML/CSS верхнего блока карты.

`MapScene.ts` остаётся сценой и только использует эти данные.

### Task 1: Layout Helper

**Files:**
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\mapSceneLayout.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\mapSceneLayout.test.ts`

- [ ] **Step 1: Write failing tests**

Покрыть:
- serif только для title/chapter;
- UI font для expedition/subtitle/progress/node labels;
- `buildRoutePoints` возвращает целые координаты и не выходит за границы.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/scenes/mapSceneLayout.test.ts`
Expected: FAIL because helper does not exist

- [ ] **Step 3: Implement helper**

Добавить:
- `MAP_SCENE_TYPOGRAPHY`
- `MAP_SCENE_SPACING`
- `buildRoutePoints(count, bounds)`

- [ ] **Step 4: Run test**

Run: `npm.cmd test -- src/scenes/mapSceneLayout.test.ts`
Expected: PASS

### Task 2: MapScene Polish

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\app\bootstrap\createGame.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\mapSceneOverlay.ts`
- Create: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\mapSceneOverlay.test.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\MapScene.ts`

- [ ] **Step 1: Write failing test for overlay HTML**

Покрыть:
- HTML содержит title;
- HTML содержит expedition name;
- HTML содержит chapter header;
- HTML использует serif только для крупных заголовков.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- src/scenes/mapSceneOverlay.test.ts`
Expected: FAIL because overlay helper does not exist

- [ ] **Step 3: Implement overlay helper**

Добавить:
- `buildMapHeaderOverlayHtml(...)`

- [ ] **Step 4: Enable Phaser DOM container**

Включить `dom.createContainer` в `createGame.ts`.

- [ ] **Step 5: Replace canvas header text with DOM overlay**

Перевести в DOM:
- title
- expedition_name
- subtitle
- chapter header
- coin display
- progress text

- [ ] **Step 6: Keep route and progress bar in canvas**

Увеличить:
- ширину path line;
- радиусы node circles;
- толщину stroke;
- размер node labels.

- [ ] **Step 7: Run full tests**

Run: `npm.cmd test`
Expected: PASS

- [ ] **Step 8: Run build**

Run: `npm.cmd run build`
Expected: PASS
