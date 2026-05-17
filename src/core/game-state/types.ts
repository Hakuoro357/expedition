import type { Card } from "@/core/cards/types";

export type PileType = "stock" | "waste" | "tableau" | "foundation";

export type Pile = {
  id: string;
  type: PileType;
  cards: Card[];
};

export type GameStatus = "idle" | "in_progress" | "won" | "lost";

export type GameMode = "adventure" | "daily" | "quick-play";

export type GameState = {
  mode: GameMode;
  dealId: string;
  /** Seed used to shuffle the deck — needed for same-deal restart */
  seed?: number;
  status: GameStatus;
  stock: Pile;
  waste: Pile;
  foundations: Pile[];
  tableau: Pile[];
  undoCount: number;
  /**
   * Total hints used in this game. Monotonic across undo (R2/R3 fix M5):
   * handleUndo сохраняет current hintCount, не откатывает к previous.
   * Это нужно для mastery-achievement `no_hint_win` — иначе игрок мог бы
   * брать hint → undo → удалять факт hint.
   *
   * Optional на legacy cloud-save: isValidGameState не enforce'ит поле,
   * sanitizeGameState выставляет default 0 на load. Новые партии всегда
   * стартуют с 0 (см. createInitialDeal).
   */
  hintCount?: number;
};

/**
 * R2 fix M2: durable одноразовые факты — для one-shot ачивок, выживающих
 * SDK transient-failures. Если `gp.achievements.unlock(first_share)` вернёт
 * false (network glitch), факт сохранён, и на следующем reconcile попытка
 * повторится. Все поля optional на legacy cloud-save.
 */
export type AchievementFacts = {
  sharedEver?: boolean;
  communityJoinedEver?: boolean;
  noUndoWinEver?: boolean;
  noHintWinEver?: boolean;
};

export type ProgressState = {
  currentChapter: number;
  unlockedNodes: string[];
  completedNodes: string[];
  coins: number;
  artifacts: string[];
  dailyClaimedOn: string | null;
  // Локаль UI. Должна быть синхронна с Locale из services/i18n/locales.ts.
  // Не импортируем оттуда напрямую, чтобы избежать циклической зависимости
  // (i18n-слой в принципе не зависит от core/game-state, и наоборот).
  locale: "ru" | "en" | "tr" | "es" | "pt" | "de" | "fr";
  /** Consecutive daily login streak (days) */
  streakCount: number;
  /** ISO date string of the last daily login */
  lastLoginDate: string | null;
  /** Whether the intro prologue has been shown to the player */
  prologueShown?: boolean;
  /** SFX volume 0..1 (persisted across sessions) */
  sfxVolume?: number;
  /** BGM volume 0..1 (persisted across sessions) */
  musicVolume?: number;
  /**
   * Timestamp (ms) of the last successfully watched rewarded video.
   * Stored in the save (not localStorage) so the cooldown is tied to
   * the player's GamePush profile, not the browser storage.
   */
  lastRewardedAt?: number;
  /** Dev-only: all route points are playable */
  devAllPlayable?: boolean;
  /** Whether the player has activated patron support */
  patronSupport?: boolean;
  /** Guard: +300 coin bonus granted once per save state */
  patronBonusGranted?: boolean;
  /** Timestamp (ms) when patron was activated — for future refund logic */
  patronGrantedAt?: number;
  /** Whether the post-3-wins patron push has been shown */
  patronPushShown?: boolean;
  /**
   * R2 fix M2: durable one-shot facts (sharedEver, noUndoWinEver, ...).
   * Optional на legacy. Sanitize нормализует undefined → undefined (читаем
   * через optional chaining).
   */
  achievementFacts?: AchievementFacts;
  /**
   * R5 fix M1: persist lastProgress per-tag для achievement-progress
   * reconcile. На bootstrap reconciler seed'ит lastProgress map отсюда,
   * чтобы reduce quota burn если SDK list пустой.
   */
  achievementProgress?: Record<string, number>;
  /**
   * R3 fix M3: durable record успешно отправленных one-shot unlock'ов.
   * На bootstrap reconciler seed'ит unlockedCache из union (SDK list ∪ this),
   * иначе при пустом SDK list (network glitch) повторяли бы unlock.
   */
  achievementUnlocked?: Record<string, true>;
};

export type SaveState = {
  version: 1;
  progress: ProgressState;
  currentGame: GameState | null;
};

