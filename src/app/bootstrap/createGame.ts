import Phaser from "phaser";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT } from "@/app/config/gameConfig";
import { getGameResolution } from "@/app/rendering";
import { greedySolveSteps } from "@/core/klondike/dealSolver";
import type { GameState } from "@/core/game-state/types";
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

  // DevPreviewScene нужна только для локальной разработки (кнопки «Preview
  // reward c1n3» и т.д.) — в production-билд её не включаем. Её файл
  // содержит хардкод `http://127.0.0.1:4175` для SSR-фолбека, который
  // валидатор Яндекс Игр воспринимает как «ссылку на сервисное хранилище»
  // и отклоняет черновик. Vite DCE по `import.meta.env.DEV = false`
  // в production выкинет dead-branch и неиспользуемый импорт.
  const scenes: Phaser.Types.Scenes.SceneType[] = [
    BootScene,
    PrologueScene,
    MapScene,
    DetailScene,
    GameScene,
    RewardScene,
    DiaryScene,
    SettingsScene,
  ];
  if (import.meta.env.DEV) {
    scenes.splice(1, 0, DevPreviewScene);
  }

  const config: Phaser.Types.Core.GameConfig & { resolution?: number } = {
    type: Phaser.AUTO,
    parent,
    width: GAME_CANVAS_WIDTH,
    height: GAME_HEIGHT,
    resolution,
    autoRound: true,
    canvasStyle: "image-rendering:-webkit-optimize-contrast;image-rendering:crisp-edges;",
    backgroundColor: "#132220",
    // Дефолтный maxParallelDownloads = 32, а у нас 33+ ассетов.
    // Последний файл застревает в очереди и preload никогда не завершается.
    loader: {
      maxParallelDownloads: 64,
    },
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
    scene: scenes
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
    const w = window as Window & {
      __solitaireGame?: Phaser.Game;
      __solitaireDebug?: {
        solveAndStep: (delayMs?: number) => Promise<number>;
      };
    };
    w.__solitaireGame = game;

    // Dev-only: run the greedy solver on the active GameScene and
    // apply states one by one with a delay between moves. Used by
    // scripts/captureVideo.mjs to record real gameplay footage.
    w.__solitaireDebug = {
      async solveAndStep(delayMs = 280): Promise<number> {
        const gameScene = game.scene.getScene("game") as unknown as {
          gameState: GameState | null;
          applyState: (state: GameState) => void;
        };
        if (!gameScene?.gameState) return 0;
        const steps = greedySolveSteps(gameScene.gameState);
        for (const next of steps) {
          gameScene.applyState(next);
          await new Promise((r) => setTimeout(r, delayMs));
        }
        return steps.length;
      },
    };
  }

  return game;
}
