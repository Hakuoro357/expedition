import Phaser from "phaser";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT, GAME_OFFSET_X, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { getDevActionLinks, getGameEndPreviewLinks, getRewardPreviewLinks } from "@/scenes/devPreview";
import { createButtonLabelsOverlayHtml } from "@/ui/buttonLabelsOverlay";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { createButton } from "@/ui/createButton";

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

export class DevPreviewScene extends Phaser.Scene {
  private buttonsOverlay?: CanvasOverlayHandle;

  constructor() {
    super(SCENES.devPreview);
  }

  create(): void {
    this.cameras.main.setScroll(-GAME_OFFSET_X, 0);
    const baseUrl = getBaseUrl();
    const rewardLinks = getRewardPreviewLinks(baseUrl);
    const gameEndLinks = getGameEndPreviewLinks(baseUrl);

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x17302e);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 340, GAME_HEIGHT - 80, 0x223530, 0.96)
      .setStrokeStyle(2, 0xdac9a1);

    this.add
      .text(GAME_WIDTH / 2, 60, "Dev Preview", {
        fontFamily: "Georgia",
        fontSize: "28px",
        color: "#f8ebcf",
      })
      .setOrigin(0.5);

    // Section: Game End Screens
    this.add
      .text(GAME_WIDTH / 2, 110, "Экраны окончания игры", {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#d9ceb0",
      })
      .setOrigin(0.5);

    const allSpecs: Array<{ label: string; url: string; x: number; y: number; width: number; height: number }> = [];

    gameEndLinks.forEach((link, index) => {
      const spec = {
        ...link,
        x: GAME_WIDTH / 2,
        y: 155 + index * 44,
        width: 280,
        height: 34,
      };
      allSpecs.push(spec);
      createButton({
        scene: this,
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        label: spec.label,
        hideLabel: true,
        onClick: () => {
          window.location.assign(spec.url);
        },
      });
    });

    // Section: Reward Previews
    const rewardSectionY = 155 + gameEndLinks.length * 44 + 20;
    this.add
      .text(GAME_WIDTH / 2, rewardSectionY, "Экран награды", {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#d9ceb0",
      })
      .setOrigin(0.5);

    rewardLinks.forEach((link, index) => {
      const spec = {
        label: link.label,
        url: link.url,
        x: GAME_WIDTH / 2,
        y: rewardSectionY + 35 + index * 44,
        width: 280,
        height: 34,
      };
      allSpecs.push(spec);
      createButton({
        scene: this,
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        label: spec.label,
        hideLabel: true,
        onClick: () => {
          window.location.assign(spec.url);
        },
      });
    });

    // Section: Dev Actions
    const actionLinks = getDevActionLinks(baseUrl);
    const actionSectionY = rewardSectionY + 35 + rewardLinks.length * 44 + 20;
    this.add
      .text(GAME_WIDTH / 2, actionSectionY, "Действия", {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#d9ceb0",
      })
      .setOrigin(0.5);

    actionLinks.forEach((link, index) => {
      const spec = {
        label: link.label,
        url: link.url,
        x: GAME_WIDTH / 2,
        y: actionSectionY + 35 + index * 44,
        width: 280,
        height: 34,
      };
      allSpecs.push(spec);
      createButton({
        scene: this,
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        label: spec.label,
        hideLabel: true,
        onClick: () => {
          window.location.assign(spec.url);
        },
      });
    });

    this.renderButtonsOverlay(allSpecs);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.buttonsOverlay?.destroy();
      this.buttonsOverlay = undefined;
    });
  }

  private renderButtonsOverlay(
    labels: Array<{ label: string; x: number; y: number; width: number; height: number }>
  ): void {
    const html = createButtonLabelsOverlayHtml(labels);

    if (!this.buttonsOverlay) {
      this.buttonsOverlay = createCanvasAnchoredOverlay({
        scene: this,
        html,
        className: "reward-buttons-overlay-root",
        logicalWidth: GAME_CANVAS_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
      return;
    }

    this.buttonsOverlay.setHtml(html);
  }
}
