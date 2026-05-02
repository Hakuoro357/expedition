import { createInitialProgressState } from "@/core/game-state/progress";
import type { GameState, ProgressState, SaveState } from "@/core/game-state/types";
import { CHAPTERS, getNextNodeId, isLastNodeInChapter, getFirstNodeOfChapter, getNodeById } from "@/data/chapters";
import { ARTIFACTS } from "@/data/artifacts";
import { getRewardById } from "@/data/narrative/rewards";
import { ECONOMY } from "@/app/config/economy";
import type { SdkService } from "@/services/sdk/SdkService";

// Static id sets used to scrub saves from cloud-injected ghost ids.
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
 * откатиться на дефолт. Используется для облачных сейвов, которые могут
 * прийти в любом виде (мигрированный плеер GP, старая версия формата и т.п.).
 */
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

// Защитные верхние границы — на случай подмены cloud-save.
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
  // Все 7 поддерживаемых локалей. До v0.3.42 список был только ru/en/tr —
  // cloud-save европейских игроков (es/pt/de/fr) проваливал валидацию и
  // молча сбрасывался к дефолтам. Источник истины — type Locale в
  // services/i18n/locales.ts; держим в синхроне.
  if (
    progress.locale !== "ru" &&
    progress.locale !== "en" &&
    progress.locale !== "tr" &&
    progress.locale !== "es" &&
    progress.locale !== "pt" &&
    progress.locale !== "de" &&
    progress.locale !== "fr"
  ) {
    return false;
  }
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
  if (
    typeof progress.lastRewardedAt !== "undefined" &&
    (typeof progress.lastRewardedAt !== "number" || !Number.isFinite(progress.lastRewardedAt))
  ) {
    return false;
  }

  if (v.currentGame !== null && v.currentGame !== undefined) {
    if (!isValidGameState(v.currentGame)) {
      v.currentGame = null;
    }
  }
  return true;
}

const VALID_GAME_MODES = new Set(["adventure", "daily", "quick-play"]);
const VALID_GAME_STATUSES = new Set(["idle", "in_progress", "won", "lost"]);
// Adventure: c<chapter>n<node>, например "c2n4". Daily: daily-YYYY-MM-DD,
// например "daily-2026-05-02" (см. getDailyDateKey + scenes использующие
// `daily-${dailyKey}`). До v0.3.42 регэксп пропускал только adventure-формат,
// и любая сохранённая daily-партия в currentGame при загрузке из облака
// проваливала isValidGameState и тихо обнулялась.
const DEAL_ID_RE = /^(c\d{1,3}n\d{1,3}|daily-\d{4}-\d{2}-\d{2})$/;
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
 * выкидывает незнакомые id'шники, кэпит длины/диапазоны.
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

/**
 * SaveService — единственный источник истины для игрового сейва.
 *
 * Требование тестировщика GamePush (v0.3.0): никакого localStorage,
 * никакого мерджа. Все данные лежат в поле `save` объекта gp.player,
 * на клиенте держим только in-memory snapshot.
 *
 * Жизненный цикл:
 *  1. `new SaveService()` — snapshot = defaults (на случай ранних чтений).
 *  2. BootScene ждёт `sdk.init()`, потом вызывает `save.init(sdk)` —
 *     подтягивает cloud-снимок, заменяет им in-memory snapshot.
 *  3. Последующие мутации (addCoins, completeNode, ...) меняют snapshot
 *     и fire-and-forget отправляют его в `sdk.setCloudSave()`.
 *  4. `flush()` — async обёртка поверх setCloudSave, используется там,
 *     где вызывающий должен дождаться подтверждения записи (после
 *     rewarded-ad, списания монет за подсказку).
 */
/**
 * Debounce для cloud-sync: 5000 мс (увеличено с 800 мс на v0.3.39 после
 * того как мы упёрлись в потолок gp.player.sync() — 100k вызовов / сутки).
 *
 * Стратегия экономии вызовов:
 *  1. Прогресс (монеты, completedNodes, локаль, громкости) пишется через
 *     `save()` → `scheduleSync()` с debounce 5 сек. Burst мутаций (например
 *     RewardScene: completeNode + addCoins подряд) схлопывается в 1 sync.
 *  2. `currentGame` (доска во время партии) пишется через `updateCurrentGame`
 *     → `saveLocal()` БЕЗ debounce-таймера. То есть каждый ход / undo /
 *     drag не запускает sync. Облако обновляется только при flush() —
 *     конец партии (RewardScene), pagehide, scene shutdown, sdk.onPause.
 *  3. `lastSyncedJson` — идемпотентный skip: если очередной планируемый
 *     sync даёт такой же JSON, как последний отправленный — sync не
 *     делаем, экономим лишний sync.
 *
 * Это сокращает 5–15 sync на партию до ~1 sync на партию.
 */
const PROGRESS_DEBOUNCE_MS = 5000;

export class SaveService {
  private state: SaveState = createDefaultSaveState();
  private sdk: SdkService | null = null;
  /** Таймер дебаунса для отложенного cloud-sync. */
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  /** Есть ли незакомиченные изменения в облаке. */
  private dirty = false;
  /**
   * JSON последнего успешно отправленного в облако состояния. Если
   * очередной sync даёт совпадающий JSON — пропускаем gp.player.sync()
   * (экономия квоты при no-op мутациях). null = ничего ещё не отправляли.
   */
  private lastSyncedJson: string | null = null;

  /**
   * Подгружает сейв из gp.player (или эквивалента на другой платформе).
   * Безопасно вызывать несколько раз — перепишет snapshot актуальной
   * облачной версией. При отсутствии/повреждении cloud-save — snapshot
   * остаётся на дефолте (чистый старт).
   */
  async init(sdk: SdkService): Promise<void> {
    this.sdk = sdk;
    let json: string | null = null;
    try {
      json = await sdk.getCloudSave();
    } catch (error) {
      console.warn("[save] getCloudSave failed during init", error);
      json = null;
    }

    if (!json) {
      // Первый запуск / очищенный профиль — оставляем дефолтный snapshot
      // in-memory. НЕ делаем persist на старте: тестировщик GP ругается
      // «Не нужно делать Sync на старте». Первый игровой ход / смена
      // настройки сам запустит debounced persist.
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (error) {
      console.warn("[save] cloud save is not valid JSON, falling back to defaults", error);
      this.state = createDefaultSaveState();
      // Намеренно НЕ синкуем — ждём реальной пользовательской мутации.
      return;
    }

    if (!isValidSaveState(parsed)) {
      console.warn("[save] cloud save failed schema validation, resetting to defaults");
      this.state = createDefaultSaveState();
      return;
    }

    this.state = {
      version: 1,
      progress: sanitizeProgress(parsed.progress),
      currentGame: parsed.currentGame ?? null,
    };
    // Запоминаем загруженный JSON как «уже в облаке», чтобы первый
    // же no-op save (например, миграция, не меняющая данные) не
    // спровоцировал лишний sync.
    this.lastSyncedJson = JSON.stringify(this.state);
  }

  /** Возвращает in-memory snapshot (синхронно). */
  load(): SaveState {
    return this.state;
  }

  /**
   * Перезаписывает in-memory snapshot и планирует debounced cloud-sync.
   * Используется для «значимых» мутаций прогресса (монеты, артефакты,
   * локаль, громкости) — там без облака игрок потеряет реальные данные.
   *
   * Для частых мутаций состояния партии используется `updateCurrentGame`,
   * который НЕ планирует sync (см. saveLocal).
   */
  save(state: SaveState): void {
    this.state = state;
    this.dirty = true;
    this.scheduleSync();
  }

  /**
   * Локальное обновление snapshot БЕЗ планирования cloud-sync.
   * Используется для частых мутаций currentGame (доска во время партии):
   * каждый ход обновляет in-memory, но в облако уйдёт только при flush()
   * (pagehide, конец партии, переход на другую сцену, sdk.onPause).
   */
  private saveLocal(state: SaveState): void {
    this.state = state;
    this.dirty = true;
  }

  /**
   * Явно дождаться записи в облако (rewarded, hint, переходы между
   * сценами, pagehide). Отменяет ожидающий debounce-таймер и пишет сразу.
   * Идемпотентен: если состояние совпадает с последним отправленным —
   * sync пропускается (экономия квоты gp.player.sync).
   */
  async flush(): Promise<void> {
    if (!this.sdk) return;
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    if (!this.dirty) return;
    const json = JSON.stringify(this.state);
    if (json === this.lastSyncedJson) {
      // Состояние не изменилось с прошлого sync — не тратим квоту.
      this.dirty = false;
      return;
    }
    this.dirty = false;
    this.lastSyncedJson = json;
    try {
      await this.sdk.setCloudSave(json);
    } catch (error) {
      console.warn("[save] flush failed", error);
    }
  }

  /**
   * Планирует отложенную запись в облако. Повторные вызовы в пределах
   * окна перезапускают таймер. По истечении окна — пишет в облако,
   * если состояние изменилось с прошлого sync (idempotent skip).
   */
  private scheduleSync(): void {
    if (!this.sdk) return;
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      if (!this.dirty || !this.sdk) return;
      const json = JSON.stringify(this.state);
      if (json === this.lastSyncedJson) {
        // Идемпотентный skip — экономим квоту gp.player.sync.
        this.dirty = false;
        return;
      }
      this.dirty = false;
      this.lastSyncedJson = json;
      // Fire-and-forget. Ошибки логируются внутри setCloudSave.
      void this.sdk.setCloudSave(json);
    }, PROGRESS_DEBOUNCE_MS);
  }

  updateCurrentGame(currentGame: GameState | null): SaveState {
    const nextState: SaveState = {
      ...this.state,
      currentGame,
    };
    // НЕ планируем sync: каждый ход партии — десятки мутаций currentGame,
    // и при debounced sync мы тратили бы 1+ вызов gp.player.sync на партию.
    // Реальная запись в облако произойдёт при flush() в RewardScene
    // (конец партии), на pagehide, при scene shutdown или sdk.onPause.
    this.saveLocal(nextState);
    return nextState;
  }

  clearCurrentGame(): SaveState {
    return this.updateCurrentGame(null);
  }

  updateProgress(updater: (progress: ProgressState) => ProgressState): SaveState {
    const nextState: SaveState = {
      ...this.state,
      progress: updater(this.state.progress),
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
    const progress = this.state.progress;
    const node = getNodeById(nodeId);
    const rewardId = node?.rewardId ?? null;
    const reward = rewardId ? getRewardById(rewardId) : undefined;
    const coinsAwarded = ECONOMY.winCoins;
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
}
