import { SAVE_KEY } from "@/app/config/gameConfig";
import { createInitialProgressState } from "@/core/game-state/progress";
import type { GameState, ProgressState, SaveState } from "@/core/game-state/types";
import { getNextNodeId, isLastNodeInChapter, getFirstNodeOfChapter } from "@/data/chapters";
import { ECONOMY } from "@/app/config/economy";
import type { YandexSdkService } from "@/services/sdk/YandexSdkService";

export function createDefaultSaveState(): SaveState {
  return {
    version: 1,
    progress: createInitialProgressState(),
    currentGame: null
  };
}

export class SaveService {
  load(): SaveState {
    try {
      const rawValue = window.localStorage.getItem(SAVE_KEY);

      if (!rawValue) {
        return createDefaultSaveState();
      }

      const parsed = JSON.parse(rawValue) as SaveState;

      if (parsed.version !== 1) {
        return createDefaultSaveState();
      }

      return parsed;
    } catch (error) {
      console.warn("[save] failed to load state", error);
      return createDefaultSaveState();
    }
  }

  save(state: SaveState): void {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("[save] failed to persist state", error);
    }
  }

  updateCurrentGame(currentGame: GameState | null): SaveState {
    const nextState = {
      ...this.load(),
      currentGame
    };

    this.save(nextState);
    return nextState;
  }

  clearCurrentGame(): SaveState {
    return this.updateCurrentGame(null);
  }

  updateProgress(updater: (progress: ProgressState) => ProgressState): SaveState {
    const currentState = this.load();
    const nextState = {
      ...currentState,
      progress: updater(currentState.progress)
    };

    this.save(nextState);
    return nextState;
  }

  /** Add coins to the player's balance */
  addCoins(amount: number): SaveState {
    return this.updateProgress((p) => ({
      ...p,
      coins: p.coins + amount,
    }));
  }

  /** Add an artifact id if not already collected */
  addArtifact(artifactId: string): SaveState {
    return this.updateProgress((p) => ({
      ...p,
      artifacts: p.artifacts.includes(artifactId)
        ? p.artifacts
        : [...p.artifacts, artifactId],
    }));
  }

  /**
   * Mark a node as completed and unlock the next one.
   * Returns the reward summary for the caller to display.
   */
  completeNode(nodeId: string, artifactId?: string): {
    coinsAwarded: number;
    artifactAwarded: string | null;
    chapterCompleted: boolean;
  } {
    const save = this.load();
    const progress = save.progress;
    let coinsAwarded = ECONOMY.winCoins;
    let artifactAwarded: string | null = null;
    let chapterCompleted = false;

    const nextNodeId = getNextNodeId(nodeId);
    const isChapterEnd = isLastNodeInChapter(nodeId);

    if (isChapterEnd) {
      coinsAwarded += ECONOMY.chapterCompleteCoins;
      chapterCompleted = true;
    }

    // Artifact drop
    if (artifactId && !progress.artifacts.includes(artifactId)) {
      artifactAwarded = artifactId;
    }

    this.updateProgress((p) => {
      const completedNodes = p.completedNodes.includes(nodeId)
        ? p.completedNodes
        : [...p.completedNodes, nodeId];

      let unlockedNodes = p.unlockedNodes;
      if (nextNodeId && !unlockedNodes.includes(nextNodeId)) {
        unlockedNodes = [...unlockedNodes, nextNodeId];
      }

      let currentChapter = p.currentChapter;
      if (isChapterEnd) {
        const nextChapter = p.currentChapter + 1;
        if (nextChapter <= ECONOMY.totalChapters) {
          currentChapter = nextChapter;
          const firstNode = getFirstNodeOfChapter(nextChapter);
          if (firstNode && !unlockedNodes.includes(firstNode.id)) {
            unlockedNodes = [...unlockedNodes, firstNode.id];
          }
        }
      }

      const artifacts =
        artifactAwarded && !p.artifacts.includes(artifactAwarded)
          ? [...p.artifacts, artifactAwarded]
          : p.artifacts;

      return {
        ...p,
        completedNodes,
        unlockedNodes,
        currentChapter,
        coins: p.coins + coinsAwarded,
        artifacts,
      };
    });

    return { coinsAwarded, artifactAwarded, chapterCompleted };
  }

  /** Mark daily as claimed for today */
  claimDaily(dateKey: string): SaveState {
    return this.updateProgress((p) => ({
      ...p,
      dailyClaimedOn: dateKey,
      coins: p.coins + ECONOMY.dailyWinCoins,
    }));
  }

  /**
   * Загружает облачное сохранение и, если оно новее локального (больше completedNodes),
   * записывает его в localStorage. Вызывается один раз при старте в BootScene.
   */
  async loadFromCloud(sdk: YandexSdkService): Promise<void> {
    const json = await sdk.getCloudSave();
    if (!json) {
      console.log("[save] no cloud save found");
      return;
    }
    try {
      const cloudState = JSON.parse(json) as SaveState;
      if (cloudState.version !== 1) return;

      const localState = this.load();
      const cloudProgress = cloudState.progress.completedNodes.length;
      const localProgress = localState.progress.completedNodes.length;

      if (cloudProgress > localProgress) {
        this.save(cloudState);
        console.log(`[save] cloud save loaded (${cloudProgress} nodes vs local ${localProgress})`);
      } else {
        console.log(`[save] local save is up to date (${localProgress} nodes)`);
      }
    } catch (error) {
      console.warn("[save] failed to parse cloud save", error);
    }
  }

  /**
   * Отправляет текущее локальное сохранение в облако.
   * "Fire and forget" — не ожидать результата.
   */
  async pushToCloud(sdk: YandexSdkService): Promise<void> {
    const state = this.load();
    const json = JSON.stringify(state);
    await sdk.setCloudSave(json);
  }
}
