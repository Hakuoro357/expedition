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

  /**
   * Сообщить платформе, что игрок сменил язык в настройках игры
   * (gp.changeLanguage из GP docs). Платформа сохранит его в своём профиле,
   * чтобы при следующем запуске gp.language вернул то же значение.
   */
  changeLanguage(locale: Locale): void;

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

  /** Subscribe to platform global mute toggle. Used for GP integration of sound with SDK. */
  onMuteChange(callback: (muted: boolean) => void): void;

  /** Current platform mute state. false when SDK unavailable. */
  isMuted(): boolean;

  /**
   * Управление звуком через SDK — требование GP
   * (https://docs.gamepush.com/ru/docs/sounds/): пользовательский UI
   * должен дёргать `gp.sounds.mute()/unmute()`, чтобы глобальное
   * состояние платформы синхронизировалось с игровым тумблером.
   * Звук в самой игре применяется через слушатель `onMuteChange` —
   * то есть вызов `muteSounds()` вызовет `mute` event, который
   * обновит `SoundService.platformMuted`.
   */
  muteSounds(): void;
  unmuteSounds(): void;

  /**
   * Отдельные SFX/Music тумблеры SDK (см. gp.sounds.muteSFX/Music).
   * GP API оперирует только бинарными состояниями — уровень громкости
   * игра держит сама в SoundService, но факт «заглушено/нет» должен
   * синхронизироваться с SDK при переходе ползунка через 0.
   */
  setSfxMuted(muted: boolean): void;
  setMusicMuted(muted: boolean): void;

  /**
   * Show a non-invasive sticky banner (overlay that stays on screen during gameplay).
   * Unlike rewarded / interstitial, sticky does NOT pause the game.
   */
  showSticky(): void;

  /** Hide the sticky banner. */
  closeSticky(): void;

  /** Request refresh of the sticky banner creative (between gameplay sessions). */
  refreshSticky(): void;

  /**
   * Show the preloader ad (fullscreen ad displayed before gameStart).
   * Must be awaited — platform closes it when the player dismisses / ad ends.
   * Resolves true if ad was shown, false on unavailable / error.
   */
  showPreloader(): Promise<boolean>;
}
