import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@/app/config/gameConfig";
import { getGameResolution } from "@/app/rendering";
import { BootScene } from "@/scenes/BootScene";
import { DevPreviewScene } from "@/scenes/DevPreviewScene";
import { DetailScene } from "@/scenes/DetailScene";
import { DiaryScene } from "@/scenes/DiaryScene";
import { GameScene } from "@/scenes/GameScene";
import { MapScene } from "@/scenes/MapScene";
import { RewardScene } from "@/scenes/RewardScene";
import { SettingsScene } from "@/scenes/SettingsScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  const resolution = typeof window === "undefined" ? 1 : getGameResolution(window.devicePixelRatio || 1);
  const config: Phaser.Types.Core.GameConfig & { resolution?: number } = {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    resolution,
    autoRound: true,
    canvasStyle: "image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;",
    backgroundColor: "#132220",
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoRound: true,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [
      BootScene,
      DevPreviewScene,
      MapScene,
      DetailScene,
      GameScene,
      RewardScene,
      DiaryScene,
      SettingsScene
    ]
  };
  const game = new Phaser.Game(config as Phaser.Types.Core.GameConfig);

  if (import.meta.env.DEV && typeof window !== "undefined") {
    (window as Window & { __solitaireGame?: Phaser.Game }).__solitaireGame = game;
  }

  return game;
}
