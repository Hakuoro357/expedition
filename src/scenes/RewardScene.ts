import Phaser from "phaser";
import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { ECONOMY } from "@/app/config/economy";
import type { GameMode } from "@/core/game-state/types";
import { getNodeById } from "@/data/chapters";
import { getArtifactById } from "@/data/artifacts";
import { getDailyDateKey } from "@/data/dailyDeals";
import { createButton } from "@/ui/createButton";

export type RewardSceneData = {
  mode?: GameMode;
  dealId?: string;
};

export class RewardScene extends Phaser.Scene {
  constructor() {
    super(SCENES.reward);
  }

  create(data: RewardSceneData): void {
    const { ads, analytics, i18n, save, sound } = getAppContext();
    const mode = data.mode ?? "adventure";
    const dealId = data.dealId ?? "";

    // ── Apply rewards to save ────────────────────────────────────────────────
    let coinsAwarded = 0;
    let artifactAwarded: string | null = null;
    let chapterCompleted = false;

    if (mode === "adventure" && dealId) {
      const node = getNodeById(dealId);
      const progress = save.load().progress;

      // Only award if this node hasn't been completed yet
      if (!progress.completedNodes.includes(dealId)) {
        const result = save.completeNode(dealId, node?.artifactId);
        coinsAwarded = result.coinsAwarded;
        artifactAwarded = result.artifactAwarded;
        chapterCompleted = result.chapterCompleted;
      } else {
        // Replaying a completed node — give only base coins
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
      // Quick-play: just coins
      save.addCoins(ECONOMY.winCoins);
      coinsAwarded = ECONOMY.winCoins;
    }

    // Синхронизируем прогресс в облако после награды (fire & forget)
    void save.pushToCloud(getAppContext().sdk);

    sound.victory();
    analytics.track("deal_win_reward_applied", { mode, dealId, coinsAwarded, artifactAwarded });

    // ── Background ───────────────────────────────────────────────────────────
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x17302e);

    // ── Панель ─────────────────────────────────────────────────────────────
    const panelCX = GAME_WIDTH / 2;
    const panelTop = 160;
    const panelH = 460;
    const panelCY = panelTop + panelH / 2;
    this.add
      .rectangle(panelCX, panelCY, 340, panelH, 0x233d3a, 0.96)
      .setStrokeStyle(2, 0xdac9a1);

    // ── Title ────────────────────────────────────────────────────────────────
    this.add
      .text(panelCX, panelTop - 26, i18n.t("victory"), {
        fontFamily: "Georgia",
        fontSize: "36px",
        color: "#f8ebcf",
      })
      .setOrigin(0.5);

    // ── Декоративная линия под заголовком ─────────────────────────────────
    this.add
      .rectangle(panelCX, panelTop + 16, 200, 1, 0xdac9a1, 0.4);

    // ── Reward lines ─────────────────────────────────────────────────────────
    const rewardLines: string[] = [];

    if (coinsAwarded > 0) {
      rewardLines.push(`🪙 +${coinsAwarded} ${i18n.t("coins")}`);
    }

    if (artifactAwarded) {
      const artifact = getArtifactById(artifactAwarded);
      const name = i18n.currentLocale() === "ru"
        ? (artifact?.titleRu ?? artifactAwarded)
        : (artifact?.titleEn ?? artifactAwarded);
      const icon = artifact?.icon ?? "🏺";
      rewardLines.push(`${icon} ${name}`);
    }

    if (chapterCompleted) {
      rewardLines.push(`✨ ${i18n.t("chapterComplete")}`);
    }

    if (rewardLines.length === 0) {
      rewardLines.push(i18n.t("reward"));
    }

    // Награды — в верхней трети панели
    this.add
      .text(panelCX, panelTop + 70, rewardLines.join("\n"), {
        fontFamily: "Georgia",
        fontSize: "24px",
        color: "#e9d59a",
        align: "center",
        lineSpacing: 14,
      })
      .setOrigin(0.5);

    // ── Rewarded ad button ───────────────────────────────────────────────────
    let adBonusShown = false;
    const adBonus = mode === "daily" ? ECONOMY.dailyAdBonusCoins : ECONOMY.adBonusCoins;

    const adBtnY = panelCY + panelH / 2 - 130;
    const adStatusY = adBtnY + 36;

    createButton({
      scene: this,
      x: panelCX,
      y: adBtnY,
      width: 280,
      height: 50,
      label: `${i18n.t("watchAd")} (+${adBonus} ${i18n.t("coins")})`,
      onClick: async () => {
        if (adBonusShown) return;
        const rewarded = await ads.showRewardedVideo("post_win_bonus");
        if (rewarded) {
          save.addCoins(adBonus);
          adBonusShown = true;
          this.add
            .text(panelCX, adStatusY, `+${adBonus} ${i18n.t("coins")}!`, {
              fontFamily: "Georgia",
              fontSize: "18px",
              color: "#f0e4c4",
            })
            .setOrigin(0.5);
          sound.goodMove();
        }
      },
    });

    // ── Continue button ──────────────────────────────────────────────────────
    createButton({
      scene: this,
      x: panelCX,
      y: panelCY + panelH / 2 - 44,
      width: 280,
      height: 50,
      label: i18n.t("backToMap"),
      onClick: () => {
        analytics.track("reward_screen_continue", { dealId, mode });
        this.scene.start(SCENES.map);
      },
    });
  }
}
