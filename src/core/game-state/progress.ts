import type { ProgressState } from "@/core/game-state/types";

import { ECONOMY } from "@/app/config/economy";

export function createInitialProgressState(): ProgressState {
  return {
    currentChapter: 1,
    unlockedNodes: ["c1n1"],
    completedNodes: [],
    coins: ECONOMY.startingCoins,
    artifacts: [],
    dailyClaimedOn: null,
    locale: "ru",
    streakCount: 0,
    lastLoginDate: null,
  };
}

