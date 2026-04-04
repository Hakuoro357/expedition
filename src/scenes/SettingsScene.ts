import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { createInitialProgressState } from "@/core/game-state/progress";
import { getDailyDateKey } from "@/data/dailyDeals";
import { ROUTE_BOTTOM_NAV_HEIGHT } from "@/scenes/routeSceneLayout";
import { createSettingsSceneOverlayHtml } from "@/scenes/settingsSceneOverlay";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";

type SettingsNavTarget = "home" | "daily" | "settings";

export class SettingsScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private overlayCleanup?: () => void;

  constructor() {
    super(SCENES.settings);
  }

  create(): void {
    this.renderBackground();
    this.renderOverlay();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
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
    const { i18n, save, sound } = getAppContext();
    const currentState = save.load();
    const soundToggleLabel = sound.isEnabled()
      ? `${i18n.t("sound")}: ON`
      : `${i18n.t("sound")}: OFF`;
    const html = createSettingsSceneOverlayHtml({
      title: i18n.t("settings"),
      languageLabel: i18n.t("language"),
      soundLabel: i18n.t("sound"),
      resetLabel: i18n.t("saveReset"),
      ruLabel: i18n.getLocale() === "ru" ? "✓ RU" : "RU",
      enLabel: i18n.getLocale() === "en" ? "✓ EN" : "EN",
      soundToggleLabel,
      navItems: [
        { id: "home", label: i18n.t("home"), active: false },
        { id: "daily", label: i18n.t("daily"), active: false },
        { id: "settings", label: i18n.t("settings"), active: true },
      ],
    });

    if (!this.overlay) {
      this.overlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "settings-page-root",
        logicalWidth: GAME_WIDTH,
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
        switch (action) {
          case "locale-ru":
            save.save({ ...currentState, progress: { ...currentState.progress, locale: "ru" } });
            i18n.setLocale("ru");
            this.renderOverlay();
            return;
          case "locale-en":
            save.save({ ...currentState, progress: { ...currentState.progress, locale: "en" } });
            i18n.setLocale("en");
            this.renderOverlay();
            return;
          case "toggle-sound":
            sound.toggle();
            if (sound.isEnabled()) {
              sound.goodMove();
            }
            this.renderOverlay();
            return;
          case "reset-save":
            save.save({ version: 1, progress: createInitialProgressState(), currentGame: null });
            i18n.setLocale("ru");
            this.scene.start(SCENES.map);
            return;
        }
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
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
        this.scene.start(SCENES.map);
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
        return;
    }
  }
}
