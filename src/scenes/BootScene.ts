import Phaser from "phaser";
import { getAppContext, setAppContext } from "@/app/config/appContext";
import { SAVE_KEY, SCENES } from "@/app/config/gameConfig";
import {
  CARD_FACE_ASSET_HEIGHT,
  CARD_FACE_ASSET_WIDTH,
  getAllCardFaceDefinitions,
} from "@/assets/cards/cardFaceSvg";
import { ARTIFACTS } from "@/data/artifacts";
import { CHAPTERS } from "@/data/chapters";
import { resolveArtifactGridUrl, resolveArtifactLargeUrl } from "@/data/artifactAssetUrls";
import { getDevScenePreview } from "@/scenes/devPreview";
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
    this.load.svg("card-back-compass", "assets/cards/back-compass.svg", { width: 48, height: 76 });
    this.load.svg("card-back-map",     "assets/cards/back-map.svg",     { width: 48, height: 76 });
    this.load.svg("card-back-default", "assets/cards/back-default.svg", { width: 48, height: 76 });
    getAllCardFaceDefinitions().forEach(({ key, uri }) => {
      this.load.svg(key, uri, { width: CARD_FACE_ASSET_WIDTH, height: CARD_FACE_ASSET_HEIGHT });
    });

    ARTIFACTS.forEach((artifact) => {
      const assetPath = resolveArtifactGridUrl(artifact.imageKey);
      if (assetPath) {
        this.load.image(artifact.imageKey, assetPath);
      }

      const largeAssetPath = resolveArtifactLargeUrl(artifact.largeImageKey);
      if (largeAssetPath) {
        this.load.image(artifact.largeImageKey, largeAssetPath);
      }

      const blurKey = `${artifact.imageKey}_blur`;
      const blurPath = resolveArtifactGridUrl(blurKey);
      if (blurPath) {
        this.load.image(blurKey, blurPath);
      }
    });
  }

  async create(): Promise<void> {
    const sdk = new YandexSdkService();
    await sdk.init();

    const analytics = new AnalyticsService();
    const i18n = new I18nService();
    const save = new SaveService();
    const sound = new SoundService();
    const ads = new AdsService(sdk, analytics);

    // Подтягиваем облачное сохранение до инициализации контекста,
    // чтобы остальные сервисы сразу видели актуальный прогресс.
    // Важно: проверяем наличие локального сейва ДО merge, иначе
    // вернувшийся облачный игрок будет принят за нового.
    const hasExistingSave = window.localStorage.getItem(SAVE_KEY) !== null;
    await save.loadFromCloud(sdk);

    setAppContext({ analytics, ads, i18n, save, sound, sdk });

    if (!hasExistingSave) {
      const detected = sdk.detectLocale();
      if (detected) {
        save.updateProgress((p) => ({ ...p, locale: detected }));
      }
    }

    const saveState = getAppContext().save.load();
    i18n.setLocale(saveState.progress.locale);
    analytics.track("session_start", { sdkAvailable: sdk.isAvailable() });

    // Сообщаем порталу Яндекса что игра готова — скрывает спиннер загрузки.
    sdk.signalReady();

    const preview =
      typeof window !== "undefined"
        ? getDevScenePreview(window.location.search, import.meta.env.DEV)
        : null;

    if (preview?.scene === "reward") {
      this.scene.start(SCENES.reward, preview);
      return;
    }

    if (preview?.scene === "reward-list") {
      this.scene.start(SCENES.devPreview, preview);
      return;
    }

    if (preview?.scene === "game-end") {
      this.scene.start(SCENES.game, { devPreviewScreen: preview.screen });
      return;
    }

    if (preview?.scene === "unlock-all") {
      const { save } = getAppContext();
      const allNodes = CHAPTERS.flatMap((ch) => ch.nodes);
      const allNodeIds = allNodes.map((n) => n.id);
      const allArtifactIds = allNodes.map((n) => n.artifactId).filter((id): id is string => id != null);
      save.updateProgress((p) => ({
        ...p,
        completedNodes: allNodeIds,
        unlockedNodes: allNodeIds,
        currentChapter: CHAPTERS.length,
        artifacts: allArtifactIds,
        coins: Math.max(p.coins, 500),
      }));
      console.log(`[dev] Unlocked all: ${allNodeIds.length} nodes, ${allArtifactIds.length} artifacts`);
      this.scene.start(SCENES.map);
      return;
    }

    if (preview?.scene === "unlock-playable") {
      const { save } = getAppContext();
      save.updateProgress((p) => ({
        ...p,
        completedNodes: [],
        coins: Math.max(p.coins, 500),
        devAllPlayable: true,
      }));
      console.log("[dev] All points playable: pages unlocked, no nodes completed");
      this.scene.start(SCENES.map);
      return;
    }

    // First-time launch: show prologue, then go straight to first deal
    if (!saveState.progress.prologueShown) {
      this.scene.start(SCENES.prologue);
      return;
    }

    this.scene.start(SCENES.map);
  }
}
