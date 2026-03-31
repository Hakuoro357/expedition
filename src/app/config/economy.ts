/**
 * Economy balance — all tunable numbers in one place.
 * Adjust after first post-launch metrics.
 */
export const ECONOMY = {
  /** Coins awarded for winning an adventure deal */
  winCoins: 50,
  /** Coins awarded for winning a daily deal */
  dailyWinCoins: 80,
  /** Bonus coins when player watches a rewarded ad after winning */
  adBonusCoins: 50,
  /** Bonus coins from daily ad */
  dailyAdBonusCoins: 80,
  /** Extra coins awarded on chapter completion */
  chapterCompleteCoins: 150,

  /** Max undos per game by difficulty */
  maxUndos: { easy: 5, medium: 3, hard: 1 } as Record<string, number>,
  /** Default max undos for daily / quick-play */
  maxUndosDefault: 3,

  /** Free hints per game session before paywall kicks in */
  freeHintsPerGame: 3,
  /** Coin cost for one extra hint after free quota is exhausted */
  hintCoinCost: 15,

  /** Starting coins for a brand new player */
  startingCoins: 50,

  /** Nodes per chapter */
  nodesPerChapter: 10,
  /** Total chapters in v1.0 */
  totalChapters: 3,
  /** Artifacts per chapter */
  artifactsPerChapter: 3,

  /** Node indices that drop an artifact within a chapter (0-based) */
  artifactDropNodes: [2, 5, 9] as number[],

  /** Минимальный интервал между показами rewarded ad (мс) */
  rewardedAdCooldownMs: 60_000,
} as const;
