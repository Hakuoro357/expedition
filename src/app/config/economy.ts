/**
 * Economy balance — all tunable numbers in one place.
 * Adjust after first post-launch metrics.
 */
export const ECONOMY = {
  /** Coins awarded for winning an adventure deal */
  winCoins: 30,
  /** Coins awarded for winning a daily deal */
  dailyWinCoins: 40,
  /** Bonus coins when player watches a rewarded ad after winning */
  adBonusCoins: 50,
  /** Bonus coins from daily ad */
  dailyAdBonusCoins: 60,

  /** Cost to restart after losing */
  restartCost: 40,
  /** Cost per undo */
  undoCost: 10,
  /** Cost per hint (after first free one) */
  hintCost: 10,

  /** Starting coins for a brand new player */
  startingCoins: 30,

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
