import { ECONOMY } from "@/app/config/economy";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { YandexSdkService } from "@/services/sdk/YandexSdkService";

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
    private readonly sdk: YandexSdkService,
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
}
