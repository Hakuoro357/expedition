import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { getArtifactById } from "@/data/artifacts";
import { resolveArtifactLargeUrl } from "@/data/artifactAssetUrls";
import { getNodeById } from "@/data/chapters";
import { getDailyDateKey } from "@/data/dailyDeals";
import { getNarrativeEntry } from "@/data/narrative/entries";
import { getPointTitleByDealId } from "@/data/narrative/points";
import { getNarrativeSpeakerProfile } from "@/data/narrative/speakers";
import { resolvePortraitUrl } from "@/data/portraitAssetUrls";
import { getRouteSheetByDealId, ROUTE_SHEETS } from "@/data/routeSheets";
import {
  createDetailSceneOverlayHtml,
  type DetailSceneTabId,
} from "@/scenes/detailSceneOverlay";
import { ROUTE_BOTTOM_NAV_HEIGHT } from "@/scenes/routeSceneLayout";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";

export type DetailOrigin = {
  scene: string;
  data?: Record<string, unknown>;
};

export type DetailSceneData = {
  dealId?: string;
  initialTab?: DetailSceneTabId;
  origin?: DetailOrigin;
};

type DetailNavTarget = "archive" | "daily" | "settings";

export class DetailScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private overlayCleanup?: () => void;
  private dealId = "";
  private activeTab: DetailSceneTabId = "entry";
  private origin?: DetailOrigin;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.detail);
  }

  create(data: DetailSceneData): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    getAppContext().sound.playBgm("map");
    this.dealId = data.dealId ?? "";
    const node = this.dealId ? getNodeById(this.dealId) : undefined;

    if (!node) {
      this.scene.start(SCENES.map);
      return;
    }

    const initialTab = data.initialTab ?? "entry";
    this.activeTab = initialTab;
    this.origin = data.origin;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlayCleanup?.();
      this.overlay?.destroy();
      this.overlay = undefined;
      this.overlayCleanup = undefined;
    });

    this.render();
  }

  private render(): void {
    const { i18n } = getAppContext();
    const node = getNodeById(this.dealId);
    if (!node) {
      this.scene.start(SCENES.map);
      return;
    }

    const locale = i18n.getNarrativeLocale();
    const sheet = getRouteSheetByDealId(node.id) ?? ROUTE_SHEETS[0];
    const entry = node.entryId ? getNarrativeEntry(node.entryId, locale) : undefined;
    const speaker = entry ? getNarrativeSpeakerProfile(entry.speakerEntityId, locale) : undefined;
    const artifact = node.artifactId ? getArtifactById(node.artifactId) : undefined;
    const canShowEntry = Boolean(entry);
    const canShowArtifact = Boolean(artifact);

    if (this.activeTab === "artifact" && !canShowArtifact && canShowEntry) {
      this.activeTab = "entry";
    }

    if (this.activeTab === "entry" && !canShowEntry && canShowArtifact) {
      this.activeTab = "artifact";
    }

    this.children.removeAll(true);
    this.renderBackground(sheet.background.topColor, sheet.background.bottomColor, sheet.background.glowColor);

    const html = createDetailSceneOverlayHtml({
      homeLabel: i18n.currentLocale() === "ru" ? "Назад" : "Back",
      navItems: [
        { id: "archive", label: i18n.t("archive"), active: false },
        { id: "daily", label: i18n.t("daily"), active: false },
        { id: "settings", label: i18n.t("settings"), active: false },
      ],
      activeTab: this.activeTab,
      entryTabLabel: i18n.currentLocale() === "ru" ? "Запись" : "Entry",
      artifactTabLabel: i18n.currentLocale() === "ru" ? "Артефакт" : "Artifact",
      entry:
        entry && speaker
          ? {
              pointLabel: getPointTitleByDealId(node.id, locale) ?? node.pointId,
              author: speaker.fullName,
              initials: speaker.initials,
              accent: speaker.accent,
              portraitUrl: resolvePortraitUrl(speaker.portraitKey),
              body: entry.body,
            }
          : undefined,
      artifact: artifact
        ? {
            title: i18n.currentLocale() === "ru" ? artifact.titleRu : artifact.titleEn,
            description: i18n.currentLocale() === "ru" ? artifact.descriptionRu : artifact.descriptionEn,
            imageUrl: resolveArtifactLargeUrl(artifact.largeImageKey),
          }
        : undefined,
    });

    if (!this.overlay) {
      this.overlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "detail-page-root",
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
    } else {
      this.overlay.setHtml(html);
    }

    this.bindOverlayEvents();
  }

  private renderBackground(topColor: number, bottomColor: number, glowColor: number): void {
    const background = this.add.graphics();
    background.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
    background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    background.fillStyle(glowColor, 0.18);
    background.fillEllipse(GAME_WIDTH / 2, 148, 320, 164);
    background.fillStyle(glowColor, 0.1);
    background.fillEllipse(GAME_WIDTH / 2, 332, 360, 220);

    const field = this.add.graphics();
    field.fillStyle(topColor, 0.4);
    field.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT);

    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, ROUTE_BOTTOM_NAV_HEIGHT);
    navBar.strokeLineShape(
      new Phaser.Geom.Line(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT),
    );
  }

  private bindOverlayEvents(): void {
    if (!this.overlay) {
      return;
    }

    const root = this.overlay.getInnerElement();
    this.overlayCleanup?.();

    const disposers: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>("[data-detail-tab]").forEach((element) => {
      const nextTab = element.dataset.detailTab as DetailSceneTabId | undefined;
      if (!nextTab) {
        return;
      }

      const onClick = (): void => {
        if (this.activeTab === nextTab) {
          return;
        }

        this.activeTab = nextTab;
        this.render();
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    root.querySelectorAll<HTMLElement>("[data-app-nav]").forEach((element) => {
      const target = element.dataset.appNav as DetailNavTarget | undefined;
      if (!target) {
        return;
      }

      const onClick = (): void => this.handleBottomNav(target);
      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    const homeButton = root.querySelector<HTMLElement>("[data-detail-home]");
    if (homeButton) {
      const onClick = (): void => {
        if (this.origin) {
          this.scene.start(this.origin.scene, this.origin.data);
        } else {
          this.scene.start(SCENES.diary);
        }
      };
      homeButton.style.pointerEvents = "auto";
      homeButton.addEventListener("click", onClick);
      disposers.push(() => homeButton.removeEventListener("click", onClick));
    }

    const scrollBody = root.querySelector<HTMLElement>(".detail-page__entry-body");
    if (scrollBody) {
      scrollBody.style.pointerEvents = "auto";
    }

    this.overlayCleanup = () => {
      disposers.forEach((dispose) => dispose());
    };
  }

  private handleBottomNav(target: DetailNavTarget): void {
    const { i18n, save } = getAppContext();

    switch (target) {
      case "archive":
        this.scene.start(SCENES.diary);
        return;
      case "daily": {
        const progress = save.load().progress;
        const dailyKey = getDailyDateKey();

        if (progress.dailyClaimedOn === dailyKey) {
          this.setStatus(i18n.t("dailyAlreadyClaimed"));
          return;
        }

        this.scene.start(SCENES.game, {
          mode: "daily",
          dealId: `daily-${dailyKey}`,
        });
        return;
      }
      case "settings":
        this.scene.start(SCENES.settings);
        return;
    }
  }

  private setStatus(message: string): void {
    if (!this.statusText) {
      this.statusText = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT - 16, message, {
          fontFamily: "'Trebuchet MS', Verdana, sans-serif",
          fontSize: "13px",
          color: "#ceb88e",
        })
        .setOrigin(0.5);
      return;
    }

    this.statusText.setText(message);
  }
}
