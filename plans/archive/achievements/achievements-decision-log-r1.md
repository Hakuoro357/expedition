# Decision log — round 1

Reviewer: codex (gpt-5.5). Verdict: CONCERNS REMAIN.
Concerns: 1 CRITICAL + 11 MAJOR + 5 MINOR + Alternative approach.

## Все принято

R1-R3 default-accept. Все concerns codex'а технически точные — он
заметил несколько реальных багов в моём плане (неправильные
speakerEntityId, отсутствующая update-логика для streakCount,
hintCount теряется при undo, fire-and-forget кэширование которое
блокирует retry, и т.д.).

## Архитектурное решение: принять Alternative

Codex предложил **AchievementsReconciler** pattern — вместо
рассыпанных триггеров в SaveService/scenes использовать единый
reconciler, который читает SaveState + LastWinContext и вычисляет
desired state ачивок из фактов. Это решает одним махом:
- Backfill для существующих игроков
- Cap'ы перед setProgress
- Quota math (всё в одном месте)
- Dashboard drift (один список метаданных)
- SaveService остаётся чистым, без AppContext-связки

Принимаю Alternative как основу. R2 plan переписан вокруг неё.

## Concerns по группам

### Architecture (CRITICAL + 3 MAJOR)

| # | Concern | Решение |
|---|---|---|
| C1 | Progress не cap'ится перед setProgress | Метаданные `{tag, max}` + `Math.min(value, max)` + skip если has() |
| M1 | Cache до SDK success → блокирует retry | Промисы с commit-on-success + pending-set для дедупа in-flight |
| M2 | Нет backfill для existing players | `reconcile(SaveState, LastWinContext?)` зовётся после save.init() |
| M11 | SaveService coupling с AppContext | SaveService остаётся чистым; reconciler вызывается из scenes |

→ Все четыре закрываются Reconciler-паттерном.

### Data correctness (3 MAJOR)

| # | Concern | Решение |
|---|---|---|
| M3 | speakerEntityId values неправильные | leader/cartographer/archaeologist/quartermaster_guide/photographer_archivist (verified by grep) |
| M4 | streakCount не инкрементируется в коде | Добавить login-streak update — отдельная gameplay-фича, выносим за рамки. **Ачивки daily_streak_7 / daily_streak_30 откладываем** до её имплементации. |
| M5 | RewardScene не имеет доступа к undoCount/hintCount после clearCurrentGame | GameScene передаёт `lastWinContext: { undoCount, hintCount, dealId, mode }` в `RewardSceneData` ДО clearCurrentGame |

### Engine/save (3 MAJOR)

| # | Concern | Решение |
|---|---|---|
| M6 | hintCount теряется при undo | hintCount монотонный: undo НЕ восстанавливает старое значение. Реализация: при undo restore'ить весь GameState кроме hintCount/undoCount, либо хранить hintCount отдельно от GameState (sceneState) |
| M7 | hintCount не персистится после inc | После inc — `save.updateCurrentGame(this.gameState)` |
| M8 | sanitizeGameState нужен явный | Добавить функцию для нормализации legacy currentGame (`hintCount ?? 0`) |

### Triggers (2 MAJOR)

| # | Concern | Решение |
|---|---|---|
| M9 | Нет centralized preview/replay guard | Reconciler принимает `LastWinContext` только когда сцена явно её передаёт; reveal-only path (returnFromDetail) не вызывает reconcile с win-event'ом |
| M10 | first_entry в DetailScene слишком ранний | Reconciler смотрит на progress.completedNodes — DetailScene-open триггерит reconcile, но first_entry разблокируется только если node действительно completed |

### Operations (1 MAJOR)

| # | Concern | Решение |
|---|---|---|
| M12 | Dashboard registration order risky | (a) Зарегистрировать ачивки В ДАШБОРДЕ ДО первого деплоя кода; (b) cache-on-success паттерн (M1) сам по себе предотвращает «навсегда suppress'нул retry»  |

### Polish (5 MINOR)

| # | Concern | Решение |
|---|---|---|
| m1 | onAchievementUnlock не используется | Удаляю из интерфейса |
| m2 | Test fixtures для GameState ломаются после hintCount required | Делаю hintCount optional + добавляю factory `createTestGameState()` |
| m3 | first_artifact нет backfill | Reconciler учитывает: `progress.artifacts.length > 0` |
| m4 | Epilogue trigger ambiguous | Только on completing c3n10 |
| m5 | Coin semantics: balance vs cumulative | Уточняю в display name: "достигнуто N монет" (balance milestone). Skip-on-decrease уже работает корректно. |
| m6 | Не хватает first_community_join | Добавляю — итого 22 ачивки |

## Изменения в objem'е

- 21 → 22 ачивки (добавил `first_community_join`)
- daily_streak_7 / daily_streak_30 — **отложены** в backlog до имплементации login-streak update logic. Без них: 22 - 2 = **20 ачивок** в первой итерации.

Можно либо сделать streak-update в этом же плане (расширение scope), либо оставить 20 и вернуться к streak-ам отдельно. Считаю — пусть будет 20 в r2, streak-ачивки добавим следующим планом когда продумаем механику login-streak.
