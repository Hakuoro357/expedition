import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
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
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { createButton } from "@/ui/createButton";

export type RewardSceneData = {
  mode?: GameMode;
  dealId?: string;
  preview?: boolean;
};

type RewardNavTarget = "archive" | "daily" | "settings";

export class RewardScene extends Phaser.Scene {
  private rewardOverlay?: CanvasOverlayHandle;
  private rewardOverlayCleanup?: () => void;
  private rewardPrimaryButtons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super(SCENES.reward);
  }

  create(data: RewardSceneData): void {
    const { ads, analytics, i18n, save, sound } = getAppContext();
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
    if (preview) {
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
      } else {
        save.addCoins(ECONOMY.winCoins);
        coinsAwarded = ECONOMY.winCoins;
      }
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

    if (!preview) {
      void save.pushToCloud(getAppContext().sdk);
    }

    sound.victory();
    analytics.track("deal_win_reward_applied", { mode, dealId, rewardId, coinsAwarded, artifactAwarded, preview });

    this.renderBackground();

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

    let adStatusText = "";
    const renderOverlay = (): void => {
      this.renderRewardOverlay({
        title: i18n.t("victory"),
        coinsLabel: coinsAwarded > 0 ? `+${coinsAwarded} ${i18n.t("coins")}` : undefined,
        chapterProgressLabel,
        foundTitle: revealItems.length > 0 ? i18n.t("foundItems") : undefined,
        revealItems,
        rewardLines: revealItems.length > 0 ? [] : [i18n.t("reward")],
        adStatus: adStatusText,
        navItems: [
          { id: "archive", label: i18n.t("archive"), active: false },
          { id: "daily", label: i18n.t("daily"), active: false },
          { id: "settings", label: i18n.t("settings"), active: false },
        ],
      });
      this.bindOverlayEvents(revealItems, dealId, mode);
    };

    renderOverlay();

    let adBonusShown = false;
    const adBonus = mode === "daily" ? ECONOMY.dailyAdBonusCoins : ECONOMY.adBonusCoins;

    const continueButton = createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT - 44,
      width: 300,
      height: 42,
      label: i18n.t("continue"),
      onClick: () => {
        analytics.track("reward_screen_continue", { dealId, mode });
        this.scene.start(SCENES.map);
      },
    });

    const adButton = createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT - 92,
      width: 300,
      height: 42,
      label: isRu ? `Реклама (+${adBonus})` : `Ad (+${adBonus})`,
      onClick: async () => {
        if (adBonusShown) {
          return;
        }

        const rewarded = await ads.showRewardedVideo("post_win_bonus");
        if (!rewarded) {
          return;
        }

        save.addCoins(adBonus);
        adBonusShown = true;
        adStatusText = `+${adBonus} ${i18n.t("coins")}!`;
        renderOverlay();
        sound.goodMove();
      },
    });

    this.rewardPrimaryButtons = [adButton, continueButton];

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.rewardPrimaryButtons.forEach((button) => button.destroy());
      this.rewardPrimaryButtons = [];
      this.rewardOverlayCleanup?.();
      this.rewardOverlay?.destroy();
      this.rewardOverlay = undefined;
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

  private renderRewardOverlay(params: Parameters<typeof createRewardOverlayHtml>[0]): void {
    const html = createRewardOverlayHtml(params);

    if (!this.rewardOverlay) {
      this.rewardOverlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "reward-overlay-root",
        logicalWidth: GAME_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
      return;
    }

    this.rewardOverlay.setHtml(html);
  }

  private bindOverlayEvents(revealItems: RewardOverlayRevealItem[], dealId: string, mode: GameMode): void {
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
          origin: { scene: SCENES.reward, data: { mode, dealId } },
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
}
