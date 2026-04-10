import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { AdsService } from "@/services/ads/AdsService";
import { I18nService } from "@/services/i18n/I18nService";
import { SaveService } from "@/services/save/SaveService";
import { SoundService } from "@/services/sound/SoundService";
import type { SdkService } from "@/services/sdk/SdkService";

export type AppContext = {
  analytics: AnalyticsService;
  ads: AdsService;
  i18n: I18nService;
  save: SaveService;
  sound: SoundService;
  sdk: SdkService;
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
