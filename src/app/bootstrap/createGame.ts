import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@/app/config/gameConfig";
import { BootScene } from "@/scenes/BootScene";
import { DiaryScene } from "@/scenes/DiaryScene";
import { GameScene } from "@/scenes/GameScene";
import { MapScene } from "@/scenes/MapScene";
import { RewardScene } from "@/scenes/RewardScene";
import { SettingsScene } from "@/scenes/SettingsScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  // HiDPI: zoom = dpr creates a canvas with dpr× more pixels while keeping
  // game-world coordinates at 390×844.  All graphics and text render crisply
  // because the canvas buffer matches the physical display resolution.
  const dpr = Math.min(window.devicePixelRatio || 1, 3); // cap at 3×

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#132220",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: dpr,
    },
    scene: [
      BootScene,
      MapScene,
      GameScene,
      RewardScene,
      DiaryScene,
      SettingsScene
    ]
  });
  return game;
}

