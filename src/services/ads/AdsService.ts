import { ECONOMY } from "@/app/config/economy";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import type { SdkService } from "@/services/sdk/SdkService";

// Кулдаун хранится в localStorage, чтобы перезагрузка страницы или релоад
// сцены не сбрасывали интервал между показами rewarded-роликов. Иначе игрок
// мог бы получать бонус заметно чаще, чем разрешено экономикой.
const REWARDED_COOLDOWN_KEY = "ads.lastRewardedAt";

function readLastRewardedAt(): number {
  try {
    const raw = window.localStorage.getItem(REWARDED_COOLDOWN_KEY);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeLastRewardedAt(ts: number): void {
  try {
    window.localStorage.setItem(REWARDED_COOLDOWN_KEY, String(ts));
  } catch {
    // ignore — кулдаун это best-effort защита
  }
}

export class AdsService {
  constructor(
    private readonly sdk: SdkService,
    private readonly analytics: AnalyticsService
  ) {}

  async showRewardedVideo(placement: string): Promise<boolean> {
    const now = Date.now();
    const lastRewardedAt = readLastRewardedAt();

    if (now - lastRewardedAt < ECONOMY.rewardedAdCooldownMs) {
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
      writeLastRewardedAt(Date.now());
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
}
