import Phaser from "phaser";
import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { CHAPTERS, getNodeById } from "@/data/chapters";
import { getDailyDateKey } from "@/data/dailyDeals";
import { createButton } from "@/ui/createButton";

export class MapScene extends Phaser.Scene {
  constructor() {
    super(SCENES.map);
  }

  create(): void {
    const { analytics, i18n, save, sound } = getAppContext();
    const state = save.load();
    const { progress } = state;
    analytics.track("map_open", { chapter: progress.currentChapter });

    const hasSavedGame = state.currentGame !== null;
    const chapter = CHAPTERS.find((c) => c.id === progress.currentChapter) ?? CHAPTERS[0];
    const nodes = chapter?.nodes ?? [];

    const dailyKey = getDailyDateKey();
    const dailyClaimed = progress.dailyClaimedOn === dailyKey;

    // ── Background ─────────────────────────────────────────────────────────────
    const bgKey = `bg-chapter${progress.currentChapter}`;
    if (this.textures.exists(bgKey)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setAlpha(0.9);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x17312f);
    }

    // ── Title ──────────────────────────────────────────────────────────────────
    this.add
      .text(GAME_WIDTH / 2, 64, i18n.t("title"), {
        fontFamily: "Georgia",
        fontSize: "26px",
        color: "#f6e8c7",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 100, i18n.t("subtitle"), {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#d9ceb0",
        align: "center",
        wordWrap: { width: 300 },
      })
      .setOrigin(0.5);

    // ── Coin display ───────────────────────────────────────────────────────────
    this.add
      .text(GAME_WIDTH - 16, 64, `🪙 ${progress.coins}`, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f0d97a",
      })
      .setOrigin(1, 0.5);

    // ── Chapter header ─────────────────────────────────────────────────────────
    const chapterTitle = i18n.currentLocale() === "ru"
      ? (chapter?.titleRu ?? "")
      : (chapter?.titleEn ?? "");

    this.add
      .text(GAME_WIDTH / 2, 138, `${i18n.t("chapter")} ${progress.currentChapter}: ${chapterTitle}`, {
        fontFamily: "Georgia",
        fontSize: "17px",
        color: "#f6e8c7",
      })
      .setOrigin(0.5);

    // ── Progress bar ───────────────────────────────────────────────────────────
    const completedInChapter = nodes.filter((n) =>
      progress.completedNodes.includes(n.id)
    ).length;
    const progressRatio = completedInChapter / Math.max(nodes.length, 1);

    this.add.rectangle(GAME_WIDTH / 2, 162, 280, 8, 0x1c3c3a).setStrokeStyle(1, 0x5a7e79);
    this.add.rectangle(
      28 + (280 * progressRatio) / 2,
      162,
      280 * progressRatio,
      8,
      0xe3a34f
    );

    this.add
      .text(GAME_WIDTH / 2, 177, `${completedInChapter} / ${nodes.length}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ceb88e",
      })
      .setOrigin(0.5);

    // ── Adventure map route ────────────────────────────────────────────────────
    const mapTop = 210;
    const mapBottom = 430;
    const mapLeft = 56;
    const mapRight = GAME_WIDTH - 56;

    // Only show a sliding window of 5 nodes centered on current progress
    const firstUnfinishedIdx = nodes.findIndex(
      (n) => !progress.completedNodes.includes(n.id)
    );
    const windowStart = Math.max(0, Math.min(firstUnfinishedIdx - 1, nodes.length - 5));
    const windowNodes = nodes.slice(windowStart, windowStart + 5);

    const points = windowNodes.map((_, idx) => {
      const t = windowNodes.length === 1 ? 0.5 : idx / (windowNodes.length - 1);
      const x = mapLeft + t * (mapRight - mapLeft);
      // Slight wave pattern
      const wave = Math.sin(t * Math.PI * 1.5) * 40;
      const y = mapTop + (mapBottom - mapTop) * t + wave;
      return { x, y };
    });

    // Draw path lines
    if (points.length > 1) {
      const graphics = this.add.graphics({
        lineStyle: { width: 3, color: 0xd8c59d, alpha: 0.6 },
      });
      graphics.strokePoints(points.map((p) => new Phaser.Geom.Point(p.x, p.y)));
    }

    // Draw node circles
    windowNodes.forEach((node, idx) => {
      const pt = points[idx];
      if (!pt) return;

      const isCompleted = progress.completedNodes.includes(node.id);
      const isUnlocked = progress.unlockedNodes.includes(node.id);
      const isCurrent = !isCompleted && isUnlocked;

      const fill = isCompleted ? 0x4e9f7c : isCurrent ? 0xe3a34f : 0x2d4a47;
      const radius = isCurrent ? 22 : 16;

      this.add.circle(pt.x, pt.y, radius, fill).setStrokeStyle(2, 0xf2e8ce);

      const icon = isCompleted ? "✓" : isCurrent ? "★" : String(windowStart + idx + 1);
      this.add
        .text(pt.x, pt.y, icon, {
          fontFamily: "Georgia",
          fontSize: isCurrent ? "18px" : "14px",
          color: "#f2e8ce",
        })
        .setOrigin(0.5);

      // Make current node interactive
      if (isCurrent) {
        const hitArea = this.add
          .circle(pt.x, pt.y, radius + 6, 0xffffff, 0)
          .setInteractive();
        hitArea.on("pointerdown", () => {
          sound.cardPlace();
          this.scene.start(SCENES.game, { mode: "adventure", dealId: node.id });
        });
      }
    });

    // ── Buttons ────────────────────────────────────────────────────────────────
    const buttonY = 480;

    if (hasSavedGame) {
      createButton({
        scene: this,
        x: GAME_WIDTH / 2,
        y: buttonY,
        width: 230,
        height: 52,
        label: i18n.t("continue"),
        onClick: () => {
          this.scene.start(SCENES.game, { resumeCurrentGame: true });
        },
      });
    }

    // Determine current adventure node to play
    const currentNodeId =
      progress.unlockedNodes.find((id) => !progress.completedNodes.includes(id)) ?? "c1n1";
    const currentNode = getNodeById(currentNodeId);

    createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: buttonY + (hasSavedGame ? 64 : 0),
      width: 230,
      height: 52,
      label: i18n.t("play"),
      onClick: () => {
        if (!currentNode) return;
        sound.cardPlace();
        this.scene.start(SCENES.game, {
          mode: "adventure",
          dealId: currentNode.id,
        });
      },
    });

    const dailyLabel = dailyClaimed
      ? `${i18n.t("daily")} ✓`
      : i18n.t("daily");

    createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: buttonY + (hasSavedGame ? 128 : 64),
      width: 230,
      height: 52,
      label: dailyLabel,
      onClick: () => {
        if (dailyClaimed) {
          this.setStatus(i18n.t("dailyAlreadyClaimed"));
          return;
        }
        sound.cardPlace();
        this.scene.start(SCENES.game, {
          mode: "daily",
          dealId: `daily-${dailyKey}`,
        });
      },
    });

    createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: buttonY + (hasSavedGame ? 192 : 128),
      width: 230,
      height: 52,
      label: i18n.t("diary"),
      onClick: () => {
        this.scene.start(SCENES.diary);
      },
    });

    createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: buttonY + (hasSavedGame ? 256 : 192),
      width: 230,
      height: 52,
      label: i18n.t("settings"),
      onClick: () => {
        this.scene.start(SCENES.settings);
      },
    });
  }

  private _statusText?: Phaser.GameObjects.Text;

  private setStatus(msg: string): void {
    if (!this._statusText) {
      this._statusText = this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, msg, {
          fontFamily: "Georgia",
          fontSize: "14px",
          color: "#ceb88e",
        })
        .setOrigin(0.5);
    } else {
      this._statusText.setText(msg);
    }
  }
}
