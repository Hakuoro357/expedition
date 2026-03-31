/// <reference types="vite/client" />

interface YaGamesPlayer {
  getMode?: () => Promise<string>;
  getData?: (keys?: string[]) => Promise<Record<string, unknown>>;
  setData?: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
}

interface YaGamesFeatures {
  LoadingAPI?: {
    ready: () => void;
  };
  GameplayAPI?: {
    start: () => void;
    stop: () => void;
  };
}

interface YaGamesPayments {
  purchase?: (options: { id: string }) => Promise<unknown>;
}

interface YaGamesAdv {
  showRewardedVideo?: (options: {
    callbacks?: {
      onOpen?: () => void;
      onRewarded?: () => void;
      onClose?: () => void;
      onError?: (error: unknown) => void;
    };
  }) => void;
}

interface YaGamesSDK {
  features?: YaGamesFeatures;
  adv?: YaGamesAdv;
  getPlayer?: () => Promise<YaGamesPlayer>;
  getPayments?: () => Promise<YaGamesPayments>;
}

interface YaGamesGlobal {
  init: () => Promise<YaGamesSDK>;
}

interface Window {
  YaGames?: YaGamesGlobal;
}

