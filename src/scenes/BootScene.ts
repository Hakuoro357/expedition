import Phaser from "phaser";
import { getAppContext, setAppContext } from "@/app/config/appContext";
import { SCENES } from "@/app/config/gameConfig";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { AdsService } from "@/services/ads/AdsService";
import { I18nService } from "@/services/i18n/I18nService";
import { SaveService } from "@/services/save/SaveService";
import { SoundService } from "@/services/sound/SoundService";
import { YandexSdkService } from "@/services/sdk/YandexSdkService";

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    this.load.svg("bg-chapter1", "assets/backgrounds/bg-chapter1.svg", { width: 390, height: 844 });
    this.load.svg("bg-chapter2", "assets/backgrounds/bg-chapter2.svg", { width: 390, height: 844 });
    this.load.svg("bg-chapter3", "assets/backgrounds/bg-chapter3.svg", { width: 390, height: 844 });
    this.load.svg("card-back-compass", "assets/cards/back-compass.svg", { width: 80, height: 112 });
    this.load.svg("card-back-map",     "assets/cards/back-map.svg",     { width: 80, height: 112 });
    this.load.svg("card-back-default", "assets/cards/back-default.svg", { width: 80, height: 112 });
  }

  async create(): Promise<void> {
    const sdk = new YandexSdkService();
    await sdk.init();

    // Подтягиваем облачное сохранение до инициализации контекста,
    // чтобы остальные сервисы сразу видели актуальный прогресс.
    const tempSave = new SaveService();
    await tempSave.loadFromCloud(sdk);

    const analytics = new AnalyticsService();
    const i18n = new I18nService();
    const save = new SaveService();
    const sound = new SoundService();
    const ads = new AdsService(sdk, analytics);

    setAppContext({ analytics, ads, i18n, save, sound, sdk });

    const saveState = getAppContext().save.load();
    i18n.setLocale(saveState.progress.locale);
    analytics.track("session_start", { sdkAvailable: sdk.isAvailable() });

    if (saveState.currentGame) {
      analytics.track("resume_saved_game", {
        dealId: saveState.currentGame.dealId,
        mode: saveState.currentGame.mode
      });
      this.scene.start(SCENES.game, { resumeCurrentGame: true });
      return;
    }

    this.scene.start(SCENES.map);
  }
}
