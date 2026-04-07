import Phaser from "phaser";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT } from "@/app/config/gameConfig";
import { getGameResolution } from "@/app/rendering";
import { BootScene } from "@/scenes/BootScene";
import { DevPreviewScene } from "@/scenes/DevPreviewScene";
import { DetailScene } from "@/scenes/DetailScene";
import { DiaryScene } from "@/scenes/DiaryScene";
import { GameScene } from "@/scenes/GameScene";
import { MapScene } from "@/scenes/MapScene";
import { PrologueScene } from "@/scenes/PrologueScene";
import { RewardScene } from "@/scenes/RewardScene";
import { SettingsScene } from "@/scenes/SettingsScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  const resolution = typeof window === "undefined" ? 1 : getGameResolution(window.devicePixelRatio || 1);
  const config: Phaser.Types.Core.GameConfig & { resolution?: number } = {
    type: Phaser.AUTO,
    parent,
    width: GAME_CANVAS_WIDTH,
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
      PrologueScene,
      MapScene,
      DetailScene,
      GameScene,
      RewardScene,
      DiaryScene,
      SettingsScene
    ]
  };
  const game = new Phaser.Game(config as Phaser.Types.Core.GameConfig);

  // На некоторых мобильных браузерах после поворота Phaser не сразу
  // пересчитывает parent rect (window.innerWidth ещё старый в первый
  // кадр после orientationchange). Дополнительно: при возвращении из
  // landscape в portrait #app был visibility:hidden, и Phaser мог
  // зафиксировать scale=0. Принудительный многоступенчатый refresh
  // лечит «маленький canvas после поворота».
  if (typeof window !== "undefined") {
    let pending = false;
    const scheduleRefresh = (): void => {
      if (pending) return;
      pending = true;
      // Серия refresh-ов: сразу, на следующем кадре, через 100 и 400 мс.
      // Покрывает iOS Safari (медленный orientationchange) и Android
      // Chrome (быстрый resize, но parentNode rect ещё может быть нулевым,
      // если #app только что снял visibility:hidden).
      const doRefresh = (): void => {
        game.scale.refresh();
      };
      doRefresh();
      requestAnimationFrame(() => {
        doRefresh();
        window.setTimeout(doRefresh, 100);
        window.setTimeout(() => {
          doRefresh();
          pending = false;
        }, 400);
      });
    };
    window.addEventListener("orientationchange", scheduleRefresh);
    window.addEventListener("resize", scheduleRefresh);
    if (typeof screen !== "undefined" && screen.orientation) {
      screen.orientation.addEventListener?.("change", scheduleRefresh);
    }
    // Возврат на вкладку из фона тоже может оставить stale layout.
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) scheduleRefresh();
    });
  }

  if (import.meta.env.DEV && typeof window !== "undefined") {
    (window as Window & { __solitaireGame?: Phaser.Game }).__solitaireGame = game;
  }

  return game;
}
