import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { AdsService } from "@/services/ads/AdsService";
import { I18nService } from "@/services/i18n/I18nService";
import { SaveService } from "@/services/save/SaveService";
import { SoundService } from "@/services/sound/SoundService";
import { AchievementsReconciler } from "@/services/achievements/AchievementsReconciler";
import type { SdkService } from "@/services/sdk/SdkService";
import type { PaymentsService } from "@/services/payments/PaymentsService";

export type AppContext = {
  analytics: AnalyticsService;
  ads: AdsService;
  i18n: I18nService;
  save: SaveService;
  sound: SoundService;
  sdk: SdkService;
  /**
   * GP Achievements reconciler. Сцены вызывают `achievements.reconcile(...)`
   * после значимых мутаций save.progress (completeNode, claimDaily, addCoins,
   * recordFacts). Reconciler сам решает, какие SDK calls нужны.
   */
  achievements: AchievementsReconciler;
  /**
   * Payments service. Optional until Phase 11 wires it in BootScene.
   * UI handlers that call this only fire after Phase 11 — safe to non-null assert.
   */
  payments?: PaymentsService;
};

let appContext: AppContext | null = null;

export function setAppContext(context: AppContext): void {
  appContext = context;
}

export function getAppContext(): AppContext {
  if (!appContext) {
    throw new Error("App context is not initialized");
  }

  return appContext;
}
