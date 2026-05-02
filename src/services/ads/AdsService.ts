import { ECONOMY } from "@/app/config/economy";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import type { SaveService } from "@/services/save/SaveService";
import type { SdkService } from "@/services/sdk/SdkService";

/**
 * AdsService оборачивает platform-SDK-вызовы рекламы с учётом кулдауна
 * rewarded и переходов gameplayStart/Stop.  Кулдаун хранится в SaveService
 * (`progress.lastRewardedAt`) — тестировщик GamePush требует, чтобы все
 * клиентские данные шли через gp.player, без отдельного localStorage.
 */
export class AdsService {
  constructor(
    private readonly sdk: SdkService,
    private readonly analytics: AnalyticsService,
    private readonly save: SaveService,
  ) {}

  async showRewardedVideo(placement: string): Promise<boolean> {
    const now = Date.now();
    const lastRewardedAt = this.save.load().progress.lastRewardedAt ?? 0;

    if (now - lastRewardedAt < ECONOMY.rewardedAdCooldownMs) {
      this.analytics.track("rewarded_offer_skipped", { placement, reason: "cooldown" });
      return false;
    }

    this.analytics.track("rewarded_offer_shown", { placement });
    // Pause active gameplay before ad and resume after — требование Яндекса
    // и GamePush для корректного аудита частоты показов.
    this.sdk.gameplayStop();
    let rewarded = false;
    try {
      rewarded = await this.sdk.showRewardedVideo();
    } finally {
      this.sdk.gameplayStart();
    }

    if (rewarded) {
      // Персистим cooldown через сейв. Flush вызывает caller после
      // начисления монет — одной записи в cloud достаточно на оба поля.
      this.save.updateProgress((p) => ({ ...p, lastRewardedAt: Date.now() }));
      this.analytics.track("rewarded_offer_complete", { placement });
    }

    return rewarded;
  }

  /** Show an interstitial (fullscreen) ad at a natural breakpoint. */
  async showInterstitial(placement: string): Promise<void> {
    this.analytics.track("interstitial_shown", { placement });
    this.sdk.gameplayStop();
    try {
      await this.sdk.showInterstitial();
    } finally {
      this.sdk.gameplayStart();
    }
  }

  /**
   * Sticky banner — постоянная рекламная полоса, требуемая GP. В отличие
   * от rewarded/interstitial НЕ ставит геймплей на паузу: баннер показан
   * параллельно с игрой, игрок продолжает кликать по картам.
   */
  showStickyBanner(placement: string): void {
    this.analytics.track("sticky_banner_shown", { placement });
    this.sdk.showSticky();
  }

  hideStickyBanner(): void {
    this.sdk.closeSticky();
  }

  /**
   * Обновить креатив sticky-баннера. Вызывать между партиями / на смене
   * сцены — GP ротирует объявление только по явному запросу.
   */
  refreshStickyBanner(): void {
    this.sdk.refreshSticky();
  }

  /**
   * Preloader ad — фуллскрин-объявление перед gameStart. Вызывается
   * в BootScene до `sdk.signalReady()`. Не трогает gameplayStart/Stop:
   * геймплей ещё не начался.
   */
  async showPreloader(): Promise<boolean> {
    this.analytics.track("preloader_offer_shown", {});
    let shown = false;
    try {
      shown = await this.sdk.showPreloader();
    } catch (error) {
      console.warn("[ads] showPreloader threw", error);
      shown = false;
    }
    if (shown) {
      this.analytics.track("preloader_offer_complete", {});
    }
    return shown;
  }
}
