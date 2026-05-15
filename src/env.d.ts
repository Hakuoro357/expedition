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

interface GamePushSocialOptions {
  text?: string;
  url?: string;
  image?: string;
}

interface GamePushSocials {
  isSupportsShare: boolean;
  isSupportsNativeShare?: boolean;
  isSupportsNativePosts?: boolean;
  isSupportsNativeInvite?: boolean;
  canJoinCommunity: boolean;
  isSupportsNativeCommunityJoin?: boolean;
  /**
   * GP типизирует share/joinCommunity как async (Promise) — см.
   * https://gamepush.com/sdk/docs/classes/Socials.html
   * Если указать `void`, то async-rejected дойдёт до global error
   * handler в обход нашего try/catch.
   */
  share(options?: GamePushSocialOptions): Promise<unknown>;
  post?(options?: GamePushSocialOptions): Promise<unknown>;
  invite?(options?: GamePushSocialOptions): Promise<unknown>;
  joinCommunity(): Promise<boolean>;
  on(event: "share" | "post" | "invite" | "joinCommunity", callback: (success: boolean) => void): void;
}

/**
 * gp.achievements — namespace для GP Achievements API.
 * Канон: https://gamepush.com/sdk/docs/classes/Achievements.html
 *
 * R3 fix M2: namespace ИМЕННО `achievements`, не `socials`. Хук с
 * `playerAchievementsList` (sync property) — единственный способ
 * прочитать состояние ачивок без квоты.
 */
interface GamePushAchievementEntry {
  tag: string;
  /** Имя ачивки в текущей локали (для openAchievementsOverlay-аналогов). */
  name?: string;
  /** Текущий progress (для max-ачивок). */
  progress?: number;
  /** Максимум progress (для max-ачивок). */
  maxProgress?: number;
  /** Получена ли ачивка (для one-shot и max). */
  unlocked?: boolean;
}

interface GamePushAchievements {
  /**
   * Sync property — список ачивок текущего игрока на основе последнего
   * fetch (или authoritative GP state при login). Безопасно читать
   * многократно — GP кэширует внутри.
   */
  playerAchievementsList: GamePushAchievementEntry[];
  /**
   * Принудительно подтягивает свежий список с GP-бэка. Per docs
   * deprecated но работающий FREE-метод. Используется на bootstrap
   * перед чтением playerAchievementsList — R3 fix M3.
   */
  fetch(): Promise<unknown>;
  /**
   * Установить progress (квота: +1 to player.sync). Reconciler
   * cap'ит до max в коде, GP сам зачисляет unlock при >= maxProgress.
   * Возвращает объект (UnlockPlayerAchievementOutput per docs).
   */
  setProgress(options: { tag: string; progress: number }): Promise<unknown>;
  /**
   * Прямой unlock one-shot ачивки (квота: +1 to player.sync).
   */
  unlock(options: { tag: string }): Promise<unknown>;
}

interface GamePushSDK {
  ads: GamePushAds;
  player: GamePushPlayer;
  platform: GamePushPlatform;
  /** Официальный namespace для звука/mute (GP docs). Опционален на случай старых SDK-сборок. */
  sounds?: GamePushSounds;
  /** Социальные действия (share / post / invite / joinCommunity). Опционален на случай старых SDK. */
  socials?: GamePushSocials;
  /**
   * GP Achievements API (R3 fix M2 — НЕ socials.playerAchievementsList).
   * Опционален на случай старых SDK-сборок: если поле undefined, наш
   * SDK-wrapper возвращает false из canUseAchievements и UI скрывает кнопку.
   */
  achievements?: GamePushAchievements;
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

