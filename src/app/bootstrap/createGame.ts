import Phaser from "phaser";
import { GAME_CANVAS_WIDTH, GAME_HEIGHT } from "@/app/config/gameConfig";
import { getGameResolution } from "@/app/rendering";
import { greedySolveSteps } from "@/core/klondike/dealSolver";
import type { GameState } from "@/core/game-state/types";
import { BootScene } from "@/scenes/BootScene";
import { DetailScene } from "@/scenes/DetailScene";
import { DiaryScene } from "@/scenes/DiaryScene";
import { GameScene } from "@/scenes/GameScene";
import { MapScene } from "@/scenes/MapScene";
import { PrologueScene } from "@/scenes/PrologueScene";
import { RewardScene } from "@/scenes/RewardScene";
import { SettingsScene } from "@/scenes/SettingsScene";
import { TitleScene } from "@/scenes/TitleScene";

export function createGame(parent: HTMLElement): Phaser.Game {
  const resolution = typeof window === "undefined" ? 1 : getGameResolution(window.devicePixelRatio || 1);

  // DevPreviewScene нужна только для локальной разработки (кнопки «Preview
  // reward c1n3» и т.д.) — в production не подгружается вообще. Используем
  // ДИНАМИЧЕСКИЙ импорт ниже после создания Phaser.Game: Vite в прод-билде
  // не включает модуль и связанные с ним dev-helpers (devPreview.ts) —
  // никаких строк `unlock-all` / «Разблокировать всё» в bundle.
  const scenes: Phaser.Types.Scenes.SceneType[] = [
    BootScene,
    TitleScene,
    PrologueScene,
    MapScene,
    DetailScene,
    GameScene,
    RewardScene,
    DiaryScene,
    SettingsScene,
  ];

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

  // Dev-only: динамически подгружаем DevPreviewScene и регистрируем в
  // Phaser через `scene.add`. Vite в прод-сборке полностью исключает
  // и DevPreviewScene.ts, и связанный devPreview.ts (со строками
  // `unlock-all`, «Разблокировать всё» и т.д.) — никаких dev-артефактов
  // в production bundle.
  if (import.meta.env.DEV) {
    void import("@/scenes/DevPreviewScene").then(({ DevPreviewScene }) => {
      // ВАЖНО: ключ сцены берём из SCENES.devPreview (тот же, что используется
      // в this.scene.start(SCENES.devPreview, ...) в BootScene).
      // Импортируем константу здесь же, чтобы не таскать в прод gameConfig.
      void import("@/app/config/gameConfig").then(({ SCENES }) => {
        game.scene.add(SCENES.devPreview, DevPreviewScene);
      });
    });
  }

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
