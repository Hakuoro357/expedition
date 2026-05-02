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
import type { Locale } from "@/services/i18n/locales";

function setLoadingProgress(pct: number): void {
  const bar = document.getElementById("loading-bar");
  if (bar) bar.style.width = `${Math.min(100, Math.round(pct))}%`;
}

/**
 * Парсит `?lang=X` из URL. Возвращает валидную Locale или null.
 * Используется как highest-priority источник локали на старте —
 * позволяет direct-link на `/?lang=de` открывать игру сразу на
 * немецком, минуя SDK/navigator.
 */
function parseUrlLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = new URLSearchParams(window.location.search).get("lang");
    if (!raw) return null;
    const lang = raw.slice(0, 2).toLowerCase();
    const valid: Locale[] = ["ru", "en", "tr", "es", "pt", "de", "fr"];
    return (valid as string[]).includes(lang) ? (lang as Locale) : null;
  } catch {
    return null;
  }
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
    const ads = new AdsService(sdk, analytics, save);

    // Phase: 85–92% (cloud save init — SaveService теперь держит снимок gp.player).
    await save.init(sdk);
    setLoadingProgress(92);

    setAppContext({ analytics, ads, i18n, save, sound, sdk });

    // Авто-определение языка. Приоритет:
    //   1. ?lang=X в URL — если явно указана валидная локаль, уважаем
    //      выбор пользователя/внешней интеграции (например direct-link
    //      на определённую локаль). Это же используется для reload
    //      после смены языка в GP-оболочке.
    //   2. SDK.detectLocale() — gp.language / yandex i18n / navigator.
    //   3. saveState.progress.locale — последний выбор игрока.
    // На старте НИЧЕГО не пишем в save (требование GP-валидатора:
    // «Не нужно делать Sync на старте»). Язык применяем прямо в i18n;
    // save.progress.locale обновится только при явной смене в Settings.
    const urlLocale = parseUrlLocale();
    const detectedLocale = sdk.detectLocale();
    const saveState = getAppContext().save.load();
    i18n.setLocale(urlLocale ?? detectedLocale ?? saveState.progress.locale);
    sound.setSfxVolume(saveState.progress.sfxVolume ?? 0.8);
    sound.setMusicVolume(saveState.progress.musicVolume ?? 0.6);
    void sound.loadAll();
    // GamePush self-test требует контроль звука через SDK-события.
    sdk.onPause(() => {
      sound.suspendAudio();
      // При паузе (показ ad, сворачивание таба) принудительно сливаем
      // debounced cloud-sync — иначе незаписанные ходы пропадут.
      void save.flush();
    });
    sdk.onResume(() => sound.resumeAudio());
    // Глобальный safety net: pagehide / visibilitychange:hidden срабатывают
    // при закрытии вкладки или сворачивании браузера. Без этого мы теряли
    // currentGame (он копится в памяти и не дёргает scheduleSync — экономия
    // квоты gp.player.sync, см. SaveService комментарий). flush() идемпотентный,
    // лишних вызовов не делает (lastSyncedJson сравнивается перед sync).
    if (typeof window !== "undefined") {
      const flushOnHide = (): void => {
        void save.flush();
      };
      window.addEventListener("pagehide", flushOnHide);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushOnHide();
      });
    }
    // Глобальный mute платформы (иконка звука в оболочке GP).
    sound.setPlatformMuted(sdk.isMuted());
    sdk.onMuteChange((muted) => sound.setPlatformMuted(muted));
    // Смена языка из оболочки платформы (GP shell «change language»).
    // Внутри-игровая смена из Settings тоже дёргает sdk.changeLanguage()
    // и GP эхо-событием прилетает сюда — чтобы не словить бесконечный
    // reload-loop, skip'аем reload если lang уже совпадает с тем, что
    // уже записано в save (значит, это наше же эхо).
    sdk.onLanguageChange(async (lang) => {
      const shortLang = lang.slice(0, 2).toLowerCase();
      const validLocales: Locale[] = ["ru", "en", "tr", "es", "pt", "de", "fr"];
      const newLocale: Locale = (validLocales as string[]).includes(shortLang)
        ? (shortLang as Locale)
        : "en";
      const current = save.load().progress.locale;
      if (current === newLocale) {
        // Эхо от нашей же Settings-смены — локаль уже применена,
        // reload не нужен.
        return;
      }
      save.updateProgress((p) => ({ ...p, locale: newLocale }));
      // Без явного flush мы потеряем запись локали: debounce 5 сек,
      // а reload произойдёт мгновенно. Дожидаемся sync до перезагрузки.
      await save.flush();
      // Добавляем ?lang= в URL чтобы загрузочный экран при reload показал
      // правильный язык мгновенно.
      const url = new URL(window.location.href);
      url.searchParams.set("lang", newLocale);
      window.location.href = url.toString();
    });
    analytics.track("session_start", { sdkAvailable: sdk.isAvailable() });

    // Phase: 100% — assets и SDK init завершены.
    setLoadingProgress(100);

    // Preloader-реклама — часть фазы загрузки с точки зрения платформы.
    // Пока крутится фуллскрин-ad, игра НЕ реагирует на нажатия, поэтому
    // gameStart() в этот момент вызывать нельзя (валидатор GP явно требует:
    // "GameStart вызывается, когда пользователь может приступать к игре —
    // когда игра реагирует на нажатия игрока"). showPreloader защищён
    // 8-сек таймаутом внутри SDK-сервиса, try/catch подстраховывает
    // синхронные исключения.
    try {
      await ads.showPreloader();
    } catch (error) {
      console.warn("[boot] preloader ad failed", error);
    }

    // Preloader закрыт → игра готова к взаимодействию. Снимаем HTML-лоадер
    // и вызываем gameStart здесь (не в MapScene, т.к. BootScene может
    // уходить в prologue / dev-preview / другие сцены, где иначе сигнал
    // никогда бы не пришёл — именно это ломало валидатор в v0.3.8).
    // signalReady() в GP-сервисе идемпотентен, так что лишних вызовов нет.
    document.getElementById("loading-screen")?.remove();
    sdk.signalReady();

    // Sticky-баннер — постоянный нижний баннер, включается после gameStart.
    ads.showStickyBanner("boot");

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

    // Всегда открываем стартовое меню (SettingsScene в режиме "startmenu").
    // Там игрок выбирает «Новая игра» (идёт в Prologue) или «Продолжить»
    // (возобновляет активную партию / идёт на карту). Первый запуск:
    // «Продолжить» задизейблена, активна только «Новая игра». Требование
    // тестировщиков ВК/ОК — полноценное стартовое меню как точка входа.
    this.scene.start(SCENES.settings, { returnTo: "startmenu" });
  }
}
