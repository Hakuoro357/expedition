import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { ARTIFACTS, type Artifact } from "@/data/artifacts";
import { CHAPTERS, getNodeByArtifactId, getNodeByEntryId } from "@/data/chapters";
import { getDailyDateKey } from "@/data/dailyDeals";
import { getNarrativeEntry, getNarrativeEntryExcerpt } from "@/data/narrative/entries";
import { getPointTitleByPointId } from "@/data/narrative/points";
import { getNarrativeSpeakerProfile } from "@/data/narrative/speakers";
import { resolvePortraitUrl } from "@/data/portraitAssetUrls";
import {
  createArchiveOverlayHtml,
  type ArchiveTabId,
} from "@/scenes/archiveSceneOverlay";
import { ROUTE_BOTTOM_NAV_HEIGHT } from "@/scenes/routeSceneLayout";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";

type ArchiveEntryItem = {
  entryId: string;
  pointId: string;
  pointLabel: string;
  author: string;
  initials: string;
  accent: string;
  portraitUrl: string | undefined;
  excerpt: string;
  body: string;
};

type ArchiveNavTarget = "home" | "daily" | "settings";

export class DiaryScene extends Phaser.Scene {
  private archiveOverlay?: CanvasOverlayHandle;
  private archiveOverlayCleanup?: () => void;
  private activeTab: ArchiveTabId = "entries";
  private artifactGridObjects: Phaser.GameObjects.GameObject[] = [];
  private archiveEntries: ArchiveEntryItem[] = [];

  constructor() {
    super(SCENES.diary);
  }

  create(): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    const { i18n, save } = getAppContext();
    const { progress } = save.load();
    const previewAllArtifacts =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("preview") === "all-artifacts";
    const narrativeLocale = i18n.getNarrativeLocale();
    const visibleArtifactIds = previewAllArtifacts
      ? ARTIFACTS.map((artifact) => artifact.id)
      : progress.artifacts;

    this.archiveEntries = this.buildArchiveEntries(narrativeLocale);

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

    this.createArtifactGrid(visibleArtifactIds);
    this.updateArtifactGridVisibility();
    this.renderArchiveOverlay();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.archiveOverlayCleanup?.();
      this.archiveOverlay?.destroy();
      this.archiveOverlay = undefined;
    });
  }

  private buildArchiveEntries(locale: "ru" | "global"): ArchiveEntryItem[] {
    const { save } = getAppContext();
    const { progress } = save.load();

    return progress.completedNodes
      .map((nodeId) => {
        const chapterNode = this.getChapterNode(nodeId);
        if (!chapterNode) {
          return null;
        }

        const entry = getNarrativeEntry(chapterNode.entryId, locale);
        if (!entry) {
          return null;
        }

        const speaker = getNarrativeSpeakerProfile(entry.speakerEntityId, locale);

        return {
          entryId: chapterNode.entryId,
          pointId: chapterNode.pointId,
          pointLabel: getPointTitleByPointId(chapterNode.pointId, locale) ?? chapterNode.pointId,
          author: speaker.fullName,
          initials: speaker.initials,
          accent: speaker.accent,
          portraitUrl: resolvePortraitUrl(speaker.portraitKey),
          excerpt: getNarrativeEntryExcerpt(chapterNode.entryId, locale) ?? "",
          body: entry.body,
        };
      })
      .filter((item): item is ArchiveEntryItem => Boolean(item));
  }

  private getChapterNode(nodeId: string) {
    return CHAPTERS.flatMap((chapter) => chapter.nodes).find((node) => node.id === nodeId);
  }

  private createArtifactGrid(visibleArtifactIds: string[]): void {
    this.artifactGridObjects.forEach((object) => object.destroy());
    this.artifactGridObjects = [];

    const colCount = 3;
    const cellW = 94;
    const cellH = 96;
    const gridStartY = 172;
    const gridLeft = GAME_WIDTH / 2 - (colCount * cellW) / 2 + cellW / 2;

    const openedArtifacts = ARTIFACTS.filter((artifact) =>
      visibleArtifactIds.includes(artifact.id),
    );

    openedArtifacts.forEach((artifact, idx) => {
      const col = idx % colCount;
      const row = Math.floor(idx / colCount);
      const cx = gridLeft + col * cellW;
      const cy = gridStartY + row * cellH + cellH / 2;

      const cell = this.add
        .rectangle(cx, cy, cellW - 8, cellH - 8, 0x2c4943, 1)
        .setStrokeStyle(1, 0xdac9a1, 0.65);

      const image = this.add
        .image(cx, cy, artifact.imageKey)
        .setDisplaySize(70, 70)
        .setOrigin(0.5)
        .setAlpha(1);

      this.artifactGridObjects.push(cell, image);

      const open = () => {
        this.openArtifactDetail(artifact);
      };

      cell.setInteractive({ useHandCursor: true }).on("pointerdown", open);
      image.setInteractive({ useHandCursor: true }).on("pointerdown", open);
    });
  }

  private updateArtifactGridVisibility(): void {
    const visible = this.activeTab === "artifacts";
    this.artifactGridObjects.forEach((object) => {
      const visualCarrier = object as Phaser.GameObjects.GameObject & {
        setVisible?: (visible: boolean) => Phaser.GameObjects.GameObject;
      };
      visualCarrier.setVisible?.(visible);
      const inputCarrier = object as Phaser.GameObjects.GameObject & {
        input?: { enabled: boolean };
      };
      if (inputCarrier.input) {
        inputCarrier.input.enabled = visible;
      }
    });
  }

  private renderArchiveOverlay(): void {
    const { i18n, save } = getAppContext();
    const progress = save.load().progress;
    const html = createArchiveOverlayHtml({
      title: i18n.t("archive"),
      activeTab: this.activeTab,
      entriesLabel: i18n.t("entries"),
      artifactsLabel: i18n.t("artifacts"),
      emptyEntriesLabel:
        i18n.currentLocale() === "ru" ? "Записи пока не открыты." : "No entries are open yet.",
      emptyArtifactsLabel:
        i18n.currentLocale() === "ru"
          ? "Артефакты пока не найдены."
          : "No artifacts found yet.",
      entryItems: this.archiveEntries.map((item) => ({
        entryId: item.entryId,
        pointId: item.pointId,
        pointLabel: item.pointLabel,
        author: item.author,
        initials: item.initials,
        accent: item.accent,
        portraitUrl: item.portraitUrl,
        excerpt: item.excerpt,
      })),
      artifactCount: progress.artifacts.length,
      navItems: [
        { id: "home", label: i18n.t("backToMap"), active: false },
        { id: "daily", label: i18n.t("daily"), active: false },
        { id: "settings", label: i18n.t("settings"), active: false },
      ],
    });

    if (!this.archiveOverlay) {
      this.archiveOverlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "archive-overlay-root",
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
    } else {
      this.archiveOverlay.setHtml(html);
    }

    const root = this.archiveOverlay.getInnerElement();
    this.archiveOverlayCleanup?.();

    const disposers: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>("[data-archive-tab]").forEach((element) => {
      const nextTab = element.dataset.archiveTab as ArchiveTabId | undefined;
      if (!nextTab) {
        return;
      }

      const onClick = (): void => {
        if (this.activeTab === nextTab) {
          return;
        }

        this.activeTab = nextTab;
        this.updateArtifactGridVisibility();
        this.renderArchiveOverlay();
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    root.querySelectorAll<HTMLElement>("[data-archive-entry]").forEach((element) => {
      const entryId = element.dataset.archiveEntry;
      if (!entryId) {
        return;
      }

      const onClick = (): void => {
        const item = this.archiveEntries.find((entry) => entry.entryId === entryId);
        if (!item) {
          return;
        }

        this.openEntryDetail(item);
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    root.querySelectorAll<HTMLElement>("[data-app-nav]").forEach((element) => {
      const target = element.dataset.appNav as ArchiveNavTarget | undefined;
      if (!target) {
        return;
      }

      const onClick = (): void => this.handleBottomNav(target);
      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    const entriesList = root.querySelector<HTMLElement>(".archive-overlay__entries-list");
    if (entriesList) {
      entriesList.style.pointerEvents = "auto";
    }

    this.archiveOverlayCleanup = () => {
      disposers.forEach((dispose) => dispose());
    };
  }

  private handleBottomNav(target: ArchiveNavTarget): void {
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

  private openEntryDetail(item: ArchiveEntryItem): void {
    const node = getNodeByEntryId(item.entryId);
    if (!node) {
      return;
    }

    this.scene.start(SCENES.detail, {
      dealId: node.id,
      initialTab: "entry",
    });
  }

  private openArtifactDetail(artifact: Artifact): void {
    const node = getNodeByArtifactId(artifact.id);
    if (!node) {
      return;
    }

    this.scene.start(SCENES.detail, {
      dealId: node.id,
      initialTab: "artifact",
    });
  }
}
