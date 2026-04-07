import type { ProgressState } from "@/core/game-state/types";
import type { Locale } from "@/services/i18n/locales";

import { ECONOMY } from "@/app/config/economy";

export function createInitialProgressState(locale: Locale = "ru"): ProgressState {
  return {
    currentChapter: 1,
    unlockedNodes: ["c1n1"],
    completedNodes: [],
    coins: ECONOMY.startingCoins,
    artifacts: [],
    dailyClaimedOn: null,
    locale,
    streakCount: 0,
    lastLoginDate: null,
    prologueShown: false,
    sfxVolume: 0.8,
    musicVolume: 0.6,
  };
}

