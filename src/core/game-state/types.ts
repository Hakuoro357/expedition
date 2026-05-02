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
};

export type SaveState = {
  version: 1;
  progress: ProgressState;
  currentGame: GameState | null;
};

