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
  status: GameStatus;
  stock: Pile;
  waste: Pile;
  foundations: Pile[];
  tableau: Pile[];
  undoCount: number;
  hintCount: number;
};

export type ProgressState = {
  currentChapter: number;
  unlockedNodes: string[];
  completedNodes: string[];
  coins: number;
  artifacts: string[];
  dailyClaimedOn: string | null;
  locale: "ru" | "en";
  /** Consecutive daily login streak (days) */
  streakCount: number;
  /** ISO date string of the last daily login */
  lastLoginDate: string | null;
};

export type SaveState = {
  version: 1;
  progress: ProgressState;
  currentGame: GameState | null;
};

