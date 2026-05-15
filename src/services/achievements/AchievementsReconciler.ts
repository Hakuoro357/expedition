import { ACHIEVEMENTS, type ReconcileState } from "@/data/achievements";
import type { SdkService } from "@/services/sdk/SdkService";

/**
 * Reconciler-pattern для GP Achievements (R1 alt architecture).
 *
 * Идея: одна точка истины. Caller считает любое количество мутаций
 * progress / lastWin / achievementFacts и вызывает `reconcile(state)`.
 * Reconciler сам решает, какие SDK-вызовы нужны, дедуплицирует in-flight,
 * cap'ит progress, кэширует unlocked-ачивки.
 *
 * Подробнее об архитектурных решениях см. plan/achievements-final.md.
 * Ключевые fixes:
 * - R3 fix M2: gp.achievements.* (НЕ socials).
 * - R3 fix M3: persisted achievementUnlocked + fetch перед чтением list.
 * - R3 fix M4: Promise<boolean>="write accepted", unlock determine локально.
 * - R4 fix M1: writeProgress helper — drain до latest БЕЗ recursive reconcile.
 * - R4 fix M2: bootstrap seed persisted СИНХРОННО ДО await fetch.
 * - R5 fix M1: SDK-merge persists locally (cross-device/dashboard unlock).
 * - R6 fix M1: SDK merge нормализует progress vs metadata (clamp + effectivelyUnlocked).
 */
export class AchievementsReconciler {
  /** Локальный кэш unlocked ачивок (committed-on-success). */
  private unlockedCache = new Set<string>();
  /** Последний успешно отправленный progress per tag. */
  private lastProgress = new Map<string, number>();
  /** Pending desired progress per tag (R2 fix M3 + R3 fix M1 + R4 fix M1). */
  private pendingDesired = new Map<string, number>();
  /** Pending one-shot unlocks — для дедупа in-flight. */
  private pendingUnlocks = new Set<string>();

  constructor(
    private readonly sdk: SdkService,
    /** Persist (tag, progress) → save.progress.achievementProgress[tag]. */
    private readonly persistProgress: (tag: string, progress: number) => void,
    /** Persist (tag) → save.progress.achievementUnlocked[tag] = true (R3 fix M3). */
    private readonly persistUnlocked: (tag: string) => void,
    /**
     * v0.3.58: optional callback fired once per new unlock from write-pipeline
     * (NOT from bootstrap-merge of existing unlocks). Used to surface toasts.
     */
    private readonly onNewUnlock?: (tag: string) => void,
  ) {}

  /**
   * Вызывается ОДИН раз после save.init() в BootScene.
   * R4 fix M2: persisted seed синхронно ДО `await fetchAchievements`, чтобы
   * параллельный `reconcile()` (например, ad-bonus coin-grant) не зацепил
   * пустой cache → quota burn для already-unlocked one-shot.
   */
  async bootstrap(state: ReconcileState): Promise<void> {
    if (!this.sdk.canUseAchievements()) return;

    // R4 fix M2: seed persisted СИНХРОННО ДО await.
    const persistedUnlocked = state.progress.achievementUnlocked ?? {};
    for (const tag of Object.keys(persistedUnlocked)) {
      this.unlockedCache.add(tag);
    }
    const persistedProgress = state.progress.achievementProgress ?? {};
    for (const [tag, value] of Object.entries(persistedProgress)) {
      if (!this.unlockedCache.has(tag)) {
        this.lastProgress.set(tag, value);
      }
    }

    // R3 fix M3: гарантируем актуальность playerAchievementsList.
    await this.sdk.fetchAchievements();

    // R5 fix M1 + R6 fix M1: merge SDK list ПОСЛЕ await — может расширить
    // cache (cloud-sync / GP dashboard manual unlock). Нормализуем по
    // metadata: clamp progress по max, effectivelyUnlocked = unlocked ||
    // (max && clamped >= max). Без этого `progress=500, unlocked=false`
    // при max=500 даёт durable suppressor: lastProgress=500, никогда не
    // unlock'нется локально. Persist'им SDK-truth в save, чтобы следующая
    // сессия с пустым SDK list не повторяла unlock.
    const metaByTag = new Map(ACHIEVEMENTS.map((m) => [m.tag, m]));
    const list = this.sdk.getPlayerAchievements();
    for (const { tag, progress, unlocked } of list) {
      const meta = metaByTag.get(tag);
      // Orphan SDK tags (нет в нашем списке) — игнорируем.
      if (!meta) continue;

      const clamped = meta.max !== undefined ? Math.min(progress, meta.max) : progress;
      const effectivelyUnlocked =
        unlocked || (meta.max !== undefined && clamped >= meta.max);

      if (effectivelyUnlocked) {
        if (!this.unlockedCache.has(tag)) {
          this.unlockedCache.add(tag);
        }
        if (!persistedUnlocked[tag]) {
          this.persistUnlocked(tag); // R5 fix M1
        }
      } else if (clamped > (this.lastProgress.get(tag) ?? 0)) {
        this.lastProgress.set(tag, clamped);
        this.persistProgress(tag, clamped); // R5 fix M1
      }
    }

    // Backfill — первый reconcile для existing players.
    this.reconcile(state);
  }

  /**
   * Основной метод — caller вызывает после любой значимой мутации.
   * Идемпотентен: повторный вызов без новых данных не делает SDK-калов.
   */
  reconcile(state: ReconcileState): void {
    if (!this.sdk.canUseAchievements()) return;

    for (const meta of ACHIEVEMENTS) {
      if (this.unlockedCache.has(meta.tag)) continue;
      const desired = meta.compute(state);

      if (meta.max !== undefined) {
        const num = typeof desired === "number" ? desired : 0;
        const capped = Math.min(num, meta.max);
        const last = this.lastProgress.get(meta.tag) ?? 0;
        if (capped <= last) continue;

        // Если уже in-flight — накапливаем latest desired в Map (R2 fix M3).
        if (this.pendingDesired.has(meta.tag)) {
          const prev = this.pendingDesired.get(meta.tag)!;
          if (capped > prev) this.pendingDesired.set(meta.tag, capped);
          continue;
        }

        this.writeProgress(meta.tag, capped, meta.max);
      } else {
        if (this.pendingUnlocks.has(meta.tag)) continue;
        const should = typeof desired === "boolean" ? desired : desired > 0;
        if (!should) continue;
        this.writeUnlock(meta.tag);
      }
    }
  }

  /**
   * R4 fix M1: drain pendingDesired до latest напрямую через рекурсию,
   * НЕ через reconcile(state). Удаляем pending ДО рекурсивного вызова —
   * иначе recursive writeProgress попадёт в early-return из reconcile.
   */
  private writeProgress(tag: string, capped: number, max: number): void {
    this.pendingDesired.set(tag, capped);
    void this.sdk
      .setAchievementProgress(tag, capped)
      .then((ok) => {
        // R3 fix M1: читаем latest из Map ДО delete.
        const latestDesired = this.pendingDesired.get(tag) ?? capped;
        // R3 fix M4: ok=true = write принят (НЕ unlocked).
        if (ok) {
          this.lastProgress.set(tag, capped);
          this.persistProgress(tag, capped);
          if (capped >= max) {
            const wasNew = !this.unlockedCache.has(tag);
            this.unlockedCache.add(tag);
            this.persistUnlocked(tag); // R3 fix M3
            if (wasNew) this.onNewUnlock?.(tag); // v0.3.58 toast
          }
        }
        // R4 fix M1: delete ДО рекурсии — next writeProgress должен пройти.
        this.pendingDesired.delete(tag);
        // Drain к latest если ok + есть рост + ещё не unlocked.
        if (ok && latestDesired > capped && capped < max) {
          this.writeProgress(tag, Math.min(latestDesired, max), max);
        }
      })
      .catch((err) => {
        // R3 fix M-MINOR1: defense-in-depth от unexpected reject.
        // GamePushSdkService уже catch'ит и возвращает false, но если
        // wrapper сам throw'нул — чистим pending, чтобы retry прошёл.
        this.pendingDesired.delete(tag);
        console.warn("[ach] setProgress threw", tag, err);
      });
  }

  private writeUnlock(tag: string): void {
    this.pendingUnlocks.add(tag);
    void this.sdk
      .unlockAchievement(tag)
      .then((ok) => {
        if (ok) {
          const wasNew = !this.unlockedCache.has(tag);
          this.unlockedCache.add(tag);
          this.persistUnlocked(tag); // R3 fix M3
          if (wasNew) this.onNewUnlock?.(tag); // v0.3.58 toast
        }
        this.pendingUnlocks.delete(tag);
      })
      .catch((err) => {
        // R3 fix M-MINOR1.
        this.pendingUnlocks.delete(tag);
        console.warn("[ach] unlock threw", tag, err);
      });
  }

  openOverlay(): void {
    if (!this.sdk.canUseAchievements()) return;
    void this.sdk.openAchievementsOverlay();
  }
}
