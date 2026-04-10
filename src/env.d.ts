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
  environment?: {
    i18n?: {
      lang?: string;
    };
  };
}

interface YaGamesGlobal {
  init: () => Promise<YaGamesSDK>;
}

interface Window {
  YaGames?: YaGamesGlobal;
  __gp?: GamePushSDK;
}

// --- GamePush SDK types ---

interface GamePushAds {
  showRewardedVideo(options?: { showFailedOverlay?: boolean }): Promise<boolean>;
  showFullscreen(options?: { showCountdownOverlay?: boolean }): Promise<boolean>;
  showPreloader(): Promise<boolean>;
  showSticky(): void;
  closeSticky(): void;
  refreshSticky(): void;
  isFullscreenAvailable: boolean;
  isRewardedAvailable: boolean;
  isStickyAvailable: boolean;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

interface GamePushPlayer {
  ready: Promise<void>;
  get(field: string): unknown;
  set(field: string, value: unknown): void;
  add(field: string, value: number): void;
  sync(options?: { override?: boolean; storage?: string }): void;
  load(): void;
  login(): Promise<boolean>;
  logout(): void;
  isLoggedIn: boolean;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

interface GamePushPlatform {
  type: string;
  id: string;
}

interface GamePushSDK {
  ads: GamePushAds;
  player: GamePushPlayer;
  platform: GamePushPlatform;
  language: string;
  isMobile: boolean;
  isPortrait: boolean;
  isDev: boolean;
  serverTime: string;
  isPaused: boolean;
  gameStart(): void;
  gameStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  pause(): void;
  resume(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

