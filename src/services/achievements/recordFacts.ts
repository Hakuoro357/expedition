import { getAppContext } from "@/app/config/appContext";

/**
 * Durable-facts API для one-shot ачивок (R2 fix M2).
 *
 * Записывает факт в `save.progress.achievementFacts` — переживает
 * SDK transient-failures: если `gp.achievements.unlock()` вернёт false,
 * факт уже в save, и на следующем bootstrap/reconcile попытка повторится.
 *
 * Caller обычно сразу после записи зовёт `getAppContext().achievements.reconcile(...)`,
 * чтобы Reconciler увидел новый факт и отправил unlock без задержки.
 *
 * AppContext должен быть готов — функции вызываются только из BootScene
 * (после setAppContext) и RewardScene.
 */

export function recordSharedEver(): void {
  const { save } = getAppContext();
  save.updateProgress((p) => ({
    ...p,
    achievementFacts: { ...(p.achievementFacts ?? {}), sharedEver: true },
  }));
}

export function recordCommunityJoinedEver(): void {
  const { save } = getAppContext();
  save.updateProgress((p) => ({
    ...p,
    achievementFacts: { ...(p.achievementFacts ?? {}), communityJoinedEver: true },
  }));
}

export function recordNoUndoWinEver(): void {
  const { save } = getAppContext();
  save.updateProgress((p) => ({
    ...p,
    achievementFacts: { ...(p.achievementFacts ?? {}), noUndoWinEver: true },
  }));
}

export function recordNoHintWinEver(): void {
  const { save } = getAppContext();
  save.updateProgress((p) => ({
    ...p,
    achievementFacts: { ...(p.achievementFacts ?? {}), noHintWinEver: true },
  }));
}
