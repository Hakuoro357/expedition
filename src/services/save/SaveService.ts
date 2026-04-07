import { SAVE_KEY } from "@/app/config/gameConfig";
import { createInitialProgressState } from "@/core/game-state/progress";
import type { GameState, ProgressState, SaveState } from "@/core/game-state/types";
import { getNextNodeId, isLastNodeInChapter, getFirstNodeOfChapter, getNodeById } from "@/data/chapters";
import { getRewardById } from "@/data/narrative/rewards";
import { ECONOMY } from "@/app/config/economy";
import type { YandexSdkService } from "@/services/sdk/YandexSdkService";

export function createDefaultSaveState(): SaveState {
  return {
    version: 1,
    progress: createInitialProgressState(),
    currentGame: null
  };
}

/**
 * Проверяет минимальную целостность объекта SaveState. Не пытается лечить
 * частично корректные данные — если что-то критичное не на месте, безопаснее
 * откатиться на дефолт. Используется и для localStorage, и для облачных сейвов
 * (последние могут прийти в любом виде).
 */
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

// Защитные верхние границы — на случай подмены сейва (локального или облачного).
// Числа за этими пределами не имеют игрового смысла и почти наверняка означают
// либо повреждение, либо попытку накрутить прогресс/монеты.
const MAX_COINS = 1_000_000;
const MAX_NODES = 1_000;
const MAX_STREAK = 10_000;
const MAX_CHAPTER = 100;

function isBoundedInt(x: unknown, min: number, max: number): x is number {
  return typeof x === "number" && Number.isFinite(x) && x >= min && x <= max && Math.floor(x) === x;
}

function isValidSaveState(value: unknown): value is SaveState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return false;

  const progress = v.progress as Record<string, unknown> | undefined;
  if (!progress || typeof progress !== "object") return false;
  if (!isBoundedInt(progress.currentChapter, 1, MAX_CHAPTER)) return false;
  if (!isStringArray(progress.unlockedNodes) || progress.unlockedNodes.length > MAX_NODES) return false;
  if (!isStringArray(progress.completedNodes) || progress.completedNodes.length > MAX_NODES) return false;
  if (!isStringArray(progress.artifacts) || progress.artifacts.length > MAX_NODES) return false;
  if (!isBoundedInt(progress.coins, 0, MAX_COINS)) return false;
  if (progress.locale !== "ru" && progress.locale !== "en" && progress.locale !== "tr") return false;
  if (!isBoundedInt(progress.streakCount, 0, MAX_STREAK)) return false;
  if (
    progress.dailyClaimedOn !== null &&
    typeof progress.dailyClaimedOn !== "undefined" &&
    typeof progress.dailyClaimedOn !== "string"
  ) {
    return false;
  }
  if (
    progress.lastLoginDate !== null &&
    typeof progress.lastLoginDate !== "undefined" &&
    typeof progress.lastLoginDate !== "string"
  ) {
    return false;
  }
  if (
    typeof progress.prologueShown !== "undefined" &&
    typeof progress.prologueShown !== "boolean"
  ) {
    return false;
  }
  if (
    typeof progress.sfxVolume !== "undefined" &&
    (typeof progress.sfxVolume !== "number" || Number.isNaN(progress.sfxVolume))
  ) {
    return false;
  }
  if (
    typeof progress.musicVolume !== "undefined" &&
    (typeof progress.musicVolume !== "number" || Number.isNaN(progress.musicVolume))
  ) {
    return false;
  }

  // currentGame может быть null или объектом — глубже не проверяем,
  // т.к. в случае повреждения геймскрин просто разложит новую партию.
  if (v.currentGame !== null && typeof v.currentGame !== "object") return false;
  return true;
}

function unionStrings(a: string[], b: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of a) if (!seen.has(x)) { seen.add(x); out.push(x); }
  for (const x of b) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
}

function laterDateString(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export function mergeSaveStates(local: SaveState, cloud: SaveState): SaveState {
  const lp = local.progress;
  const cp = cloud.progress;
  return {
    version: 1,
    progress: {
      currentChapter: Math.max(lp.currentChapter, cp.currentChapter),
      unlockedNodes: unionStrings(lp.unlockedNodes, cp.unlockedNodes),
      completedNodes: unionStrings(lp.completedNodes, cp.completedNodes),
      coins: Math.max(lp.coins, cp.coins),
      artifacts: unionStrings(lp.artifacts, cp.artifacts),
      dailyClaimedOn: laterDateString(lp.dailyClaimedOn, cp.dailyClaimedOn),
      // Локаль игрока — приоритет у локальной (он явно её выбрал на этом устройстве).
      locale: lp.locale,
      streakCount: Math.max(lp.streakCount, cp.streakCount),
      lastLoginDate: laterDateString(lp.lastLoginDate, cp.lastLoginDate),
      prologueShown: Boolean(lp.prologueShown || cp.prologueShown),
      // devAllPlayable — чисто локальный dev-флаг. Никогда не подтягиваем
      // его из облака, чтобы случайный sync с dev-устройства не разлочил
      // всё на проде у обычного игрока.
      devAllPlayable: lp.devAllPlayable,
    },
    // Текущая партия — отдаём приоритет локальной, чтобы не потерять in-progress.
    currentGame: local.currentGame ?? cloud.currentGame,
  };
}

export class SaveService {
  load(): SaveState {
    try {
      const rawValue = window.localStorage.getItem(SAVE_KEY);

      if (!rawValue) {
        return createDefaultSaveState();
      }

      const parsed = JSON.parse(rawValue) as unknown;

      if (!isValidSaveState(parsed)) {
        console.warn("[save] localStorage state failed schema validation, resetting");
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
    rewardId: string | null;
    coinsAwarded: number;
    artifactAwarded: string | null;
    chapterCompleted: boolean;
  } {
    const save = this.load();
    const progress = save.progress;
    const node = getNodeById(nodeId);
    const rewardId = node?.rewardId ?? null;
    const reward = rewardId ? getRewardById(rewardId) : undefined;
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
    const collectibleArtifactId = reward?.collectibleArtifactId ?? artifactId;
    if (collectibleArtifactId && !progress.artifacts.includes(collectibleArtifactId)) {
      artifactAwarded = collectibleArtifactId;
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

    return { rewardId, coinsAwarded, artifactAwarded, chapterCompleted };
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
   * Загружает облачное сохранение и сливает с локальным по полям:
   * - completedNodes / unlockedNodes / artifacts → объединение
   * - coins → max
   * - currentChapter / streakCount → max
   * - dailyClaimedOn / lastLoginDate / locale / prologueShown → берём более свежие
   * - currentGame → берём облачную партию только если локальной нет
   *
   * Это устраняет потерю прогресса при двух устройствах: ни одна сторона не
   * перезатирает другую целиком, и манипулированный сейв не может уменьшить
   * монеты или украсть артефакты у другой стороны.
   */
  async loadFromCloud(sdk: YandexSdkService): Promise<void> {
    const json = await sdk.getCloudSave();
    if (!json) {
      console.log("[save] no cloud save found");
      return;
    }
    let cloudState: unknown;
    try {
      cloudState = JSON.parse(json);
    } catch (error) {
      console.warn("[save] failed to parse cloud save", error);
      return;
    }
    if (!isValidSaveState(cloudState)) {
      console.warn("[save] cloud save failed schema validation, ignoring");
      return;
    }

    const localState = this.load();
    const merged = mergeSaveStates(localState, cloudState);
    this.save(merged);
    console.log(
      `[save] cloud merged (local ${localState.progress.completedNodes.length} ` +
      `+ cloud ${cloudState.progress.completedNodes.length} → ` +
      `${merged.progress.completedNodes.length} nodes)`,
    );
  }

  /**
   * Отправляет текущее локальное сохранение в облако. Перед отправкой
   * подтягивает актуальное облачное состояние и сливает с локальным,
   * чтобы не затереть прогресс, сделанный на другом устройстве между
   * прошлым `loadFromCloud` и этим пушем.
   */
  async pushToCloud(sdk: YandexSdkService): Promise<void> {
    try {
      const json = await sdk.getCloudSave();
      if (json) {
        let cloudState: unknown;
        try {
          cloudState = JSON.parse(json);
        } catch {
          cloudState = null;
        }
        if (isValidSaveState(cloudState)) {
          const merged = mergeSaveStates(this.load(), cloudState);
          this.save(merged);
        }
      }
    } catch (error) {
      console.warn("[save] pre-push merge failed, pushing local state as-is", error);
    }
    const state = this.load();
    await sdk.setCloudSave(JSON.stringify(state));
  }
}
