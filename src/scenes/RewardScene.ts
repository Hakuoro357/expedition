import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { ECONOMY } from "@/app/config/economy";
import type { GameMode } from "@/core/game-state/types";
import { CHAPTERS, getNodeById } from "@/data/chapters";
import { getDailyDateKey } from "@/data/dailyDeals";
import { getChapterTitle } from "@/data/naming";
import {
  buildRewardRevealItems,
} from "@/scenes/rewardRevealItems";
import {
  createRewardOverlayHtml,
  type RewardOverlayRevealItem,
} from "@/scenes/rewardSceneOverlay";
import { ROUTE_BOTTOM_NAV_HEIGHT } from "@/scenes/routeSceneLayout";
import { getRouteSheetByDealId, ROUTE_SHEETS } from "@/data/routeSheets";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";

export type RewardSceneData = {
  mode?: GameMode;
  dealId?: string;
  preview?: boolean;
  /** Set when returning from detail view — skips sound and save logic */
  returnFromDetail?: boolean;
};

type RewardNavTarget = "archive" | "daily" | "settings";

export class RewardScene extends Phaser.Scene {
  private rewardOverlay?: CanvasOverlayHandle;
  private rewardOverlayCleanup?: () => void;

  constructor() {
    super(SCENES.reward);
  }

  create(data: RewardSceneData): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    const { ads, analytics, i18n, save, sound } = getAppContext();
    sound.playBgm("map");
    const mode = data.mode ?? "adventure";
    const dealId = data.dealId ?? "";
    const preview = data.preview === true;
    const isRu = i18n.currentLocale() === "ru";
    const narrativeLocale = i18n.getNarrativeLocale();
    const node = dealId ? getNodeById(dealId) : undefined;
    const chapter = node ? CHAPTERS.find((item) => item.id === node.chapter) : undefined;

    let coinsAwarded = 0;
    let rewardId: string | null = null;
    let artifactAwarded: string | null = null;
    if (data.returnFromDetail) {
      // Возврат из карточки записи/артефакта: награды уже начислены
      // и пушнуты в облако при первом показе. Просто восстанавливаем
      // отображение reveal-items по данным узла, без мутаций сейва.
      if (mode === "adventure" && node) {
        rewardId = node.rewardId ?? null;
        artifactAwarded = node.artifactId ?? null;
      }
    } else if (preview) {
      if (mode === "adventure" && node) {
        rewardId = node.rewardId ?? null;
        artifactAwarded = node.artifactId ?? null;
        coinsAwarded = ECONOMY.winCoins;
      } else if (mode === "daily") {
        coinsAwarded = ECONOMY.dailyWinCoins;
      } else {
        coinsAwarded = ECONOMY.winCoins;
      }
    } else if (mode === "adventure" && dealId) {
      const progress = save.load().progress;

      if (!progress.completedNodes.includes(dealId)) {
        const result = save.completeNode(dealId, node?.artifactId);
        rewardId = result.rewardId;
        coinsAwarded = result.coinsAwarded;
        artifactAwarded = result.artifactAwarded;
      }
      // Replaying an already-completed node: no coins, no reward re-grant.
    } else if (mode === "daily") {
      const dateKey = getDailyDateKey();
      const progress = save.load().progress;

      if (progress.dailyClaimedOn !== dateKey) {
        save.claimDaily(dateKey);
        coinsAwarded = ECONOMY.dailyWinCoins;
      }
    } else {
      save.addCoins(ECONOMY.winCoins);
      coinsAwarded = ECONOMY.winCoins;
    }

    if (!preview && !data.returnFromDetail) {
      void save.pushToCloud(getAppContext().sdk);
    }

    if (!data.returnFromDetail) {
      sound.victory();
    }
    analytics.track("deal_win_reward_applied", { mode, dealId, rewardId, coinsAwarded, artifactAwarded, preview });

    this.renderBackground(dealId);

    const revealItems =
      mode === "adventure" && dealId && rewardId
        ? buildRewardRevealItems({
            dealId,
            rewardId,
            artifactAwarded,
            locale: narrativeLocale,
          })
        : [];

    const updatedProgress = save.load().progress;
    const chapterCompletedNodes = chapter
      ? preview
        ? Math.max(node?.nodeIndex ?? 0, 0) + 1
        : chapter.nodes.filter((chapterNode) => updatedProgress.completedNodes.includes(chapterNode.id)).length
      : 0;
    const chapterProgressLabel = chapter
      ? `${i18n.t("chapter")} ${chapter.id}: ${getChapterTitle(chapter.chapterId, isRu ? "ru" : "en")} • ${chapterCompletedNodes}/${chapter.nodes.length}`
      : undefined;

    const adBonus = mode === "daily" ? ECONOMY.dailyAdBonusCoins : ECONOMY.adBonusCoins;
    let adBonusShown = false;
    let adStatusText = "";

    const renderOverlay = (): void => {
      this.renderRewardOverlay({
        title: i18n.t("victory"),
        coinsLabel: coinsAwarded > 0 ? `+${coinsAwarded} 🪙` : undefined,
        chapterProgressLabel,
        foundTitle: revealItems.length > 0 ? i18n.t("foundItems") : undefined,
        revealItems,
        rewardLines: revealItems.length > 0 ? [] : [i18n.t("reward")],
        adLabel: isRu ? `Реклама (+${adBonus} 🪙)` : `Ad (+${adBonus} 🪙)`,
        adDisabled: adBonusShown,
        continueLabel: i18n.t("continue"),
        adStatus: adStatusText,
        navItems: [
          { id: "archive", label: i18n.t("archive"), active: false },
          { id: "daily", label: i18n.t("daily"), active: false },
          { id: "settings", label: i18n.t("settings"), active: false },
        ],
      });
      this.bindOverlayEvents(revealItems, dealId, mode, preview);
    };

    renderOverlay();

    // Bind button events via DOM
    const bindButtonEvents = (): void => {
      const root = this.rewardOverlay?.getInnerElement();
      if (!root) return;

      const adBtn = root.querySelector<HTMLElement>("[data-reward-ad]");
      if (adBtn) {
        adBtn.style.pointerEvents = "auto";
        adBtn.addEventListener("click", async () => {
          if (adBonusShown) return;
          const rewarded = await ads.showRewardedVideo("post_win_bonus");
          if (!rewarded) return;
          save.addCoins(adBonus);
          adBonusShown = true;
          adStatusText = `+${adBonus} 🪙`;
          renderOverlay();
          bindButtonEvents();
          sound.goodMove();
        });
      }

      const continueBtn = root.querySelector<HTMLElement>("[data-reward-continue]");
      if (continueBtn) {
        continueBtn.style.pointerEvents = "auto";
        continueBtn.addEventListener("click", () => {
          analytics.track("reward_screen_continue", { dealId, mode });
          this.scene.start(SCENES.map);
        });
      }
    };
    bindButtonEvents();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.rewardOverlayCleanup?.();
      this.rewardOverlay?.destroy();
      this.rewardOverlay = undefined;
    });
  }

  private renderBackground(dealId: string): void {
    const sheet = getRouteSheetByDealId(dealId) ?? ROUTE_SHEETS[0];
    const { topColor, bottomColor, glowColor } = sheet.background;

    const bg = this.add.graphics();
    bg.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    bg.fillStyle(glowColor, 0.18);
    bg.fillEllipse(GAME_WIDTH / 2, 148, 320, 164);
    bg.fillStyle(glowColor, 0.1);
    bg.fillEllipse(GAME_WIDTH / 2, 332, 360, 220);

    const navBar = this.add.graphics();
    navBar.fillStyle(0x10201f, 0.96);
    navBar.lineStyle(1, 0x4f6964, 0.35);
    navBar.fillRect(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, ROUTE_BOTTOM_NAV_HEIGHT);
    navBar.strokeLineShape(
      new Phaser.Geom.Line(0, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT, GAME_WIDTH, GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT),
    );
  }

  private renderRewardOverlay(params: Parameters<typeof createRewardOverlayHtml>[0]): void {
    const html = createRewardOverlayHtml(params);

    if (!this.rewardOverlay) {
      this.rewardOverlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "reward-overlay-root",
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
      return;
    }

    this.rewardOverlay.setHtml(html);
  }

  private bindOverlayEvents(revealItems: RewardOverlayRevealItem[], dealId: string, mode: GameMode, preview: boolean): void {
    if (!this.rewardOverlay) {
      return;
    }

    const root = this.rewardOverlay.getInnerElement();
    this.rewardOverlayCleanup?.();
    const disposers: Array<() => void> = [];

    root.querySelectorAll<HTMLElement>("[data-reveal-id]").forEach((element) => {
      const revealId = element.dataset.revealId;
      if (!revealId) {
        return;
      }

      const item = revealItems.find((candidate) => candidate.id === revealId);
      if (!item) {
        return;
      }

      const onClick = (): void => {
        this.scene.start(SCENES.detail, {
          dealId,
          initialTab: item.type === "artifact" ? "artifact" : "entry",
          origin: { scene: SCENES.reward, data: { mode, dealId, preview: preview || undefined, returnFromDetail: true } },
        });
      };

      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    root.querySelectorAll<HTMLElement>("[data-app-nav]").forEach((element) => {
      const target = element.dataset.appNav as RewardNavTarget | undefined;
      if (!target) {
        return;
      }

      const onClick = (): void => this.handleBottomNav(target);
      element.style.pointerEvents = "auto";
      element.addEventListener("click", onClick);
      disposers.push(() => element.removeEventListener("click", onClick));
    });

    this.rewardOverlayCleanup = () => {
      disposers.forEach((dispose) => dispose());
    };
  }

  private handleBottomNav(target: RewardNavTarget): void {
    const { save } = getAppContext();

    switch (target) {
      case "archive":
        this.scene.start(SCENES.diary);
        return;
      case "daily": {
        const saveState = save.load();
        const progress = saveState.progress;
        const dailyKey = getDailyDateKey();

        if (progress.dailyClaimedOn === dailyKey) {
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
      case "settings":
        this.scene.start(SCENES.settings);
        return;
    }
  }
}
