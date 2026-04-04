# Canvas Sharpness Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Убрать самое заметное мыло в `Game` и `Map`, не ломая геометрию Phaser и ввод.

**Architecture:** Статические UI-элементы, которые сейчас размываются в canvas, переезжают в DOM/SVG overlay. Интерактивность и игровая механика остаются в Phaser, поэтому hit-area и drag/drop не меняют координатную систему.

**Tech Stack:** Phaser, Vite, DOM overlay, SVG/HTML, Vitest

---

### Task 1: Резкий верхний ряд на экране игры

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\gameSceneOverlay.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\GameScene.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\styles.css`
- Test: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\gameSceneOverlay.test.ts`

- [ ] Передать в overlay данные верхнего ряда: count колоды, состояние waste, foundation placeholders.
- [ ] Нарисовать DOM-слоты и DOM-текст для верхнего ряда.
- [ ] Убрать canvas-рамки и canvas-текст для `stock / waste / foundations`, оставив canvas-хитзоны и карты.
- [ ] Проверить `Game` в браузере на длинном заголовке и на пустых foundation-слотах.

### Task 2: Резкий маршрут на главной странице

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\routeSceneOverlay.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\MapScene.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\styles.css`
- Test: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\routeSceneOverlay.test.ts`

- [ ] Передать в overlay точки маршрута и сегменты.
- [ ] Собрать SVG-маршрут в overlay: линии, точки, номера.
- [ ] Убрать canvas-отрисовку маршрута, оставив Phaser hit-area точек и навигацию.
- [ ] Проверить `Маршрут → Архив → назад`, чтобы overlay не сломал клики.

### Task 3: Проверка и добивка

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\2026-04-03-canvas-sharpness-pass.md`

- [ ] Прогнать `vitest` по overlay-тестам.
- [ ] Прогнать `vite build`.
- [ ] Снять живые скрины `Game` и `Map` после перевода слоёв.

### Task 4: Detail-навигация

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DetailScene.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\detailSceneOverlay.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\2026-04-02-archive-redesign.md`

- [ ] Переименовать верхнюю detail-кнопку в `Назад`.
- [ ] Переключить переход по этой кнопке на `Архив`.
- [ ] Проверить живой переход `Архив → Detail → Назад`.
