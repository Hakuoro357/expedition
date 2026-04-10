import { SAVE_KEY } from "@/app/config/gameConfig";
import { createInitialProgressState } from "@/core/game-state/progress";
import type { GameState, ProgressState, SaveState } from "@/core/game-state/types";
import { CHAPTERS, getNextNodeId, isLastNodeInChapter, getFirstNodeOfChapter, getNodeById } from "@/data/chapters";
import { ARTIFACTS } from "@/data/artifacts";
import { getRewardById } from "@/data/narrative/rewards";
import { ECONOMY } from "@/app/config/economy";
import type { SdkService } from "@/services/sdk/SdkService";

// Static id sets used to scrub merged saves from cloud-injected ghost ids.
const KNOWN_NODE_IDS: ReadonlySet<string> = new Set(
  CHAPTERS.flatMap((c) => c.nodes.map((n) => n.id)),
);
const KNOWN_ARTIFACT_IDS: ReadonlySet<string> = new Set(ARTIFACTS.map((a) => a.id));

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

  // currentGame: либо null, либо валидный GameState. На повреждённую партию
  // отвечаем сбросом в null, а не выкидыванием всего сейва — иначе один кривой
  // обjект из облака стирает прогресс с этого устройства.
  if (v.currentGame !== null && v.currentGame !== undefined) {
    if (!isValidGameState(v.currentGame)) {
      v.currentGame = null;
    }
  }
  return true;
}

const VALID_GAME_MODES = new Set(["adventure", "daily", "quick-play"]);
const VALID_GAME_STATUSES = new Set(["idle", "in_progress", "won", "lost"]);
const DEAL_ID_RE = /^c\d{1,3}n\d{1,3}$/;
const MAX_PILE_CARDS = 64;
const MAX_FOUNDATIONS = 8;
const MAX_TABLEAU = 12;
const MAX_UNDOS = 100_000;

function isValidPile(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== "string" || p.id.length > 64) return false;
  if (p.type !== "stock" && p.type !== "waste" && p.type !== "tableau" && p.type !== "foundation") {
    return false;
  }
  if (!Array.isArray(p.cards) || p.cards.length > MAX_PILE_CARDS) return false;
  // Карты дальше не валидируем поэлементно — формат стабильный, а ошибочный
  // GameState всё равно отбрасывается на следующем шаге.
  return true;
}

function isValidGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  if (typeof g.mode !== "string" || !VALID_GAME_MODES.has(g.mode)) return false;
  if (typeof g.dealId !== "string" || !DEAL_ID_RE.test(g.dealId)) return false;
  if (typeof g.status !== "string" || !VALID_GAME_STATUSES.has(g.status)) return false;
  if (!isBoundedInt(g.undoCount, 0, MAX_UNDOS)) return false;
  if (typeof g.seed !== "undefined" && typeof g.seed !== "number") return false;
  if (!isValidPile(g.stock) || !isValidPile(g.waste)) return false;
  if (!Array.isArray(g.foundations) || g.foundations.length > MAX_FOUNDATIONS) return false;
  if (!g.foundations.every(isValidPile)) return false;
  if (!Array.isArray(g.tableau) || g.tableau.length > MAX_TABLEAU) return false;
  if (!g.tableau.every(isValidPile)) return false;
  return true;
}

/**
 * Чистит progress от мусора, который мог приехать из облака:
 * - выкидывает unlocked/completed/artifact id'шники, которых нет в статической
 *   таблице глав (защита от инжекта несуществующих узлов);
 * - кэпит длины массивов, чтобы merge не мог их разрастить через unionStrings;
 * - клампит coins/streak/chapter в их валидные диапазоны.
 */
function sanitizeProgress(progress: ProgressState): ProgressState {
  const filterNodes = (ids: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (KNOWN_NODE_IDS.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
        if (out.length >= MAX_NODES) break;
      }
    }
    return out;
  };
  const filterArtifacts = (ids: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of ids) {
      if (KNOWN_ARTIFACT_IDS.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
        if (out.length >= MAX_NODES) break;
      }
    }
    return out;
  };
  return {
    ...progress,
    currentChapter: Math.max(1, Math.min(MAX_CHAPTER, progress.currentChapter | 0)),
    coins: Math.max(0, Math.min(MAX_COINS, progress.coins | 0)),
    streakCount: Math.max(0, Math.min(MAX_STREAK, progress.streakCount | 0)),
    unlockedNodes: filterNodes(progress.unlockedNodes),
    completedNodes: filterNodes(progress.completedNodes),
    artifacts: filterArtifacts(progress.artifacts),
  };
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
  const mergedProgress: ProgressState = {
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
  };
  return {
    version: 1,
    progress: sanitizeProgress(mergedProgress),
    // Текущая партия — отдаём приоритет локальной, чтобы не потерять in-progress.
    // Облачная партия проходит ту же валидацию через isValidSaveState на входе.
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
  async loadFromCloud(sdk: SdkService): Promise<void> {
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
  async pushToCloud(sdk: SdkService): Promise<void> {
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
