import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import {
  GAME_CANVAS_WIDTH,
  GAME_HEIGHT,
  GAME_OFFSET_X,
  GAME_WIDTH,
  SCENES,
} from "@/app/config/gameConfig";
import { buildAchievementsViewModel } from "@/data/buildAchievementsViewModel";
import { createAchievementsSceneOverlayHtml } from "@/scenes/achievementsSceneOverlay";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";

/**
 * AchievementsScene — DOM-overlay со списком 20 ачивок в 6 группах.
 *
 * Launched via `scene.launch(...)` (parallel scene, не `scene.start`),
 * с одновременным `scene.pause()` на parent-сцене (TitleScene или MapScene).
 * Возврат — `scene.resume(parent); scene.stop()`.
 *
 * Data flow (v0.3.58 plan R1-C1):
 *   1. Compute-primary: первый render из ACHIEVEMENTS.compute() + save data.
 *      Синхронно, offline-capable.
 *   2. Async progressive enhancement: после await sdk.fetchAchievements()
 *      ре-рендерим с SDK-confirmed unlocked tags + progress.
 *   3. Lifecycle guard `isClosed` — если игрок закрыл overlay до того как
 *      SDK ответил, второй render-вызов пропускается.
 *   4. Scroll position preserved across re-renders.
 */

export type AchievementsSceneData = {
  /** Where back-button returns the player. Default: "title". */
  returnTo?: "title" | "map";
};

export class AchievementsScene extends Phaser.Scene {
  private overlay?: CanvasOverlayHandle;
  private overlayCleanup?: () => void;
  private returnTo: "title" | "map" = "title";
  private isClosed = false;

  constructor() {
    super(SCENES.achievements);
  }

  create(data?: AchievementsSceneData): void {
    this.returnTo = data?.returnTo ?? "title";
    this.isClosed = false;
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);

    this.renderBackground();
    // 1) compute-only initial render (offline-capable).
    this.renderFromCurrentState();

    // 2) async SDK confirmation → re-render с unlocked/progress confirmation.
    void this.fetchAndMerge();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.isClosed = true;
      this.overlayCleanup?.();
      this.overlayCleanup = undefined;
      this.overlay?.destroy();
      this.overlay = undefined;
    });
  }

  /**
   * Build VM from current save + supplied SDK data, then render.
   * If overlay exists, preserves scrollTop across the re-render (R3 xiaomi-MIN).
   */
  private renderFromCurrentState(
    sdkUnlockedTags: Set<string> = new Set(),
    sdkProgressByTag: Map<string, number> = new Map(),
  ): void {
    if (this.isClosed) return;
    const { i18n, save } = getAppContext();
    const { progress } = save.load();
    const vm = buildAchievementsViewModel({
      progress,
      sdkUnlockedTags,
      sdkProgressByTag,
      persistedUnlocked: progress.achievementUnlocked ?? {},
      persistedProgress: progress.achievementProgress ?? {},
      translate: (key) => i18n.t(key as Parameters<typeof i18n.t>[0]),
      hiddenTitlePlaceholder: "???",
    });

    const html = createAchievementsSceneOverlayHtml({
      title: i18n.t("achievements"),
      backLabel: i18n.t("back"),
      hiddenLabel: i18n.t("achievementsLocked"),
      groups: vm.groups,
    });

    // Preserve scrollTop across re-renders (R3 xiaomi-MIN).
    const prevScrollTop =
      this.overlay
        ?.getInnerElement()
        .querySelector<HTMLElement>(".achievements-overlay__scroll")
        ?.scrollTop ?? 0;

    if (!this.overlay) {
      this.overlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "achievements-scene-root",
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
    } else {
      this.overlay.setHtml(html);
    }

    // Restore scroll.
    const scrollEl = this.overlay
      .getInnerElement()
      .querySelector<HTMLElement>(".achievements-overlay__scroll");
    if (scrollEl) scrollEl.scrollTop = prevScrollTop;

    this.bindOverlayEvents();
  }

  /** Fetch GP achievements list, merge into VM, re-render. */
  private async fetchAndMerge(): Promise<void> {
    const { sdk } = getAppContext();
    if (!sdk.canUseAchievements()) return;
    try {
      await sdk.fetchAchievements();
      // R3 codex-M3: scene may have closed during await.
      if (this.isClosed) return;
      const list = sdk.getPlayerAchievements();
      const sdkUnlockedTags = new Set(
        list.filter((a) => a.unlocked).map((a) => a.tag),
      );
      const sdkProgressByTag = new Map(list.map((a) => [a.tag, a.progress]));
      this.renderFromCurrentState(sdkUnlockedTags, sdkProgressByTag);
    } catch (err) {
      if (this.isClosed) return;
      console.warn("[ach-ui] SDK confirmation failed", err);
    }
  }

  private bindOverlayEvents(): void {
    if (!this.overlay) return;
    this.overlayCleanup?.();
    const root = this.overlay.getInnerElement();
    const disposers: Array<() => void> = [];

    const backBtn = root.querySelector<HTMLElement>('[data-achievements-action="back"]');
    if (backBtn) {
      backBtn.style.pointerEvents = "auto";
      const onClick = (): void => this.closeAndReturn();
      backBtn.addEventListener("click", onClick);
      disposers.push(() => backBtn.removeEventListener("click", onClick));
    }

    // Backdrop click-outside also closes (extra UX).
    const backdrop = root.querySelector<HTMLElement>(".achievements-overlay__backdrop");
    if (backdrop) {
      backdrop.style.pointerEvents = "auto";
      // Inner content has its own click — only trigger close when click lands
      // directly on the backdrop, not bubbled from a card.
      const onBackdropClick = (event: MouseEvent): void => {
        if (event.target === backdrop) this.closeAndReturn();
      };
      backdrop.addEventListener("click", onBackdropClick);
      disposers.push(() => backdrop.removeEventListener("click", onBackdropClick));
    }

    this.overlayCleanup = () => disposers.forEach((d) => d());
  }

  private closeAndReturn(): void {
    // resume parent scene before stopping self (avoids one-frame blank).
    const parent = this.returnTo === "map" ? SCENES.map : SCENES.title;
    this.scene.resume(parent);
    this.scene.stop();
  }

  private renderBackground(): void {
    // Тёмно-теаловый градиент (без коллажа). Backdrop сверху затемнит ещё
    // — это backup на случай если parent scene не успела paused-snapshot'нуться.
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a1e1c, 0x0a1e1c, 0x10201f, 0x162e2c, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}
