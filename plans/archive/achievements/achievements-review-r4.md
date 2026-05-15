Источник GP API сверил: `gp.achievements.playerAchievementsList`, `fetch`, `setProgress`, `unlock` есть в официальной typed docs: https://gamepush.com/sdk/docs/classes/Achievements.html

[MAJOR] prior-concern-not-closed: `pendingDesired` всё ещё может потерять более новый progress.
1. Код читает `latestDesired` из Map, но затем вызывает `this.reconcile(state)` со старым closure-state и до `finally(() => pendingDesired.delete(tag))`. В сценарии `1900 → 2050` первый resolve ставит `lastProgress=1900`, `reconcile(state)` снова видит старые `1900`, а потом `finally` удаляет `pendingDesired=2000`.
2. Второй `setProgress(2000)` может не уйти до следующего внешнего события. Заявленный тест сейчас должен падать на показанной реализации.
3. Не пересчитывать через stale state. После успешного write, если `latestDesired > capped`, напрямую запустить следующий write на `latestDesired` через helper/loop, не удаляя pending до завершения drain. Либо хранить `getCurrentState()` и вызывать reconcile после удаления pending, но прямой drain проще и надежнее.

[MAJOR] new-concern-introduced: async bootstrap оставляет окно до seed persisted cache.
1. `bootstrap()` делает `await fetchAchievements()` до чтения `state.progress.achievementUnlocked` и `achievementProgress`, а BootScene запускает его как `void bootstrap(...)`.
2. Пока `fetch` висит, любой `reconcile()` работает с пустыми cache и может повторно отправить persisted one-shot unlock или progress, который должен был быть skipped.
3. Seed persisted `achievementUnlocked` и `achievementProgress` синхронно до `await fetchAchievements()`, затем merge SDK list после fetch. Добавить тест: delayed fetch + immediate reconcile не вызывает SDK для persisted `first_share` и persisted progress.

CONCERNS REMAIN