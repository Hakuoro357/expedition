import type { Locale } from "@/services/i18n/locales";

/**
 * Platform-agnostic SDK interface.
 *
 * Every platform adapter (Yandex, GamePush, stub) implements this
 * interface so the rest of the codebase never touches platform-specific
 * API directly.  Reusable across all games in the project.
 */
export interface SdkService {
  /** Bootstrap the SDK. Must be called once at boot before anything else. */
  init(): Promise<void>;

  /** Whether the underlying platform SDK initialized successfully. */
  isAvailable(): boolean;

  /** Tell the platform the game is fully loaded and interactive. */
  signalReady(): void;

  /** Signal that the player is actively playing (suppresses interstitials). */
  gameplayStart(): void;

  /** Signal that active gameplay has paused / ended. */
  gameplayStop(): void;

  /** Detect player locale from the platform. null = unknown / unavailable. */
  detectLocale(): Locale | null;

  /** Show a rewarded video ad. Resolves `true` if the player watched it. */
  showRewardedVideo(): Promise<boolean>;

  /** Show an interstitial (fullscreen) ad. Resolves when closed. */
  showInterstitial(): Promise<void>;

  /** Load a cloud save string. null = no save / unavailable. */
  getCloudSave(): Promise<string | null>;

  /** Persist a cloud save string. Silently swallows errors. */
  setCloudSave(json: string): Promise<void>;

  /** Subscribe to platform pause event (ads, tab switch). Used for sound control. */
  onPause(callback: () => void): void;

  /** Subscribe to platform resume event. */
  onResume(callback: () => void): void;

  /** Subscribe to language change event (GP sandbox language switch). */
  onLanguageChange(callback: (lang: string) => void): void;
}
