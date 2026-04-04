import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from "@/app/config/gameConfig";
import { getRewardPreviewLinks } from "@/scenes/devPreview";
import { createButtonLabelsOverlayHtml } from "@/ui/buttonLabelsOverlay";
import { createCanvasAnchoredOverlay, type CanvasOverlayHandle } from "@/ui/canvasOverlay";
import { createButton } from "@/ui/createButton";

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:4175";
  }

  return window.location.origin;
}

export class DevPreviewScene extends Phaser.Scene {
  private buttonsOverlay?: CanvasOverlayHandle;

  constructor() {
    super(SCENES.devPreview);
  }

  create(): void {
    const links = getRewardPreviewLinks(getBaseUrl());

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x17302e);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 340, GAME_HEIGHT - 80, 0x223530, 0.96)
      .setStrokeStyle(2, 0xdac9a1);

    this.add
      .text(GAME_WIDTH / 2, 100, "Reward Preview", {
        fontFamily: "Georgia",
        fontSize: "32px",
        color: "#f8ebcf",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 144, "Выбери готовый сценарий", {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#d9ceb0",
      })
      .setOrigin(0.5);

    const buttonSpecs = links.map((link, index) => ({
      ...link,
      x: GAME_WIDTH / 2,
      y: 250 + index * 86,
      width: 280,
      height: 56,
    }));

    buttonSpecs.forEach((spec) => {
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

    this.renderButtonsOverlay(
      buttonSpecs.map((spec) => ({
        label: spec.label,
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
      }))
    );

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
        logicalWidth: GAME_WIDTH,
        logicalHeight: GAME_HEIGHT,
      });
      return;
    }

    this.buttonsOverlay.setHtml(html);
  }
}
