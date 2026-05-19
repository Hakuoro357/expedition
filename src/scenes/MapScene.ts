import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { socialsContext } from "@/app/socialsContext";
import { mountPatronDialog } from "@/ui/patronDialog";
import { applyTextRenderQuality } from "@/app/rendering";
import type { ProgressState } from "@/core/game-state/types";
import { getNodeById, type ChapterNode } from "@/data/chapters";
import { getDailyDateKey } from "@/data/dailyDeals";
import { getPointMapDescriptionByDealId, getPointTitleByDealId } from "@/data/narrative/points";
import {
  ROUTE_SHEETS,
  getCurrentRoutePointState,
  getNextPlayableDealId,
  getRouteSheetByDealId,
  getRouteSheetByPage,
  getRouteSheetSummary,
  getRouteSheetTitle,
  isRouteSheetUnlocked,
} from "@/data/routeSheets";
import {
  ROUTE_BOTTOM_NAV_HEIGHT,
  buildRouteSheetPoints,
} from "@/scenes/routeSceneLayout";
import { createRouteSceneOverlayHtml, type RouteOverlayPoint, type RouteOverlaySegment } from "@/scenes/routeSceneOverlay";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { lockClicksFor } from "@/ui/ghostClickGuard";
import type { AppNavItem } from "@/ui/appNavHtml";

type RouteNavTarget = "archive" | "daily" | "achievements" | "settings";

export type MapSceneData = {
  /** Page to show when returning from another scene */
  page?: number;
  /** When true, show patron purchase push dialog 600ms after scene is ready */
  showPatronPush?: boolean;
};

export class MapScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private overlayCleanup?: () => void;
  private content?: Phaser.GameObjects.Container;
  private currentPage = 1;
  private dragStart?: { x: number; y: number };
  private pendingPatronPush = false;

  constructor() {
    super(SCENES.map);
  }

  init(data: MapSceneData): void {
    this.pendingPatronPush = Boolean(data?.showPatronPush);
  }

  create(data?: MapSceneData): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    const { analytics, save, sound } = getAppContext();
    sound.playBgm("map");
    const progress = save.load().progress;
    const nextDealId = getNextPlayableDealId(progress);
    const defaultPage = nextDealId ? getRouteSheetByDealId(nextDealId)?.page ?? 1 : ROUTE_SHEETS.length;

    this.currentPage = data?.page ?? defaultPage;
    analytics.track("route_open", { page: this.currentPage });

    this.input.on("pointerdown", this.handlePointerDown, this);
    this.input.on("pointerup", this.handlePointerUp, this);

    // Подписка на mute-изменения платформы. Если GP по какой-то причине
    // изменит mute-статус ПОСЛЕ того как карта уже отрендерилась
    // (preloader-ad закрылся, пользователь кликнул платформенную иконку
    // звука и т.п.) — иконка в правом верхнем углу перерисуется.
    const unsubscribeMute = sound.onMuteChange(() => this.render());
    // v0.3.61: re-render после успешной покупки patron — heart icon
    // должна исчезнуть (canPurchasePatron() возвращает false когда patronSupport=true).
    const payments = getAppContext().payments;
    const unsubscribePatron = payments?.onChange(() => this.render());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribeMute();
      unsubscribePatron?.();
      this.overlayCleanup?.();
      this.overlay?.destroy();
      this.overlay = undefined;
      this.input.off("pointerdown", this.handlePointerDown, this);
      this.input.off("pointerup", this.handlePointerUp, this);
    });

    this.render();

    // Post-3-wins patron push — delayed to let the map settle visually
    if (this.pendingPatronPush) {
      this.pendingPatronPush = false;
      const timer = this.time.delayedCall(600, () => {
        if (!this.scene.isActive() || !(getAppContext().payments?.canPurchasePatron() ?? false)) return;
        void this.openPatronPush();
      });
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.remove());
    }
  }

  private async openPatronPush(): Promise<void> {
    const { save } = getAppContext();
    // On-impression flag — guard against repeated showing (set before dialog opens)
    save.updateProgress((p) => ({ ...p, patronPushShown: true }));
    try {
      await save.flush();
    } catch (err) {
      console.warn("[payments] post-win push flush failed", err);
    }
    mountPatronDialog("post_win_push");
  }

  private render(): void {
    const { i18n, save, sound } = getAppContext();
    const progress = save.load().progress;
    const page = getRouteSheetByPage(this.currentPage) ?? ROUTE_SHEETS[0];
    const pageNodes = (page?.dealIds ?? [])
      .map((dealId) => getNodeById(dealId))
      .filter((node): node is ChapterNode => Boolean(node));
    const routePoints = buildRouteSheetPoints(pageNodes.length, this.currentPage);
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
    this.renderBottomNav();
    const narrativeLocale = i18n.getNarrativeLocale();
    const overlayPoints: RouteOverlayPoint[] = pageNodes
      .map((node, idx): RouteOverlayPoint | null => {
        const point = routePoints[idx];
        if (!point) {
          return null;
        }

        const state = getCurrentRoutePointState(node.id, progress);
        return {
          x: point.x,
          y: point.y,
          label: String(this.getDealSerial(node.id)),
          title: state === "passed" ? getPointTitleByDealId(node.id, narrativeLocale) : undefined,
          state,
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
    // If all nodes on this page are completed, show the page summary
    const pageFullyCompleted = (page?.dealIds ?? []).length > 0
      && (page?.dealIds ?? []).every((id) => progress.completedNodes.includes(id));
    const locale = i18n.currentLocale();

    let panelTitle = "";
    let panelDescription = "";

    if (activeNode && activePoint) {
      panelTitle = getPointTitleByDealId(activeNode.id, narrativeLocale) ?? `${i18n.t("point")} ${this.getDealSerial(activeNode.id)}`;
      // Каждая точка имеет своё короткое описание, гарантированно
      // помещающееся в 3 строки нижней map-панели — без обрезания
      // многоточием. Раньше брали excerpt из длинного дневникового
      // тела и обрезали по 150 символам.
      panelDescription = getPointMapDescriptionByDealId(activeNode.id, narrativeLocale);
    } else if (pageFullyCompleted) {
      panelTitle = `✓ ${this.getPageLabel(locale, this.currentPage)}`;
      panelDescription = getRouteSheetSummary(this.currentPage, locale);
    }

    // Читаем из SoundService (а не sdk.isMuted()) — единственный источник
    // истины для UI, обновляется через onMuteChange listener.
    const platformMuted = sound.isPlatformMuted();
    const ctx = getAppContext();
    const sdk = ctx.sdk;
    const showCommunityButton = sdk.canJoinCommunity();
    const showAchievements = sdk.canUseAchievements();
    // v0.3.61: heart-кнопка «Поддержать автора» в top-right стэке. Visible
    // только если payments available + не-patron. После покупки исчезает.
    const showPatronButton = ctx.payments?.canPurchasePatron() ?? false;
    // v0.3.58 → v0.3.59: trophy переехал из top-right overlay в bottom-nav
    // между «Маршрут дня» и «Меню». Top-right trophy спрятан (showAchievementsButton=false).
    const navItems: AppNavItem[] = [
      { id: "archive", label: i18n.t("archive"), active: false },
      { id: "daily", label: i18n.t("daily"), active: false },
      ...(showAchievements
        ? ([{ id: "achievements", label: i18n.t("achievements"), active: false }] as const)
        : []),
      { id: "settings", label: i18n.t("menu"), active: false },
    ];
    this.renderOverlay({
      pageLabel: this.getPageLabel(locale, this.currentPage),
      activePointTitle: panelTitle,
      activePointDescription: panelDescription,
      canGoPrev,
      canGoNext,
      routePoints: overlayPoints,
      routeSegments: overlaySegments,
      navItems,
      showDevTools: import.meta.env.DEV,
      muted: platformMuted,
      muteAriaLabel: platformMuted ? i18n.t("unmute") : i18n.t("mute"),
      showCommunityButton,
      communityAriaLabel: showCommunityButton ? i18n.t("communityAriaLabel") : undefined,
      // v0.3.58: top-left coin counter сохраняется. Top-right trophy спрятан —
      // кнопка теперь в bottom-nav.
      coins: save.load().progress.coins,
      showAchievementsButton: false,
      showPatronButton,
      patronAriaLabel: showPatronButton ? i18n.t("supportAuthor") : undefined,
    });
  }

  private renderBackground(page: (typeof ROUTE_SHEETS)[number]): void {
    // Если для текущей страницы (=главы) есть коллаж-картинка — кладём
    // её первым слоем как cover-fit, сверху тинт цветом главы для
    // сохранения per-chapter mood'а. Иначе fallback на старый градиент.
    const collageKey = `map-chapter-${page.page}`;
    const hasCollage = this.textures.exists(collageKey);
    const layers: Phaser.GameObjects.GameObject[] = [];

    if (hasCollage) {
      const img = this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, collageKey)
        .setOrigin(0.5);
      const scale = Math.max(GAME_WIDTH / img.width, GAME_HEIGHT / img.height);
      img.setScale(scale);
      layers.push(img);

      // Tint поверх коллажа: цвет главы (topColor) при 0.25 alpha.
      // Раньше было 0.58 — слишком плотный зелёный «гасил» пергамент,
      // картинка теряла детали и выглядела как старый плоский фон с
      // намёком на коллаж сквозь дымку. На 0.25 пергамент дышит,
      // chapter-identity цвета чувствуется, но не доминирует. Если
      // route-кружки на конкретной главе будут плохо читаться — можно
      // выйти на 0.35 для этой главы через per-chapter override, но
      // глобально 0.25 — золотая середина.
      const tint = this.add.graphics();
      tint.fillStyle(page.background.topColor, 0.25);
      tint.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      layers.push(tint);
    } else {
      const background = this.add.graphics();
      background.fillGradientStyle(
        page.background.topColor,
        page.background.topColor,
        page.background.bottomColor,
        page.background.bottomColor,
        1,
      );
      background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      layers.push(background);
    }

    // Glow-эллипсы — мягкий объёмный акцент сверху и снизу. На
    // градиентном фоне они нужны (создают объём из плоской заливки).
    // На коллаже они избыточны — лантерна и естественная подсветка
    // картинки уже создают объём; искусственный glow поверх выглядит
    // как «плёнка». Поэтому добавляем только если коллажа нет.
    if (!hasCollage) {
      const glow = this.add.graphics();
      glow.fillStyle(page.background.glowColor, 0.18);
      glow.fillEllipse(GAME_WIDTH / 2, 138, 320, 164);
      glow.fillStyle(page.background.glowColor, 0.1);
      glow.fillEllipse(GAME_WIDTH / 2, 324, 360, 220);
      layers.push(glow);
    }

    this.content?.add(layers);
  }

  private renderPageSurface(page: (typeof ROUTE_SHEETS)[number]): void {
    const fieldHeight = GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT;
    const layers: Phaser.GameObjects.GameObject[] = [];

    // Tint-плашка поверх фона. Когда фон — градиент, она усиливает
    // цвет главы. Когда фон — коллаж, в renderBackground мы уже
    // положили один tint-слой; добавлять второй здесь = переборщить
    // с темнотой и забить детали коллажа. Поэтому пропускаем.
    const collageKey = `map-chapter-${page.page}`;
    if (!this.textures.exists(collageKey)) {
      const sheet = this.add.graphics();
      sheet.fillStyle(page.background.topColor, 0.42);
      sheet.fillRect(0, 0, GAME_WIDTH, fieldHeight);
      layers.push(sheet);
    }

    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, ROUTE_BOTTOM_NAV_HEIGHT);
    navBar.strokeLineShape(
      new Phaser.Geom.Line(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT),
    );
    layers.push(navBar);

    this.content?.add(layers);
  }

  private renderPoints(
    pageNodes: ChapterNode[],
    routePoints: Array<{ x: number; y: number }>,
    progress: ProgressState,
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
        // Глушим ghost-click до scene.start (см. renderBottomNav).
        lockClicksFor(350);
        if (state === "current") {
          this.handleCurrentNodeClick(node.id);
          return;
        }

        this.scene.start(SCENES.detail, {
          dealId: node.id,
          initialTab: node.entryId ? "entry" : "artifact",
          origin: { scene: SCENES.map, data: { page: this.currentPage } },
        });
      });

      this.content?.add(hitArea);
    });
  }

  private renderBottomNav(): void {
    const y = GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT / 2;
    // v0.3.59: 4 cells (archive / daily / achievements / settings) если SDK
    // поддерживает ачивки. На Yandex (canUseAchievements=false) — 3 cells как
    // раньше. Hit-area-позиции центрируются по grid-cells DOM-навбара
    // (`grid-template-columns: repeat(auto-fit, minmax(0, 1fr))`).
    const sdk = getAppContext().sdk;
    const showAchievements = sdk.canUseAchievements();
    const targets: RouteNavTarget[] = showAchievements
      ? ["archive", "daily", "achievements", "settings"]
      : ["archive", "daily", "settings"];
    const cellWidth = GAME_WIDTH / targets.length;
    const hitWidth = Math.min(104, cellWidth - 4);
    const items: Array<{ x: number; target: RouteNavTarget }> = targets.map((target, i) => ({
      x: cellWidth * (i + 0.5),
      target,
    }));

    items.forEach((item) => {
      const hitArea = this.add.rectangle(item.x, y, hitWidth, ROUTE_BOTTOM_NAV_HEIGHT, 0xffffff, 0).setInteractive({
        useHandCursor: true,
      });
      hitArea.on("pointerdown", () => {
        // Phaser pointerdown срабатывает на touchstart раньше, чем
        // браузер успевает доставить синтетический DOM click. Если мы
        // запустим scene.start здесь, новый overlay смонтируется уже
        // ПОСЛЕ touchend → ghost-click пробьёт в кнопку, оказавшуюся
        // под пальцем (например, «Назад» в нижнем меню архива на той же
        // позиции, что и «Архив» на карте). Глушим клики заранее — на
        // 350мс хватает на любой scene transition.
        lockClicksFor(350);
        this.handleBottomNav(item.target);
      });
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
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
    } else {
      this.overlay.setHtml(html);
    }

    this.bindPaginatorEvents();
  }

  private bindPaginatorEvents(): void {
    this.overlayCleanup?.();
    const root = this.overlay?.getInnerElement();
    if (!root) return;

    const disposers: Array<() => void> = [];

    const prevBtn = root.querySelector<HTMLElement>("[data-page-prev]");
    if (prevBtn) {
      const onClick = (): void => this.changePage(-1);
      prevBtn.style.pointerEvents = "auto";
      prevBtn.addEventListener("click", onClick);
      disposers.push(() => prevBtn.removeEventListener("click", onClick));
    }

    const nextBtn = root.querySelector<HTMLElement>("[data-page-next]");
    if (nextBtn) {
      const onClick = (): void => this.changePage(1);
      nextBtn.style.pointerEvents = "auto";
      nextBtn.addEventListener("click", onClick);
      disposers.push(() => nextBtn.removeEventListener("click", onClick));
    }

    const devSkipBtn = root.querySelector<HTMLElement>("[data-dev-skip]");
    if (devSkipBtn) {
      const onClick = (): void => this.devSkipNode();
      devSkipBtn.addEventListener("click", onClick);
      disposers.push(() => devSkipBtn.removeEventListener("click", onClick));
    }

    const devBackBtn = root.querySelector<HTMLElement>("[data-dev-back]");
    if (devBackBtn) {
      const onClick = (): void => this.devUnskipNode();
      devBackBtn.addEventListener("click", onClick);
      disposers.push(() => devBackBtn.removeEventListener("click", onClick));
    }

    // Плавающая кнопка звука — требование GP docs.
    const muteBtn = root.querySelector<HTMLElement>('[data-route-action="toggle-mute"]');
    if (muteBtn) {
      const onClick = (): void => {
        const { sdk, sound } = getAppContext();
        // Источник правды — SoundService, не sdk.isMuted() (см. render).
        const nextMuted = !sound.isPlatformMuted();
        if (nextMuted) sdk.muteSounds();
        else sdk.unmuteSounds();
        // Локально: мгновенный UI-ответ + поддержка noop-платформ (Yandex).
        sound.setPlatformMuted(nextMuted);
        this.render();  // перерисует overlay с актуальной иконкой
      };
      muteBtn.addEventListener("click", onClick);
      disposers.push(() => muteBtn.removeEventListener("click", onClick));
    }

    // v0.3.51 → v0.3.52: иконка-кнопка community рядом с mute. Видна
    // только когда canJoinCommunity=true (рендерится по showCommunityButton).
    // Result-listener устанавливает BootScene глобально, читает
    // socialsContext. Этот клик-handler только ставит pending-origin
    // и зовёт sdk.joinCommunity().
    const communityBtn = root.querySelector<HTMLElement>('[data-route-action="community"]');
    if (communityBtn) {
      const onClick = (): void => {
        socialsContext.pendingCommunityOrigin = "map";
        void getAppContext().sdk.joinCommunity();
      };
      communityBtn.addEventListener("click", onClick);
      disposers.push(() => communityBtn.removeEventListener("click", onClick));
    }

    // v0.3.58: trophy → open AchievementsScene via launch+pause.
    // pause/resume сохраняет MapScene.currentPage без явной передачи.
    const achievementsBtn = root.querySelector<HTMLElement>('[data-route-action="open-achievements"]');
    if (achievementsBtn) {
      const onClick = (): void => {
        getAppContext().analytics.track("achievements_open", { origin: "map" });
        this.scene.launch(SCENES.achievements, { returnTo: "map" });
        this.scene.pause();
      };
      achievementsBtn.addEventListener("click", onClick);
      disposers.push(() => achievementsBtn.removeEventListener("click", onClick));
    }

    // v0.3.61: heart → mountPatronDialog("map_top"). После успешной покупки
    // payments.onChange listener в MapScene должен re-render scene чтобы
    // кнопка исчезла. Подписку добавим если ещё нет.
    const patronBtn = root.querySelector<HTMLElement>('[data-route-action="open-patron"]');
    if (patronBtn) {
      const onClick = (): void => {
        mountPatronDialog("map_top");
      };
      patronBtn.addEventListener("click", onClick);
      disposers.push(() => patronBtn.removeEventListener("click", onClick));
    }

    this.overlayCleanup = () => {
      disposers.forEach((d) => d());
    };
  }

  private handleBottomNav(target: RouteNavTarget): void {
    switch (target) {
      case "archive":
        this.scene.start(SCENES.diary);
        return;
      case "daily": {
        const { save, i18n } = getAppContext();
        const saveState = save.load();
        const progress = saveState.progress;
        const dailyKey = getDailyDateKey();

        if (progress.dailyClaimedOn === dailyKey) {
          this.setStatus(i18n.t("dailyAlreadyClaimed"));
          return;
        }

        const dailyDealId = `daily-${dailyKey}`;
        const savedGame = saveState.currentGame;

        // Resume saved daily game if exists
        if (savedGame && savedGame.dealId === dailyDealId && savedGame.status !== "won" && savedGame.status !== "lost") {
          this.scene.start(SCENES.game, { resumeCurrentGame: true });
        } else {
          this.scene.start(SCENES.game, {
            mode: "daily",
            dealId: dailyDealId,
          });
        }
        return;
      }
      case "achievements":
        // v0.3.59: trophy в bottom-nav. launch+pause — MapScene.currentPage
        // сохраняется через Phaser pause/resume.
        getAppContext().analytics.track("achievements_open", { origin: "map" });
        this.scene.launch(SCENES.achievements, { returnTo: "map" });
        this.scene.pause();
        return;
      case "settings":
        // returnTo="map" явно — «← Назад» и клик по активной Settings вернут на карту.
        this.scene.start(SCENES.settings, { returnTo: "map" });
        return;
    }
  }

  private changePage(delta: -1 | 1): void {
    const { save, sound } = getAppContext();
    const progress = save.load().progress;
    const nextPage = this.currentPage + delta;

    if (!isRouteSheetUnlocked(nextPage, progress)) {
      return;
    }

    if (!getRouteSheetByPage(nextPage)) {
      return;
    }

    sound.pageTurn();
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

  private getPageLabel(locale: Parameters<typeof getRouteSheetTitle>[1], page: number): string {
    return getRouteSheetTitle(page, locale);
  }

  private getDealSerial(dealId: string): number {
    return ROUTE_SHEETS.flatMap((sheet) => sheet.dealIds).findIndex((id) => id === dealId) + 1;
  }

  private handleCurrentNodeClick(dealId: string): void {
    const { save } = getAppContext();
    const savedGame = save.load().currentGame;

    if (savedGame && savedGame.dealId === dealId && savedGame.status !== "won" && savedGame.status !== "lost") {
      this.showResumeDialog(dealId);
    } else {
      if (savedGame && savedGame.dealId === dealId) {
        save.clearCurrentGame();
      }
      this.scene.start(SCENES.game, { mode: "adventure", dealId });
    }
  }

  private showResumeDialog(dealId: string): void {
    const { i18n, save } = getAppContext();
    this.destroyResumeDialog();

    const host = this.overlay?.getHostElement();
    if (!host) return;

    // Глушим Phaser input на сцене карты, пока модалка открыта.
    // Иначе клик по кнопкам модалки может пробить через canvas в
    // hit-area соседней (пройденной) точки маршрута, и параллельно
    // со стартом GameScene уедет ещё и DetailScene с этой точкой —
    // в результате игрок видит запись из дневника поверх игры.
    this.input.enabled = false;

    const container = document.createElement("div");
    container.className = "game-overlay__rules-overlay";
    container.setAttribute("data-resume-overlay", "true");

    const backdrop = document.createElement("div");
    backdrop.className = "game-overlay__rules-backdrop";

    const panel = document.createElement("div");
    panel.className = "game-overlay__rules-panel";

    const title = document.createElement("h2");
    title.className = "game-overlay__rules-title";
    title.textContent = i18n.t("resumeTitle");

    const body = document.createElement("div");
    body.className = "modal__body";
    body.textContent = i18n.t("resumeBody");

    const buttons = document.createElement("div");
    buttons.className = "modal__buttons modal__buttons--row";

    const restartBtn = document.createElement("button");
    restartBtn.className = "modal-btn modal-btn--danger";
    restartBtn.type = "button";
    restartBtn.textContent = i18n.t("resumeRestart");
    restartBtn.addEventListener("click", () => {
      this.destroyResumeDialog();
      save.clearCurrentGame();
      this.scene.start(SCENES.game, { mode: "adventure", dealId });
    });

    const continueBtn = document.createElement("button");
    continueBtn.className = "modal-btn modal-btn--primary";
    continueBtn.type = "button";
    continueBtn.textContent = i18n.t("resumeContinue");
    continueBtn.addEventListener("click", () => {
      this.destroyResumeDialog();
      this.scene.start(SCENES.game, { resumeCurrentGame: true });
    });

    buttons.appendChild(restartBtn);
    buttons.appendChild(continueBtn);
    panel.appendChild(title);
    panel.appendChild(body);
    panel.appendChild(buttons);
    container.appendChild(backdrop);
    container.appendChild(panel);
    host.appendChild(container);

    backdrop.addEventListener("click", () => this.destroyResumeDialog());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      container.remove();
    });
  }

  private destroyResumeDialog(): void {
    // Возвращаем Phaser input после закрытия модалки (см. showResumeDialog).
    this.input.enabled = true;
    const host = this.overlay?.getHostElement();
    if (!host) return;
    const existing = host.querySelector('[data-resume-overlay="true"]');
    if (existing) {
      existing.remove();
    }
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

  /** DEV: mark current node as completed, advance to next */
  private devSkipNode(): void {
    const { save } = getAppContext();
    const progress = save.load().progress;
    const nextDealId = getNextPlayableDealId(progress);

    if (!nextDealId) {
      this.setStatus("All nodes completed");
      return;
    }

    save.completeNode(nextDealId);

    // Navigate to the page of the new current node
    const updatedProgress = save.load().progress;
    const newNext = getNextPlayableDealId(updatedProgress);
    const targetPage = newNext ? getRouteSheetByDealId(newNext)?.page ?? this.currentPage : this.currentPage;
    this.currentPage = targetPage;
    this.render();
  }

  /** DEV: uncomplete last completed node, step back */
  private devUnskipNode(): void {
    const { save } = getAppContext();
    const progress = save.load().progress;

    if (progress.completedNodes.length === 0) {
      this.setStatus("No nodes to undo");
      return;
    }

    const lastCompleted = progress.completedNodes[progress.completedNodes.length - 1]!;

    save.updateProgress((p) => {
      const completedNodes = p.completedNodes.filter((id) => id !== lastCompleted);
      // Keep unlocked: all completed + the next playable one
      const unlockedSet = new Set(completedNodes);
      // The first non-completed node becomes current — it should be unlocked
      const allDealIds = ROUTE_SHEETS.flatMap((sheet) => sheet.dealIds);
      const nextPlayable = allDealIds.find((id) => !unlockedSet.has(id));
      if (nextPlayable) {
        unlockedSet.add(nextPlayable);
      }
      return {
        ...p,
        completedNodes,
        unlockedNodes: [...unlockedSet],
      };
    });

    // Navigate to page with newly-current node
    const updatedProgress = save.load().progress;
    const newNext = getNextPlayableDealId(updatedProgress);
    const targetPage = newNext ? getRouteSheetByDealId(newNext)?.page ?? this.currentPage : this.currentPage;
    this.currentPage = targetPage;
    this.render();
  }
}
