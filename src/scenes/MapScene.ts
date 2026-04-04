import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { applyTextRenderQuality } from "@/app/rendering";
import { getNodeById, type ChapterNode } from "@/data/chapters";
import { getDailyDateKey } from "@/data/dailyDeals";
import { getNarrativeEntryExcerpt } from "@/data/narrative/entries";
import { getPointTitleByDealId } from "@/data/narrative/points";
import {
  ROUTE_SHEETS,
  getCurrentRoutePointState,
  getNextPlayableDealId,
  getRouteSheetByDealId,
  getRouteSheetByPage,
  getRouteSheetTitle,
  isRouteSheetUnlocked,
} from "@/data/routeSheets";
import {
  ROUTE_BOTTOM_NAV_HEIGHT,
  buildRouteSheetPoints,
  getDesktopPageControls,
} from "@/scenes/routeSceneLayout";
import { createRouteSceneOverlayHtml, type RouteOverlayPoint, type RouteOverlaySegment } from "@/scenes/routeSceneOverlay";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";

type RouteNavTarget = "archive" | "daily" | "settings";

export class MapScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private content?: Phaser.GameObjects.Container;
  private currentPage = 1;
  private dragStart?: { x: number; y: number };

  constructor() {
    super(SCENES.map);
  }

  create(): void {
    const { analytics, save } = getAppContext();
    const progress = save.load().progress;
    const nextDealId = getNextPlayableDealId(progress);
    const initialPage = nextDealId ? getRouteSheetByDealId(nextDealId)?.page ?? 1 : ROUTE_SHEETS.length;

    this.currentPage = initialPage;
    analytics.track("route_open", { page: this.currentPage });

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointerup", this.handlePointerUp, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = undefined;
      this.input.off("pointerdown", this.handlePointerDown, this);
      this.input.off("pointerup", this.handlePointerUp, this);
    });

    this.render();
  }

  private render(): void {
    const { i18n, save } = getAppContext();
    const progress = save.load().progress;
    const page = getRouteSheetByPage(this.currentPage) ?? ROUTE_SHEETS[0];
    const pageNodes = (page?.dealIds ?? [])
      .map((dealId) => getNodeById(dealId))
      .filter((node): node is ChapterNode => Boolean(node));
    const routePoints = buildRouteSheetPoints(pageNodes.length);
    const nextDealId = getNextPlayableDealId(progress);
    const activeNode = nextDealId ? getNodeById(nextDealId) : undefined;
    const activePage = activeNode ? getRouteSheetByDealId(activeNode.id)?.page ?? null : null;
    const activePointIndex = activeNode && activePage === this.currentPage
      ? pageNodes.findIndex((node) => node.id === activeNode.id)
      : -1;
    const activePoint = activePointIndex >= 0 ? routePoints[activePointIndex] : undefined;
    const canGoPrev = this.currentPage > 1;
    const canGoNext = isRouteSheetUnlocked(this.currentPage + 1, progress);

    this.content?.destroy(true);
    this.content = this.add.container(0, 0);

    this.renderBackground(page);
    this.renderPageSurface(page);
    this.renderPoints(pageNodes, routePoints, progress);
    this.renderNavHitAreas(canGoPrev, canGoNext);
    this.renderBottomNav();
    const overlayPoints: RouteOverlayPoint[] = pageNodes
      .map((node, idx) => {
        const point = routePoints[idx];
        if (!point) {
          return null;
        }

        return {
          x: point.x,
          y: point.y,
          label: String(this.getDealSerial(node.id)),
          state: getCurrentRoutePointState(node.id, progress),
        };
      })
      .filter((point): point is RouteOverlayPoint => Boolean(point));
    const overlaySegments: RouteOverlaySegment[] = routePoints
      .slice(0, -1)
      .map((from, idx) => {
        const to = routePoints[idx + 1];
        const node = pageNodes[idx];
        const nextNode = pageNodes[idx + 1];
        if (!from || !to || !node || !nextNode) {
          return null;
        }

        const fromState = getCurrentRoutePointState(node.id, progress);
        const toState = getCurrentRoutePointState(nextNode.id, progress);
        return {
          fromX: from.x,
          fromY: from.y,
          toX: to.x,
          toY: to.y,
          visible: fromState !== "future" && toState !== "future",
        };
      })
      .filter((segment): segment is RouteOverlaySegment => Boolean(segment));
    this.renderOverlay({
      pageLabel: this.getPageLabel(i18n.currentLocale(), this.currentPage),
      activePointTitle:
        activeNode && activePoint
          ? getPointTitleByDealId(activeNode.id, i18n.getNarrativeLocale()) ?? `${i18n.t("point")} ${this.getDealSerial(activeNode.id)}`
          : "",
      activePointDescription:
        activeNode && activePoint
          ? getNarrativeEntryExcerpt(activeNode.entryId, i18n.getNarrativeLocale()) ?? ""
          : "",
      canGoPrev,
      canGoNext,
      routePoints: overlayPoints,
      routeSegments: overlaySegments,
      navItems: [
        { id: "archive", label: i18n.currentLocale() === "ru" ? "Архив" : "Archive", active: false },
        { id: "daily", label: i18n.t("daily"), active: false },
        { id: "settings", label: i18n.t("settings"), active: false },
      ],
    });
  }

  private renderBackground(page: (typeof ROUTE_SHEETS)[number]): void {
    const background = this.add.graphics();
    background.fillGradientStyle(
      page.background.topColor,
      page.background.topColor,
      page.background.bottomColor,
      page.background.bottomColor,
      1,
    );
    background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    background.fillStyle(page.background.glowColor, 0.18);
    background.fillEllipse(GAME_WIDTH / 2, 138, 320, 164);
    background.fillStyle(page.background.glowColor, 0.1);
    background.fillEllipse(GAME_WIDTH / 2, 324, 360, 220);
    this.content?.add(background);
  }

  private renderPageSurface(page: (typeof ROUTE_SHEETS)[number]): void {
    const fieldHeight = GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT;
    const sheet = this.add.graphics();
    sheet.fillStyle(page.background.topColor, 0.42);
    sheet.fillRect(0, 0, GAME_WIDTH, fieldHeight);

    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, ROUTE_BOTTOM_NAV_HEIGHT);
    navBar.strokeLineShape(
      new Phaser.Geom.Line(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT),
    );

    this.content?.add([sheet, navBar]);
  }

  private renderPoints(
    pageNodes: ChapterNode[],
    routePoints: Array<{ x: number; y: number }>,
    progress: ReturnType<typeof getAppContext>["save"]["load"] extends () => infer T
      ? T extends { progress: infer P }
        ? P
        : never
      : never,
  ): void {
    pageNodes.forEach((node, idx) => {
      const point = routePoints[idx];
      if (!point) {
        return;
      }

      const state = getCurrentRoutePointState(node.id, progress);

      if (state === "future") {
        return;
      }

      const isCurrent = state === "current";
      const radius = isCurrent ? 24 : 19;

      const hitArea = this.add
        .circle(point.x, point.y, radius + 10, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on("pointerdown", () => {
        if (state === "current") {
          this.scene.start(SCENES.game, { mode: "adventure", dealId: node.id });
          return;
        }

        this.scene.start(SCENES.detail, {
          dealId: node.id,
          initialTab: node.entryId ? "entry" : "artifact",
        });
      });

      this.content?.add(hitArea);
    });
  }

  private renderNavHitAreas(canGoPrev: boolean, canGoNext: boolean): void {
    const controls = getDesktopPageControls();

    if (canGoPrev) {
      this.addPageControlHitArea(controls.left.x, controls.left.y, -1);
    }

    if (canGoNext) {
      this.addPageControlHitArea(controls.right.x, controls.right.y, 1);
    }
  }

  private addPageControlHitArea(x: number, y: number, delta: -1 | 1): void {
    const hitArea = this.add.rectangle(x, y, 42, 96, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hitArea.on("pointerdown", () => this.changePage(delta));
    this.content?.add(hitArea);
  }

  private renderBottomNav(): void {
    const y = GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT / 2;
    const items: Array<{ x: number; target: RouteNavTarget }> = [
      { x: 70, target: "archive" },
      { x: GAME_WIDTH / 2, target: "daily" },
      { x: GAME_WIDTH - 70, target: "settings" },
    ];

    items.forEach((item) => {
      const hitArea = this.add.rectangle(item.x, y, 104, ROUTE_BOTTOM_NAV_HEIGHT, 0xffffff, 0).setInteractive({
        useHandCursor: true,
      });
      hitArea.on("pointerdown", () => this.handleBottomNav(item.target));
      this.content?.add(hitArea);
    });
  }

  private renderOverlay(params: Parameters<typeof createRouteSceneOverlayHtml>[0]): void {
    const html = createRouteSceneOverlayHtml(params);

    if (!this.overlay) {
      this.overlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "route-overlay-root",
        logicalWidth: GAME_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
      return;
    }

    this.overlay.setHtml(html);
  }

  private handleBottomNav(target: RouteNavTarget): void {
    switch (target) {
      case "archive":
        this.scene.start(SCENES.diary);
        return;
      case "daily": {
        const { save, i18n } = getAppContext();
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

  private changePage(delta: -1 | 1): void {
    const { save } = getAppContext();
    const progress = save.load().progress;
    const nextPage = this.currentPage + delta;

    if (!isRouteSheetUnlocked(nextPage, progress)) {
      return;
    }

    if (!getRouteSheetByPage(nextPage)) {
      return;
    }

    this.currentPage = nextPage;
    this.render();
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.dragStart = { x: pointer.x, y: pointer.y };
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.dragStart) {
      this.dragStart = undefined;
      return;
    }

    const deltaX = pointer.x - this.dragStart.x;
    const deltaY = pointer.y - this.dragStart.y;
    this.dragStart = undefined;

    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) {
      return;
    }

    this.changePage(deltaX > 0 ? -1 : 1);
  }

  private getPageLabel(locale: "ru" | "en", page: number): string {
    return getRouteSheetTitle(page, locale);
  }

  private getDealSerial(dealId: string): number {
    return ROUTE_SHEETS.flatMap((sheet) => sheet.dealIds).findIndex((id) => id === dealId) + 1;
  }

  private _statusText?: Phaser.GameObjects.Text;

  private setStatus(message: string): void {
    if (!this._statusText) {
      this._statusText = applyTextRenderQuality(
        this.add
          .text(GAME_WIDTH / 2, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT - 16, message, {
            fontFamily: "'Trebuchet MS', Verdana, sans-serif",
            fontSize: "13px",
            color: "#ceb88e",
          })
          .setOrigin(0.5),
      );
      return;
    }

    this._statusText.setText(message);
  }
}
