/// <reference types="vite/client" />

/** Injected by vite.config.ts — версия из package.json и ISO-время билда. */
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

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

/**
 * gp.sounds — официальный namespace управления звуком по GP-docs.
 * Состояние: isMuted / isSFXMuted / isMusicMuted.
 * События: "mute" / "unmute" / "mute:sfx" / "unmute:sfx" / "mute:music" / "unmute:music".
 * Методы: mute/unmute, muteSFX/unmuteSFX, muteMusic/unmuteMusic.
 */
interface GamePushSounds {
  isMuted: boolean;
  isSFXMuted: boolean;
  isMusicMuted: boolean;
  on(event: string, callback: (...args: unknown[]) => void): void;
  mute(): void;
  unmute(): void;
  muteSFX(): void;
  unmuteSFX(): void;
  muteMusic(): void;
  unmuteMusic(): void;
}

interface GamePushSDK {
  ads: GamePushAds;
  player: GamePushPlayer;
  platform: GamePushPlatform;
  /** Официальный namespace для звука/mute (GP docs). Опционален на случай старых SDK-сборок. */
  sounds?: GamePushSounds;
  language: string;
  isMobile: boolean;
  isPortrait: boolean;
  isDev: boolean;
  serverTime: string;
  isPaused: boolean;
  /**
   * Legacy top-level mute flag. Современный путь — `gp.sounds.isMuted`.
   * Оставлен как fallback для платформ, где `sounds` не доступен.
   */
  isMuted: boolean;
  gameStart(): void;
  gameStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  pause(): void;
  resume(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
  changeLanguage(lang: string): void;
}

