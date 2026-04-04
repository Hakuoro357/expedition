# Next Development Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Довести новый DOM-card экран партии до законченного состояния и затем перейти к финальному visual polish meta-экранов.

**Architecture:** Основная механика пасьянса остаётся в Phaser, а видимые face-up карты и UI уже живут в DOM/SVG. Следующий этап закрывает рассинхрон анимаций между canvas и DOM, после чего можно переходить к чистому визуальному polish `Reward` и `Архива`.

**Tech Stack:** Phaser, DOM overlay, SVG/HTML, Vitest, Vite, Chrome DevTools

---

### Task 1: Вернуть анимацию добора из stock в waste в DOM-card flow

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\GameScene.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\gameSceneOverlay.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\styles.css`
- Test: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\gameSceneOverlay.test.ts`

- [ ] Убрать старый `flyContainer` для сценария `stock -> waste`.
- [ ] Завести отдельное состояние DOM-анимации открытия карты из `stock`.
- [ ] Сохранить slide + flip/reveal, но уже на DOM-карте.
- [ ] Проверить, что счётчик `stock`, карта в `waste` и звук синхронны.

### Task 2: Довести flying-card анимации до нового DOM-card слоя

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\GameScene.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\features\board\cardFaceMarkup.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\styles.css`

- [ ] Проверить перелёт карты в foundation после ручного move.
- [ ] Проверить перелёт карты в foundation при auto-complete.
- [ ] Убрать заметный визуальный разрыв между DOM-картой на столе и canvas flying-card в анимации.
- [ ] Решить, что проще и чище: перевести flying-card в DOM или подтянуть canvas-клон под DOM-лицо.

### Task 3: Финальный browser-pass по экрану игры

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\2026-04-03-canvas-sharpness-pass.md`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\docs\specs\2026-04-02-game-screen-redesign.md`

- [ ] Пройти руками сценарии:
  - draw from stock
  - drag tableau stack
  - waste to foundation
  - tableau to foundation
  - auto-complete
- [ ] Снять свежие контрольные скрины `Маршрут` и `Игра`.
- [ ] Перевести `2026-04-03-canvas-sharpness-pass.md` в `Approved`, когда анимации будут добиты.

### Task 4: Финальный polish meta-экранов

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\RewardScene.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\rewardSceneOverlay.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\DiaryScene.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\scenes\detailSceneOverlay.ts`
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\src\styles.css`

- [ ] Пройти `Reward` после нового page-flow и убрать оставшиеся визуальные хвосты.
- [ ] Проверить `Архив > Записи` после серии правок шрифта, портретов и нового layout.
- [ ] Проверить `Detail`-страницы записи и артефакта на одинаковый вертикальный ритм.
- [ ] После этого сделать один финальный visual pass по всем meta-экранам.

### Task 5: Финальная стабилизация

**Files:**
- Modify: `C:\Users\RobotComp.ru\games\Yandex\01-solitaire-expedition\progress.md`

- [ ] Прогнать `npm.cmd test`.
- [ ] Прогнать `npm.cmd run build`.
- [ ] Обновить `progress.md` по факту завершённых шагов.
