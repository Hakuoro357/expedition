# План на следующий рабочий день

После v0.3.58→v0.3.59 (2026-05-15). Сегодня закатили **достижения UI**:
20 ачивок в 6 группах, toast при анлоке, trophy в bottom-nav на карте.
Plan через codex+xiaomi review-loop (R1-R6, double consensus, 51 concerns
accepted).

## Что сделано сегодня

- ✅ AchievementsScene + overlay + view-model (pure VM, monotonic progress)
- ✅ AchievementsReconciler.onNewUnlock callback → toast (singleton stack,
  vertical stacking, slide-in/slide-out)
- ✅ Hidden masking: `locked-generic.png` + «???» title для скрытых ачивок
- ✅ Non-hidden locked: real icon @ opacity 0.5 + inline-SVG brass lock-badge
- ✅ Trophy переехал из top-right overlay в bottom-nav между «Маршрут дня»
  и «Меню» (4 hit-area равномерно через `cellWidth × (i + 0.5)`)
- ✅ Иконка trophy.svg перерисована (outline-стиль в тон остальным nav-иконкам)
- ✅ «Тот же расклад» — restart preserves seed (раньше для adventure-mode
  генерировал новый seed)
- ✅ **CRIT-fix safeImageUrl**: portrait-icons в Архиве/Reward/Detail были
  невидимы в production. Root cause — Vite резолвит `import.meta.glob` через
  `new URL(...).href` → абсолютный `http://origin/...`, а whitelist принимал
  только `https://`. Фикс: same-origin allowlist
- ✅ `safeAchievementIconUrl` — strict basename regex для icon URLs (защита
  от path-traversal)
- ✅ 21 PNG (20 ачивок + locked-generic) в `public/assets/achievements/`
  через palette compression — 796 KB вместо 2.3 MB
- ✅ Билды: `builds/{gamepush,yandex}/solitaire-expedition-v0.3.59.zip` (37.37 MB)
  и **v0.3.60** идентичный (на всякий слот в драфте)
- ✅ Reference в skill GP: `~/.claude/skills/gamepush-publishing/reference/achievements.md`
  — полный pipeline (GP admin GraphQL, MCP, Reconciler, view-model, toast,
  icon-strategy, safeImageUrl gotcha)
- ✅ Commit: `3341a51 feat(achievements): UI page + entry points + toast v0.3.59`
  → pushed `feature/gamepush-migration`

## Приоритет 1 — наблюдение v0.3.59

1. **Залить v0.3.59 в GP-sandbox.** Acceptance: trophy виден в bottom-nav
   между «Маршрут дня» и «Меню», клик открывает AchievementsScene с 6
   группами + 20 карточками, hidden ачивки в `locked-generic`-силуэте.
2. **Проверить toast на реальном анлоке.** Acceptance: завершить мини-игру
   (first_win), toast slide-in справа сверху на 4 секунды.
3. **Sandbox-проверка ачивок в GP-dashboard.** В админке GP должны
   обновиться счётчики анлоков. Если игрок анлокает в sandbox — должно
   появиться в analytics GP.
4. **Yandex-build behavior.** На Yandex `canUseAchievements()=false` →
   trophy в nav должен быть скрыт, остаётся 3 кнопки (Archive/Daily/Settings).
5. **Перепроверить портреты на Reward/Detail/Archive.** safeImageUrl-фикс
   был критическим — silent-bug в production. Подтвердить что иконки
   авторов реально рисуются.

## Приоритет 2 — потенциальные доработки

6. **Качественные переводы titles/descriptions для ачивок** — сейчас в
   `locales.ts` ru+en заполнены, tr/es/pt/de/fr через EN fallback.
   Триггер: если получим feedback от tr/es пользователей про «не на их языке».
7. **Achievement detail overlay** — клик по карточке ачивки в overlay'е
   сейчас no-op. План v0.3.60+ — детальная панель с rarity, group context,
   реальной датой анлока.
8. **Анимация unlock в overlay** — золотой shimmer на свежеоткрытой ачивке
   при следующем заходе в AchievementsScene.

## Приоритет 3 — техдолг

9. **GameScene decomposition** — parked в `docs/specs/2026-05-02-
   gamescene-decomposition.md`. Триггер: GameScene > 2000 строк ИЛИ
   следующая фича требует трогать ≥3 кластера. Сейчас ~1900 строк.
10. **Top-right trophy в routeSceneOverlay — мёртвый код**. После переезда
    в bottom-nav `showAchievementsButton: false` всегда. Можно убрать
    plumbing (`route-overlay__achievements` CSS + handler в MapScene
    rendererInteractive + `trophyIconHtml` import в routeSceneOverlay).
    Не горит, работает корректно как есть.

## НЕ делать

- Не добавлять новые ачивки до feedback по UI — все 20 уже залиты в GP.
- Не трогать `safeImageUrl` без regression-теста — пятница в production
  показала что любая правка whitelist'а может молча сломать ВСЕ портреты.
- Не пушить v0.3.59/60 в Yandex без re-валидации — на Yandex кнопка
  «Достижения» скрыта (canUseAchievements=false), но это новый код-path.

## Открытые вопросы

- **MCP GP интеграция** — `https://docs.gamepush.com/mcp/` (HTTP, не npm).
  Сегодня использовали прямой GraphQL для batch-операций (быстрее писать).
  MCP полезен для интерактивных запросов «покажи статус ачивок».
  Подключить через `claude mcp add gamepush <url>` когда понадобится.

## Артефакты

- `plans/achievements-ui-final.md` — финальный R6-плана (consensus codex+xiaomi)
- `plans/achievements-ui-decision-log-r6.md` — accept/reject по R6 concerns
- `plans/archive/achievements-ui/` — R1-R5 архив (draft + review + prompts)
- `builds/gamepush/solitaire-expedition-v0.3.59.zip` (37.37 MB)
- `builds/gamepush/solitaire-expedition-v0.3.60.zip` (37.37 MB, идентичен 0.3.59)
- `builds/yandex/solitaire-expedition-v0.3.59.zip` (37.37 MB)
- `builds/yandex/solitaire-expedition-v0.3.60.zip` (37.37 MB)
