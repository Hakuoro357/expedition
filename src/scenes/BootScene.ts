import Phaser from "phaser";
import { getAppContext, setAppContext } from "@/app/config/appContext";
import { SCENES } from "@/app/config/gameConfig";
import { ARTIFACTS } from "@/data/artifacts";
import { CHAPTERS } from "@/data/chapters";
import { resolveArtifactGridUrl, resolveArtifactLargeUrl } from "@/data/artifactAssetUrls";
import { getDevScenePreview } from "@/scenes/devPreview";
import { AnalyticsService } from "@/services/analytics/AnalyticsService";
import { AdsService } from "@/services/ads/AdsService";
import { I18nService } from "@/services/i18n/I18nService";
import { SaveService } from "@/services/save/SaveService";
import { SoundService } from "@/services/sound/SoundService";
import { GamePushSdkService } from "@/services/sdk/GamePushSdkService";

function setLoadingProgress(pct: number): void {
  const bar = document.getElementById("loading-bar");
  if (bar) bar.style.width = `${Math.min(100, Math.round(pct))}%`;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    // Multi-phase progress: 10–75% for Phaser assets
    this.load.on("progress", (value: number) => {
      setLoadingProgress(10 + value * 65);
    });
    this.load.on("loaderror", (file: { key: string }) => {
      console.warn(`[boot] failed to load asset: ${file.key}`);
    });

    this.load.svg("bg-chapter1", "assets/backgrounds/bg-chapter1.svg", { width: 390, height: 844 });
    this.load.svg("bg-chapter2", "assets/backgrounds/bg-chapter2.svg", { width: 390, height: 844 });
    this.load.svg("bg-chapter3", "assets/backgrounds/bg-chapter3.svg", { width: 390, height: 844 });
    this.load.svg("card-back-compass", "assets/cards/back-compass.svg", { width: 48, height: 76 });
    this.load.svg("card-back-map",     "assets/cards/back-map.svg",     { width: 48, height: 76 });
    this.load.svg("card-back-default", "assets/cards/back-default.svg", { width: 48, height: 76 });
    // Card faces are rendered as inline SVG via the DOM overlay
    // (gameSceneOverlay.ts), so no Phaser texture preload is needed.

    ARTIFACTS.forEach((artifact) => {
      const assetPath = resolveArtifactGridUrl(artifact.imageKey);
      if (assetPath && assetPath.length > 0) {
        this.load.image(artifact.imageKey, assetPath);
      }

      const largeAssetPath = resolveArtifactLargeUrl(artifact.largeImageKey);
      if (largeAssetPath && largeAssetPath.length > 0) {
        this.load.image(artifact.largeImageKey, largeAssetPath);
      }

      const blurKey = `${artifact.imageKey}_blur`;
      const blurPath = resolveArtifactGridUrl(blurKey);
      if (blurPath && blurPath.length > 0) {
        this.load.image(blurKey, blurPath);
      }
    });
  }

  async create(): Promise<void> {
    // Phase: 75–85% (SDK init)
    setLoadingProgress(75);
    const sdk = new GamePushSdkService();
    await sdk.init();
    setLoadingProgress(85);

    const analytics = new AnalyticsService();
    const i18n = new I18nService();
    const save = new SaveService();
    const sound = new SoundService();
    const ads = new AdsService(sdk, analytics);

    // Phase: 85–92% (cloud save)
    await save.loadFromCloud(sdk);
    setLoadingProgress(92);

    setAppContext({ analytics, ads, i18n, save, sound, sdk });

    // Авто-определение языка через SDK.
    const detectedLocale = sdk.detectLocale();
    if (detectedLocale) {
      save.updateProgress((p) => ({ ...p, locale: detectedLocale }));
    }

    const saveState = getAppContext().save.load();
    i18n.setLocale(saveState.progress.locale);
    sound.setSfxVolume(saveState.progress.sfxVolume ?? 0.8);
    sound.setMusicVolume(saveState.progress.musicVolume ?? 0.6);
    void sound.loadAll();
    // GamePush self-test требует контроль звука через SDK-события.
    sdk.onPause(() => sound.suspendAudio());
    sdk.onResume(() => sound.resumeAudio());
    // GP sandbox: при переключении языка перезагружаем всю игру с новой локалью.
    sdk.onLanguageChange((lang) => {
      const newLocale = lang === "ru" ? "ru" : lang === "tr" ? "tr" : "en";
      save.updateProgress((p) => ({ ...p, locale: newLocale }));
      i18n.setLocale(newLocale);
      window.location.reload();
    });
    analytics.track("session_start", { sdkAvailable: sdk.isAvailable() });

    // Phase: 100% — ready
    setLoadingProgress(100);
    sdk.signalReady();
    document.getElementById("loading-screen")?.remove();

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
