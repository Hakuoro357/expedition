import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { getDailyDateKey } from "@/data/dailyDeals";
import { ROUTE_BOTTOM_NAV_HEIGHT } from "@/scenes/routeSceneLayout";
import { createSettingsSceneOverlayHtml } from "@/scenes/settingsSceneOverlay";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";

type SettingsNavTarget = "archive" | "daily" | "settings" | "home";
type ReturnTo = "game" | "map" | "archive" | "reward" | "title";

/**
 * Параметры входа в SettingsScene. Когда открыли из GameScene —
 * передаём `{ returnTo: "game", gameData: { mode, dealId } }`, чтобы
 * кнопка «Назад» вернула игрока в активную партию. Resume происходит
 * через штатный механизм GameScene: он читает `save.progress.currentGame`
 * и продолжает с того же хода.
 *
 * `returnTo: "reward"` — открыто из RewardScene. Передаём `rewardData`,
 * чтобы при возврате восстановить экран награды с теми же параметрами
 * (без повторного начисления/sfx, через `returnFromDetail: true`).
 *
 * `returnTo: "title"` — открыто из TitleScene (с v0.3.43). «← Назад»
 * возвращает на TitleScene. Раньше был режим "startmenu", в котором
 * SettingsScene и сама была entry point'ом — теперь это отдельный
 * TitleScene, и SettingsScene становится чистой страницей настроек.
 */
export type SettingsSceneData = {
  returnTo?: ReturnTo;
  gameData?: { mode: "adventure" | "daily" | "quick-play"; dealId: string };
  rewardData?: { mode: "adventure" | "daily" | "quick-play"; dealId: string; preview?: boolean };
};

export class SettingsScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private overlayCleanup?: () => void;
  private returnTo: ReturnTo = "map";
  private gameData?: SettingsSceneData["gameData"];
  private rewardData?: SettingsSceneData["rewardData"];

  constructor() {
    super(SCENES.settings);
  }

  create(data?: SettingsSceneData): void {
    this.returnTo = data?.returnTo ?? "map";
    this.gameData = data?.gameData;
    this.rewardData = data?.rewardData;

    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    const { sound } = getAppContext();
    sound.playBgm("map");
    this.renderBackground();
    this.renderOverlay();

    // Подписка на mute-изменения — иконка/кнопка звука в Settings
    // перерисуется если GP сменит mute после рендера (preloader-ad,
    // платформенная иконка и т.п.).
    const unsubscribeMute = sound.onMuteChange(() => this.renderOverlay());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeMute();
      this.overlayCleanup?.();
      this.overlay?.destroy();
      this.overlay = undefined;
    });
  }

  private renderBackground(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x162927);
    this.add
      .rectangle(GAME_WIDTH / 2, (GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT) / 2, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, 0x213733, 0.58);

    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, ROUTE_BOTTOM_NAV_HEIGHT);
    navBar.strokeLineShape(
      new Phaser.Geom.Line(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT),
    );
  }

  private renderOverlay(): void {
    const { i18n, save, sound, sdk, achievements } = getAppContext();
    const currentState = save.load();
    // Тумблер mute: источник истины — платформа (GP global mute). Если
    // SDK не в курсе (Yandex) — берём локальный SoundService state через
    // отсутствие sfx+music (>0). На GP вернёт isMuted() после тумблера.
    // Источник истины — SoundService (а не sdk.isMuted()). Избегает рассинхрона
    // иконки и реального gain'а bus'ов, если gp.sounds.isMuted мигнёт между
    // вызовами (preloader-ad и т.п.).
    const platformMuted = sound.isPlatformMuted();
    // 7 UI-локалей. Порядок: ru/en/tr сверху (исторические), затем es/pt/de/fr
    // (добавлены в v0.3.30). Галочка ставится через active-стиль + префикс "✓".
    const localeCodes = ["ru", "en", "tr", "es", "pt", "de", "fr"] as const;
    const currentLocale = i18n.getLocale();
    const localeOptions = localeCodes.map((code) => ({
      code,
      label: code.toUpperCase(),
      active: currentLocale === code,
    }));
    // Bottom nav зеркалит сцену-origin. С v0.3.43 startmenu больше не
    // существует (вынесен в TitleScene), и nav показывается всегда —
    // КРОМЕ first-run: если игрок зашёл в Settings из TitleScene и ещё
    // не прошёл пролог, nav прячется. Иначе можно тапнуть Daily или
    // Archive и обойти стартовый funnel (старая startmenu-логика
    // защищала тем же — codex поймал v0.3.43 регрессию).
    const isFirstRunFromTitle =
      this.returnTo === "title" && !currentState.progress.prologueShown;
    const html = createSettingsSceneOverlayHtml({
      title: i18n.t("settings"),
      languageLabel: i18n.t("language"),
      localeOptions,
      sfxLabel: i18n.t("sound"),
      musicLabel: i18n.t("music"),
      soundLabel: i18n.t("soundSection"),
      muteToggleLabel: platformMuted ? i18n.t("unmute") : i18n.t("mute"),
      muted: platformMuted,
      sfxVolume: sound.getSfxVolume(),
      musicVolume: sound.getMusicVolume(),
      // primaryActions удалены в v0.3.43: «Начать»/«Продолжить» теперь
      // живут только на TitleScene. Settings — чистая страница настроек.
      backLabel: i18n.t("back"),
      // Bottom nav зеркалит сцену-origin:
      //   Map → archive / daily / menu(active)
      //   Archive (DiaryScene) → home / daily / menu(active)
      //   TitleScene → archive / daily / menu(active) — стандартный
      //   набор, повторный клик по «Меню» вернёт на title через
      //   handleGoBack.
      //   First-run из TitleScene (пролог не пройден) → nav СКРЫТ,
      //   только «← Назад» + сами настройки. Гарантия что игрок не
      //   обойдёт пролог тапом по Daily/Archive до того, как игра
      //   объяснилась.
      // Когда открыли из Game — map-nav скрывается, показывается
      // game-style bar (см. gameNavLabels ниже).
      navItems: isFirstRunFromTitle
        ? undefined
        : this.returnTo === "archive"
          ? [
              { id: "home", label: i18n.t("backToMap"), active: false },
              { id: "daily", label: i18n.t("daily"), active: false },
              { id: "settings", label: i18n.t("menu"), active: true },
            ]
          : [
              { id: "archive", label: i18n.t("archive"), active: false },
              { id: "daily", label: i18n.t("daily"), active: false },
              { id: "settings", label: i18n.t("menu"), active: true },
            ],
      // Если открыли из Game — показываем game-style bottom bar вместо
      // обычного map-nav, чтобы игрок визуально оставался в контексте
      // партии. Undo/Hint будут disabled, «Меню» работает как «назад»,
      // Карта уводит на MapScene.
      gameNavLabels: this.returnTo === "game" ? {
        undo: i18n.t("undo"),
        hint: i18n.t("hint"),
        settings: i18n.t("menu"),
        home: i18n.t("home"),
      } : undefined,
      // Только версия — дата/время билда убраны, чтобы метка в меню
      // оставалась короткой. __APP_VERSION__ инъектится через vite.define.
      versionLabel: `v${__APP_VERSION__}`,
      // v0.3.56: GP Achievements кнопка. На Yandex undefined → секция
      // не рендерится. На GP видна всегда (canUseAchievements=true).
      achievementsLabel: sdk.canUseAchievements() ? i18n.t("achievements") : undefined,
    });

    if (!this.overlay) {
      this.overlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "settings-page-root",
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
    } else {
      this.overlay.setHtml(html);
    }

    const root = this.overlay.getInnerElement();
    this.overlayCleanup?.();
    const disposers: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>("[data-settings-action]").forEach((element) => {
      const action = element.dataset.settingsAction;
      if (!action) {
        return;
      }

      const onClick = (): void => {
        // Универсальный префикс locale-* для всех 7 локалей. Раньше
        // было 3 явных case'а; при добавлении es/pt/de/fr это стало
        // неудобно, унесено в общую ветку.
        if (action.startsWith("locale-")) {
          const nextLocale = action.slice("locale-".length) as ReturnType<typeof i18n.getLocale>;
          save.save({
            ...currentState,
            progress: { ...currentState.progress, locale: nextLocale },
          });
          i18n.setLocale(nextLocale);
          // GP docs: gp.changeLanguage() чтобы платформа запомнила выбор.
          sdk.changeLanguage(nextLocale);
          this.renderOverlay();
          return;
        }
        switch (action) {
          case "toggle-mute": {
            // GP docs: в игре должна быть кнопка звука, дёргающая gp.sounds.
            // SDK-вызов первичен → вызовет mute/unmute event → наш слушатель
            // (BootScene → SoundService.setPlatformMuted) применит его.
            // Для платформ без gp.sounds (Yandex) применяем локально, иначе
            // кнопка ничего бы не делала.
            const nextMuted = !sound.isPlatformMuted();
            if (nextMuted) {
              sdk.muteSounds();
            } else {
              sdk.unmuteSounds();
            }
            // Локальное применение на случай noop-платформ (Yandex) и как
            // мгновенный UI-ответ ещё до асинхронного event'а SDK.
            sound.setPlatformMuted(nextMuted);
            this.renderOverlay();
            return;
          }
          case "go-back":
            this.handleGoBack();
            return;
          case "nav-home-map":
            // Из game-style nav: кнопка «Карта» уводит в MapScene
            // (аналог «Home» в GameScene action-bar'е).
            this.scene.start(SCENES.map);
            return;
          case "open-achievements":
            // v0.3.56: открыть native overlay со списком ачивок.
            // GP пока не имеет публичного API — wrapper no-op (см.
            // GamePushSdkService.openAchievementsOverlay). Кнопка
            // остаётся в UI как точка входа, готовая к подключению
            // когда GP добавит метод.
            achievements.openOverlay();
            return;
          case "nav-undo-disabled":
          case "nav-hint-disabled":
            // Визуальные disabled-иконки — клик ничего не делает.
            return;
        }
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    root
      .querySelectorAll<HTMLInputElement>("input[data-settings-volume]")
      .forEach((element) => {
        const kind = element.dataset.settingsVolume as "sfx" | "music" | undefined;
        if (!kind) {
          return;
        }

        const valueEl = root.querySelector<HTMLElement>(
          `[data-settings-volume-value="${kind}"]`,
        );

        let lastDemoAt = 0;

        const updateFill = (percent: number): void => {
          element.style.setProperty("--slider-fill", `${percent}%`);
        };
        updateFill(Number(element.value));

        const onInput = (): void => {
          const raw = Number(element.value);
          const normalized = Math.max(0, Math.min(1, raw / 100));
          updateFill(raw);
          if (valueEl) {
            valueEl.textContent = `${Math.round(normalized * 100)}%`;
          }
          if (kind === "sfx") {
            sound.setSfxVolume(normalized);
          } else {
            sound.setMusicVolume(normalized);
            // Ensure map BGM is running so the user can hear their change.
            if (normalized > 0) {
              sound.playBgm("map");
            }
          }
        };

        const onChange = (): void => {
          const raw = Number(element.value);
          const normalized = Math.max(0, Math.min(1, raw / 100));
          const latest = save.load();
          if (kind === "sfx") {
            save.save({
              ...latest,
              progress: { ...latest.progress, sfxVolume: normalized },
            });
            // GP docs: уровень громкости игра держит сама, но бинарное
            // состояние «заглушено / не заглушено» для SFX должно
            // синхронизироваться с SDK при переходе ползунка через 0.
            sdk.setSfxMuted(normalized === 0);
            // Brief demo so the player hears the new level.
            const now = Date.now();
            if (now - lastDemoAt > 120 && normalized > 0) {
              sound.cardPlace();
              lastDemoAt = now;
            }
          } else {
            save.save({
              ...latest,
              progress: { ...latest.progress, musicVolume: normalized },
            });
            // То же самое для музыки — синхронизация бинарного флага
            // через gp.sounds.muteMusic()/unmuteMusic().
            sdk.setMusicMuted(normalized === 0);
          }
        };

        element.style.pointerEvents = "auto";
        element.addEventListener("input", onInput);
        element.addEventListener("change", onChange);
        disposers.push(() => {
          element.removeEventListener("input", onInput);
          element.removeEventListener("change", onChange);
        });
      });

    root.querySelectorAll<HTMLElement>("[data-app-nav]").forEach((element) => {
      const target = element.dataset.appNav as SettingsNavTarget | undefined;
      if (!target) {
        return;
      }

      const onClick = (): void => this.handleBottomNav(target);
      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    this.overlayCleanup = () => {
      disposers.forEach((dispose) => dispose());
    };
  }

  private handleBottomNav(target: SettingsNavTarget): void {
    const { save } = getAppContext();

    switch (target) {
      case "home":
        // Из archive-case: "home" ведёт на Map (как в DiaryScene.handleBottomNav).
        this.scene.start(SCENES.map);
        return;
      case "archive":
        // Из map-case: "archive" ведёт в DiaryScene (как в MapScene).
        this.scene.start(SCENES.diary);
        return;
      case "daily": {
        const progress = save.load().progress;
        const dailyKey = getDailyDateKey();
        if (progress.dailyClaimedOn === dailyKey) {
          return;
        }
        this.scene.start(SCENES.game, { mode: "daily", dealId: `daily-${dailyKey}` });
        return;
      }
      case "settings":
        // Повторный клик по активной «Меню» = возврат в origin-сцену,
        // симметрично поведению game-nav (там Меню=Back). Возврат
        // точно такой же, как у кнопки «← Назад».
        this.handleGoBack();
        return;
    }
  }

  /**
   * Возврат в исходную сцену (задана `returnTo` при входе). Срабатывает
   * из кнопки «← Назад», из primary-continue в origin-режимах, из
   * game-style nav и из повторного клика по активной «Меню» в map-nav.
   */
  private handleGoBack(): void {
    if (this.returnTo === "game" && this.gameData) {
      // resumeCurrentGame=true — критично: без этого флага GameScene
      // вызывает createInitialDeal и сбрасывает партию. Мы возвращаемся
      // В активную партию (игрок открыл меню и нажал «Продолжить» /
      // «Назад») — сейв уже содержит текущее состояние доски, нужно
      // именно восстановить его, а не начать заново.
      this.scene.start(SCENES.game, {
        mode: this.gameData.mode,
        dealId: this.gameData.dealId,
        resumeCurrentGame: true,
      });
      return;
    }
    if (this.returnTo === "reward" && this.rewardData) {
      // Возврат в экран наград — флаг returnFromDetail гарантирует, что
      // RewardScene не начислит награды повторно и не проиграет fanfare,
      // а просто восстановит reveal-items по данным узла.
      this.scene.start(SCENES.reward, {
        mode: this.rewardData.mode,
        dealId: this.rewardData.dealId,
        preview: this.rewardData.preview,
        returnFromDetail: true,
      });
      return;
    }
    if (this.returnTo === "archive") {
      this.scene.start(SCENES.diary);
      return;
    }
    if (this.returnTo === "title") {
      this.scene.start(SCENES.title);
      return;
    }
    this.scene.start(SCENES.map);
  }
}
