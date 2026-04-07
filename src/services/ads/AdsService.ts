import { ECONOMY } from "@/app/config/economy";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { YandexSdkService } from "@/services/sdk/YandexSdkService";

export class AdsService {
  private lastRewardedAt = 0;

  constructor(
    private readonly sdk: YandexSdkService,
    private readonly analytics: AnalyticsService
  ) {}

  async showRewardedVideo(placement: string): Promise<boolean> {
    const now = Date.now();

    if (now - this.lastRewardedAt < ECONOMY.rewardedAdCooldownMs) {
      this.analytics.track("rewarded_offer_skipped", { placement, reason: "cooldown" });
      return false;
    }

    this.analytics.track("rewarded_offer_shown", { placement });
    // Яндекс ожидает паузу геймплея перед показом рекламы и
    // возобновление после — иначе нарушается аудит частоты ad-показов.
    this.sdk.gameplayStop();
    let rewarded = false;
    try {
      rewarded = await this.sdk.showRewardedVideo();
    } finally {
      this.sdk.gameplayStart();
    }

    if (rewarded) {
      this.lastRewardedAt = Date.now();
      this.analytics.track("rewarded_offer_complete", { placement });
    }

    return rewarded;
  }
}
