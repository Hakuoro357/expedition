import Phaser from "phaser";

import { getAppContext } from "@/app/config/appContext";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { ECONOMY } from "@/app/config/economy";
import type { GameMode } from "@/core/game-state/types";
import { CHAPTERS, getNodeById } from "@/data/chapters";
import { getDailyDateKey } from "@/data/dailyDeals";
import { getChapterTitle } from "@/data/naming";
import { getRewardById } from "@/data/narrative/rewards";
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
import { COIN_TOKEN } from "@/ui/coinIcon";

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
  // Состояние сцены, которое может меняться после первого рендера
  // (например, после просмотра rewarded video). Раньше эти переменные
  // жили в замыкании create() и приводили к stale-render после ad watch.
  private mode: GameMode = "adventure";
  private dealId = "";
  private preview = false;
  private coinsAwarded = 0;
  private adBonusShown = false;
  private adStatusText = "";
  private revealItems: RewardOverlayRevealItem[] = [];
  private chapterProgressLabel: string | undefined;

  constructor() {
    super(SCENES.reward);
  }

  create(data: RewardSceneData): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    const { analytics, i18n, save, sound } = getAppContext();
    sound.playBgm("map");
    // Сбрасываем мутируемое состояние при каждом входе в сцену.
    this.mode = data.mode ?? "adventure";
    this.dealId = data.dealId ?? "";
    this.preview = data.preview === true;
    this.coinsAwarded = 0;
    this.adBonusShown = false;
    this.adStatusText = "";
    this.revealItems = [];
    this.chapterProgressLabel = undefined;

    const { mode, dealId, preview } = this;
    const isRu = i18n.currentLocale() === "ru";
    const narrativeLocale = i18n.getNarrativeLocale();
    const node = dealId ? getNodeById(dealId) : undefined;
    const chapter = node ? CHAPTERS.find((item) => item.id === node.chapter) : undefined;

    let rewardId: string | null = null;
    let artifactAwarded: string | null = null;
    if (data.returnFromDetail) {
      // Возврат из карточки записи/артефакта: награды уже начислены
      // и пушнуты в облако при первом показе. Просто восстанавливаем
      // отображение reveal-items по данным узла, без мутаций сейва.
      //
      // Важно: artifactAwarded берём через ту же цепочку, что и
      // completeNode / buildRewardRevealItems (`reward.collectibleArtifactId`
      // с fallback на `node.artifactId`). Без этого, если у reward задан
      // свой collectibleArtifactId, отличный от node.artifactId, реальный
      // initial artifactAwarded не совпадёт с expectedArtifactId при
      // проверке в buildRewardRevealItems и артефакт исчезнет с экрана.
      if (mode === "adventure" && node) {
        rewardId = node.rewardId ?? null;
        const reward = rewardId ? getRewardById(rewardId) : undefined;
        artifactAwarded = reward?.collectibleArtifactId ?? node.artifactId ?? null;
      }
    } else if (preview) {
      if (mode === "adventure" && node) {
        rewardId = node.rewardId ?? null;
        artifactAwarded = node.artifactId ?? null;
        this.coinsAwarded = ECONOMY.winCoins;
      } else if (mode === "daily") {
        this.coinsAwarded = ECONOMY.dailyWinCoins;
      } else {
        this.coinsAwarded = ECONOMY.winCoins;
      }
    } else if (mode === "adventure" && dealId) {
      const progress = save.load().progress;

      if (!progress.completedNodes.includes(dealId)) {
        const result = save.completeNode(dealId, node?.artifactId);
        rewardId = result.rewardId;
        this.coinsAwarded = result.coinsAwarded;
        artifactAwarded = result.artifactAwarded;
      } else if (node) {
        // Replay (или повторный вход в RewardScene на этой партии):
        // монет не начисляем, но reveal items восстанавливаем по узлу,
        // иначе экран победы оказывается пустым.
        rewardId = node.rewardId ?? null;
        artifactAwarded = node.artifactId ?? null;
      }
    } else if (mode === "daily") {
      const dateKey = getDailyDateKey();
      const progress = save.load().progress;

      if (progress.dailyClaimedOn !== dateKey) {
        save.claimDaily(dateKey);
        this.coinsAwarded = ECONOMY.dailyWinCoins;
      }
    } else {
      save.addCoins(ECONOMY.winCoins);
      this.coinsAwarded = ECONOMY.winCoins;
    }

    if (!preview && !data.returnFromDetail) {
      // gp.player — единственный источник истины; flush форсирует sync
      // награды в облако до перехода на следующую сцену.
      void save.flush();
    }

    if (!data.returnFromDetail) {
      sound.victory();
    }
    analytics.track("deal_win_reward_applied", {
      mode,
      dealId,
      rewardId,
      coinsAwarded: this.coinsAwarded,
      artifactAwarded,
      preview,
    });

    this.renderBackground(dealId);

    this.revealItems =
      mode === "adventure" && dealId && rewardId
        ? buildRewardRevealItems({
            dealId,
            rewardId,
            artifactAwarded,
            locale: narrativeLocale,
            // Локализованные бейджи «Запись»/«Артефакт» для всех 7 UI-локалей.
            entryBadgeLabel: i18n.t("tabEntry"),
            artifactBadgeLabel: i18n.t("tabArtifact"),
          })
        : [];

    const updatedProgress = save.load().progress;
    const chapterCompletedNodes = chapter
      ? preview
        ? Math.max(node?.nodeIndex ?? 0, 0) + 1
        : chapter.nodes.filter((chapterNode) => updatedProgress.completedNodes.includes(chapterNode.id)).length
      : 0;
    this.chapterProgressLabel = chapter
      ? `${i18n.t("chapter")} ${chapter.id}: ${getChapterTitle(chapter.chapterId, isRu ? "ru" : "en")} • ${chapterCompletedNodes}/${chapter.nodes.length}`
      : undefined;

    this.renderOverlay();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.rewardOverlayCleanup?.();
      this.rewardOverlayCleanup = undefined;
      this.rewardOverlay?.destroy();
      this.rewardOverlay = undefined;
    });
  }

  private renderOverlay(): void {
    const { i18n } = getAppContext();
    const adBonus = this.mode === "daily" ? ECONOMY.dailyAdBonusCoins : ECONOMY.adBonusCoins;

    this.renderRewardOverlay({
      title: i18n.t("victory"),
      coinsLabel: this.coinsAwarded > 0 ? `+${this.coinsAwarded} ${COIN_TOKEN}` : undefined,
      chapterProgressLabel: this.chapterProgressLabel,
      foundTitle: this.revealItems.length > 0 ? i18n.t("foundItems") : undefined,
      revealItems: this.revealItems,
      rewardLines: this.revealItems.length > 0 ? [] : [i18n.t("reward")],
      adLabel: `${i18n.t("adLabel")} (+${adBonus} ${COIN_TOKEN})`,
      adDisabled: this.adBonusShown,
      continueLabel: i18n.t("continue"),
      adStatus: this.adStatusText,
      navItems: [
        { id: "archive", label: i18n.t("archive"), active: false },
        { id: "daily", label: i18n.t("daily"), active: false },
        { id: "settings", label: i18n.t("menu"), active: false },
      ],
    });
    this.bindOverlayEvents();
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

  private bindOverlayEvents(): void {
    if (!this.rewardOverlay) {
      return;
    }

    const { ads, analytics, save, sound } = getAppContext();
    const root = this.rewardOverlay.getInnerElement();
    this.rewardOverlayCleanup?.();
    const disposers: Array<() => void> = [];
    const { mode, dealId, preview } = this;

    root.querySelectorAll<HTMLElement>("[data-reveal-id]").forEach((element) => {
      const revealId = element.dataset.revealId;
      if (!revealId) {
        return;
      }

      const item = this.revealItems.find((candidate) => candidate.id === revealId);
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

    const adBtn = root.querySelector<HTMLElement>("[data-reward-ad]");
    if (adBtn) {
      const adBonus = this.mode === "daily" ? ECONOMY.dailyAdBonusCoins : ECONOMY.adBonusCoins;
      adBtn.style.pointerEvents = "auto";
      const onAdClick = async (): Promise<void> => {
        if (this.adBonusShown) return;
        const rewarded = await ads.showRewardedVideo("post_win_bonus");
        if (!rewarded) return;
        save.addCoins(adBonus);
        // Явный sync в gp.player — требование тестировщика: монеты от
        // rewarded-видео должны персиститься сразу после начисления.
        await save.flush();
        this.adBonusShown = true;
        this.adStatusText = `+${adBonus} ${COIN_TOKEN}`;
        sound.goodMove();
        // Полный перерендер: renderOverlay сам пере-биндит обработчики,
        // переписывая rewardOverlayCleanup.
        this.renderOverlay();
      };
      adBtn.addEventListener("click", onAdClick);
      disposers.push(() => adBtn.removeEventListener("click", onAdClick));
    }

    const continueBtn = root.querySelector<HTMLElement>("[data-reward-continue]");
    if (continueBtn) {
      continueBtn.style.pointerEvents = "auto";
      const onContinue = (): void => {
        analytics.track("reward_screen_continue", { dealId, mode });
        this.scene.start(SCENES.map);
      };
      continueBtn.addEventListener("click", onContinue);
      disposers.push(() => continueBtn.removeEventListener("click", onContinue));
    }

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
        // Возврат в этот же экран наград восстановит reveal-items через
        // returnFromDetail=true (см. SettingsScene.handleGoBack "reward").
        this.scene.start(SCENES.settings, {
          returnTo: "reward",
          rewardData: {
            mode: this.mode,
            dealId: this.dealId,
            preview: this.preview || undefined,
          },
        });
        return;
    }
  }
}
