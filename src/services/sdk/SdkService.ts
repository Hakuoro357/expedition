import type { Locale } from "@/services/i18n/locales";

// ============================================================
// Payments types
// ============================================================

export type ProductInfo = { tag: string; title: string; price: string };

export type PurchaseResult =
  | { ok: true }
  | { ok: false; reason: "cancelled" | "error" | "unavailable" | "unauthorized" };

export type PurchasesResult =
  | { ok: true; purchases: Array<{ tag: string }> }
  | { ok: false; reason: "timeout" | "error" | "unauthorized" | "unavailable" };

// Reason union from PurchaseResult (single purchase attempt failures).
export type PurchaseFailureReason = Extract<PurchaseResult, { ok: false }>["reason"];
// Reason union from PurchasesResult (entitlement/restore lookup failures).
export type PurchasesFailureReason = Extract<PurchasesResult, { ok: false }>["reason"];

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

  /**
   * GamePush social actions
   * (https://docs.gamepush.com/ru/docs/social-actions/). Поверх
   * платформенных API VK/OK/Telegram. Все вызовы синхронные;
   * результат приходит событием через `onShareResult`. Если SDK
   * платформенно не поддерживает share/community — `canShare()` /
   * `canJoinCommunity()` вернут false и кнопки скрываются в UI.
   *
   * Квота: на момент v0.3.51 GP-доки не упоминают лимит для socials
   * (это платформенные действия, не GP analytics-events). Тем не
   * менее cooldown в UI-слое (1 share / партию) защищает от спам-
   * кликов и от потенциального ужесточения квоты в будущем.
   */
  canShare(): boolean;
  canJoinCommunity(): boolean;
  /**
   * Открыть платформенный share-dialog. Promise resolves когда диалог
   * закрылся / share завершился. Errors (network, отмена, etc.)
   * проглатываются в имплементации — Promise всегда resolves, и не
   * выбрасывает unhandled rejection в global handler. Для аналитики
   * результата подписываться на onShareResult.
   */
  share(options: { text?: string; url?: string; image?: string }): Promise<void>;
  /**
   * Открыть платформенный join-community диалог. Resolves true если
   * пользователь присоединился, иначе false. Errors проглатываются
   * (resolve false).
   */
  joinCommunity(): Promise<boolean>;
  /** Subscribe to outcome events. callback(true) = действие выполнено. */
  onShareResult(callback: (success: boolean) => void): void;
  onJoinCommunityResult(callback: (success: boolean) => void): void;

  // ============================================================
  // Achievements API (gp.achievements.*)
  // Канон: https://gamepush.com/sdk/docs/classes/Achievements.html
  //
  // R3 fix M2: namespace `achievements`, не `socials.playerAchievementsList`.
  // R3 fix M3: fetchAchievements() перед чтением sync list — bootstrap.
  // R3 fix M4: Promise<boolean> = "write accepted" (НЕ "unlocked").
  //   Unlock-status reconciler определяет сам через `capped >= meta.max`.
  // ============================================================

  /**
   * Whether the platform supports achievements at all (feature-detection).
   * GamePush: true если SDK инициализирован и `gp.achievements` доступен.
   * Yandex: всегда false (нет соответствующего API).
   */
  canUseAchievements(): boolean;
  /**
   * Принудительный fetch с GP-бэка перед чтением sync-списка.
   * Resolves когда playerAchievementsList гарантированно актуален.
   * Used by reconciler.bootstrap (R3 fix M3).
   */
  fetchAchievements(): Promise<void>;
  /**
   * Sync-чтение списка ачивок игрока. Возвращает массив { tag, progress, unlocked }.
   * Безопасно вызывать многократно — GP кэширует. Возвращает [] если SDK
   * недоступен.
   */
  getPlayerAchievements(): Array<{ tag: string; progress: number; unlocked: boolean }>;
  /**
   * Unlock one-shot ачивку. Resolves `true` если SDK принял write без error
   * (НЕ означает "unlocked" — для max-ачивок reconciler определяет unlock
   * через `capped >= meta.max`). Errors проглатываются (resolve false).
   */
  unlockAchievement(tag: string): Promise<boolean>;
  /**
   * Set progress для max-ачивки. Reconciler передаёт уже capped значение.
   * Resolves `true` если SDK принял write без error (R3 fix M4).
   */
  setAchievementProgress(tag: string, progress: number): Promise<boolean>;
  /**
   * Открыть native overlay со списком ачивок (если поддерживается платформой).
   * Resolves когда оверлей закрыт / no-op если не поддерживается.
   */
  openAchievementsOverlay(): Promise<void>;

  // ============================================================
  // Payments API
  // ============================================================

  /** Whether the platform supports payments (feature-detection). */
  canUsePayments(): boolean;

  /**
   * Get product info by tag. Returns null if unavailable / not found.
   * May fetch product catalog from platform on first call (cached).
   */
  getProductInfo(tag: string): Promise<ProductInfo | null>;

  /**
   * Initiate a purchase flow. Returns ok:true on success.
   * Errors are classified: cancelled / error / unavailable / unauthorized.
   */
  purchase(tag: string): Promise<PurchaseResult>;

  /**
   * Fetch the list of purchases made by the player on this platform.
   * Used for restore-on-boot and manual restore flows.
   */
  getPurchases(): Promise<PurchasesResult>;

  /**
   * Trigger native login dialog (Yandex auth flow).
   * No-op on platforms where host handles auth (GamePush, DevStub).
   */
  triggerLogin(): Promise<void>;
}
