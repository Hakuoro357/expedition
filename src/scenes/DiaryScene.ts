import Phaser from "phaser";
import { getAppContext } from "@/app/config/appContext";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { ARTIFACTS } from "@/data/artifacts";
import { CHAPTERS } from "@/data/chapters";
import { createButton } from "@/ui/createButton";

export class DiaryScene extends Phaser.Scene {
  constructor() {
    super(SCENES.diary);
  }

  create(): void {
    const { i18n, save } = getAppContext();
    const { progress } = save.load();
    const isRu = i18n.currentLocale() === "ru";

    const totalNodes = CHAPTERS.reduce((sum, c) => sum + c.nodes.length, 0);
    const completedNodes = progress.completedNodes.length;

    // ── Background ─────────────────────────────────────────────────────────────
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1a2e2b);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 360, GAME_HEIGHT - 40, 0x223530, 0.96)
      .setStrokeStyle(2, 0xdac9a1);

    // ── Title ──────────────────────────────────────────────────────────────────
    this.add
      .text(GAME_WIDTH / 2, 52, i18n.t("diary"), {
        fontFamily: "Georgia",
        fontSize: "26px",
        color: "#f6e8c7",
      })
      .setOrigin(0.5);

    // ── Stats row ──────────────────────────────────────────────────────────────
    this.add
      .text(GAME_WIDTH / 2, 90, `🪙 ${progress.coins}`, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#f0d97a",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 112, `${i18n.t("chapter")} ${progress.currentChapter}  •  ${completedNodes}/${totalNodes}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ceb88e",
      })
      .setOrigin(0.5);

    // ── Separator ──────────────────────────────────────────────────────────────
    this.add.rectangle(GAME_WIDTH / 2, 132, 300, 1, 0xdac9a1, 0.4);

    // ── Artifacts grid ─────────────────────────────────────────────────────────
    const colCount = 3;
    const cellW = 108;
    const cellH = 110;
    const gridStartY = 148;
    const gridLeft = GAME_WIDTH / 2 - (colCount * cellW) / 2 + cellW / 2;

    ARTIFACTS.forEach((artifact, idx) => {
      const col = idx % colCount;
      const row = Math.floor(idx / colCount);
      const cx = gridLeft + col * cellW;
      const cy = gridStartY + row * cellH + cellH / 2;

      const collected = progress.artifacts.includes(artifact.id);
      const alpha = collected ? 1 : 0.35;

      // Ячейка
      this.add
        .rectangle(cx, cy, cellW - 6, cellH - 6, collected ? 0x2d4e45 : 0x1c3531, 1)
        .setStrokeStyle(1, 0xdac9a1, collected ? 0.7 : 0.25);

      // Иконка (только текст, без emoji — стабильнее при высоком resolution)
      this.add
        .text(cx, cy - 22, artifact.icon, { fontSize: "28px" })
        .setOrigin(0.5)
        .setAlpha(alpha);

      if (!collected) {
        // Замок поверх иконки
        this.add
          .rectangle(cx, cy - 22, 22, 22, 0x000000, 0.55)
          .setOrigin(0.5);
        this.add
          .text(cx, cy - 22, "🔒", { fontSize: "14px" })
          .setOrigin(0.5)
          .setAlpha(0.9);
      }

      // Название — используем wordWrap вместо ручного обрезания
      const name = isRu ? artifact.titleRu : artifact.titleEn;
      this.add
        .text(cx, cy + 16, name, {
          fontFamily: "Georgia",
          fontSize: "10px",
          color: collected ? "#f0e4c4" : "#7a9490",
          align: "center",
          wordWrap: { width: cellW - 10 },
        })
        .setOrigin(0.5)
        .setAlpha(alpha);
    });

    // ── Separator ──────────────────────────────────────────────────────────────
    const chapSepY = gridStartY + Math.ceil(ARTIFACTS.length / colCount) * cellH + 8;
    this.add.rectangle(GAME_WIDTH / 2, chapSepY, 300, 1, 0xdac9a1, 0.4);

    // ── Chapter progress ───────────────────────────────────────────────────────
    CHAPTERS.forEach((chapter, idx) => {
      const nodesCompleted = chapter.nodes.filter((n) =>
        progress.completedNodes.includes(n.id)
      ).length;
      const chapterTitle = isRu ? chapter.titleRu : chapter.titleEn;
      const y = chapSepY + 20 + idx * 30;

      this.add
        .text(24, y, `${i18n.t("chapter")} ${chapter.id}: ${chapterTitle}`, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#d9ceb0",
        })
        .setOrigin(0, 0.5);

      this.add
        .text(GAME_WIDTH - 24, y, `${nodesCompleted}/${chapter.nodes.length}`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: nodesCompleted === chapter.nodes.length ? "#4e9f7c" : "#ceb88e",
        })
        .setOrigin(1, 0.5);
    });

    // ── Back button ────────────────────────────────────────────────────────────
    createButton({
      scene: this,
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 52,
      width: 200,
      height: 46,
      label: i18n.t("backToMap"),
      onClick: () => {
        this.scene.start(SCENES.map);
      },
    });
  }
}
