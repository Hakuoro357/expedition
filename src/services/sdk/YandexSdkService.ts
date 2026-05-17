import type { Locale } from "@/services/i18n/locales";
import type { SdkService, ProductInfo, PurchaseResult, PurchasesResult } from "@/services/sdk/SdkService";

function waitForYaGames(timeoutMs: number): Promise<YaGamesGlobal | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    if (window.YaGames) {
      resolve(window.YaGames);
      return;
    }
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (window.YaGames) {
        window.clearInterval(interval);
        resolve(window.YaGames);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        window.clearInterval(interval);
        resolve(null);
      }
    }, 50);
  });
}

export class YandexSdkService implements SdkService {
  private sdk: YaGamesSDK | null = null;
  private initialized = false;
  private player: YaGamesPlayer | null = null;
  private payments: YaGamesPayments | null = null;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // CDN-скрипт Яндекс SDK (https://yandex.ru/games/sdk/v2) выставляет
      // window.YaGames асинхронно: сам тег в HTML грузится синхронно, но
      // содержит бутстрап, который догружает основной бандл и только тогда
      // проставляет YaGames. Если в этот момент позвать YaGames.init(), SDK
      // бросит "SDK is not initialised. Wait for 'init' call". Поллим
      // window.YaGames в течение 5 секунд — это согласовано с поведением
      // официальных игр из каталога.
      const yaGames = await waitForYaGames(5000);
      this.sdk = yaGames ? await yaGames.init() : null;
      this.initialized = true;

      // Try to initialize payments — may fail if not enabled in Yandex Console
      if (this.sdk?.getPayments) {
        try {
          this.payments = await this.sdk.getPayments({ signed: false });
        } catch (err) {
          console.warn("[sdk] getPayments unavailable", err);
          this.payments = null;
        }
      }
    } catch (error) {
      console.warn("[sdk] failed to initialize", error);
      this.sdk = null;
      this.initialized = true;
    }
  }

  isAvailable(): boolean {
    return this.sdk !== null;
  }

  /** Сообщает Яндексу что игра загружена и интерактивна. Скрывает загрузочный спиннер портала. */
  signalReady(): void {
    try {
      this.sdk?.features?.LoadingAPI?.ready();
    } catch (error) {
      console.warn("[sdk] LoadingAPI.ready failed", error);
    }
  }

  /** Сигнализирует начало активного геймплея (для пауз рекламы). */
  gameplayStart(): void {
    try {
      this.sdk?.features?.GameplayAPI?.start();
    } catch (error) {
      console.warn("[sdk] GameplayAPI.start failed", error);
    }
  }

  /** Сигнализирует остановку активного геймплея. */
  gameplayStop(): void {
    try {
      this.sdk?.features?.GameplayAPI?.stop();
    } catch (error) {
      console.warn("[sdk] GameplayAPI.stop failed", error);
    }
  }

  /**
   * Возвращает определённый язык, ограниченный поддерживаемыми Locale.
   * Поддерживаем ru / en / tr — все три имеют полные локализационные
   * пакеты (UI, нарратив, reward-тексты, точки маршрута, артефакты).
   * Всё остальное фолбечится на en.
   */
  detectLocale(): Locale | null {
    const raw =
      this.sdk?.environment?.i18n?.lang ??
      (typeof navigator !== "undefined" ? navigator.language : "");
    if (!raw) return null;
    const lang = raw.slice(0, 2).toLowerCase();
    if (lang === "ru") return "ru";
    if (lang === "tr") return "tr";
    return "en";
  }

  /** Возвращает кешированного player или загружает его. null если SDK недоступен. */
  private async getPlayer(): Promise<YaGamesPlayer | null> {
    if (!this.sdk?.getPlayer) return null;
    if (this.player) return this.player;
    try {
      this.player = await this.sdk.getPlayer();
      return this.player;
    } catch (error) {
      console.warn("[sdk] getPlayer failed", error);
      return null;
    }
  }

  /** Загружает сохранение из облака. Возвращает JSON-строку или null. */
  async getCloudSave(): Promise<string | null> {
    const player = await this.getPlayer();
    if (!player?.getData) return null;
    try {
      const data = await player.getData(["save"]);
      const value = data["save"];
      return typeof value === "string" && value.length > 0 ? value : null;
    } catch (error) {
      console.warn("[sdk] getCloudSave failed", error);
      return null;
    }
  }

  /** Сохраняет JSON-строку в облако. Тихо проглатывает ошибки. */
  async setCloudSave(json: string): Promise<void> {
    const player = await this.getPlayer();
    if (!player?.setData) return;
    try {
      await player.setData({ save: json }, true);
    } catch (error) {
      console.warn("[sdk] setCloudSave failed", error);
    }
  }

  async showRewardedVideo(): Promise<boolean> {
    const adv = this.sdk?.adv;

    if (!adv?.showRewardedVideo) {
      return false;
    }

    return new Promise<boolean>((resolve) => {
      let settled = false;
      const settle = (value: boolean): void => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      adv.showRewardedVideo?.({
        callbacks: {
          onRewarded: () => settle(true),
          onClose: () => settle(false),
          onError: () => settle(false)
        }
      });
    });
  }

  // --- SdkService surface: Yandex direct adapter does not support these.
  // Kept as no-ops so the interface is satisfied and main-branch Yandex
  // builds compile without forcing all callers into GP-only paths.

  async showInterstitial(): Promise<void> {
    // Yandex: could be wired via adv.showFullscreenAdv, left as no-op
    // here because current main-branch flow doesn't use it.
  }

  onPause(_callback: () => void): void {
    // Yandex SDK does not expose explicit pause events — SoundService
    // falls back to document.visibilitychange.
  }

  onResume(_callback: () => void): void {
    // Same as onPause.
  }

  onLanguageChange(_callback: (lang: string) => void): void {
    // Yandex locale is fixed per portal session; no runtime change event.
  }

  changeLanguage(_locale: Locale): void {
    // Yandex Games не имеет runtime-API смены языка из SDK — язык
    // задаётся пользователем в профиле и приходит при старте через
    // environment.i18n.lang.
  }

  onMuteChange(_callback: (muted: boolean) => void): void {
    // Yandex does not expose platform mute; soundservice uses its own user sliders.
  }

  isMuted(): boolean {
    return false;
  }

  muteSounds(): void {
    // Yandex Games не имеет платформенного mute API — тумблер из SettingsScene
    // применяется напрямую через SoundService.setPlatformMuted. Этот метод —
    // noop, чтобы общий интерфейс SdkService оставался единым.
  }

  unmuteSounds(): void {
    // noop on Yandex (см. muteSounds).
  }

  setSfxMuted(_muted: boolean): void {
    // Yandex: без платформенного sound-API, состояние применяется локально.
  }

  setMusicMuted(_muted: boolean): void {
    // Yandex: без платформенного sound-API, состояние применяется локально.
  }

  showSticky(): void {
    // Sticky banner is GP-specific — noop on direct Yandex path.
  }

  closeSticky(): void {
    // noop on Yandex.
  }

  refreshSticky(): void {
    // noop on Yandex.
  }

  async showPreloader(): Promise<boolean> {
    // GP-specific placement; Yandex has no direct equivalent.
    return false;
  }

  // Social actions — Yandex SDK не поддерживает share/joinCommunity
  // через единый API (свой набор метрик и фичи через _ya). Для нашей
  // публикации Yandex-через-этот-сервис не требует socials, и UI
  // скрывает кнопки через canShare/canJoinCommunity → false.
  canShare(): boolean {
    return false;
  }

  canJoinCommunity(): boolean {
    return false;
  }

  async share(_options: { text?: string; url?: string; image?: string }): Promise<void> {
    // noop on Yandex (canShare возвращает false → UI не вызывает)
  }

  async joinCommunity(): Promise<boolean> {
    return false;
  }

  onShareResult(_callback: (success: boolean) => void): void {
    // noop
  }

  onJoinCommunityResult(_callback: (success: boolean) => void): void {
    // noop
  }

  // Achievements — Yandex Games не имеет соответствующего public API.
  // UI скрывает кнопку «Достижения» через canUseAchievements() → false.
  canUseAchievements(): boolean {
    return false;
  }

  async fetchAchievements(): Promise<void> {
    // noop — нет SDK-эндпоинта на Yandex.
  }

  getPlayerAchievements(): Array<{ tag: string; progress: number; unlocked: boolean }> {
    return [];
  }

  async unlockAchievement(_tag: string): Promise<boolean> {
    return false;
  }

  async setAchievementProgress(_tag: string, _progress: number): Promise<boolean> {
    return false;
  }

  async openAchievementsOverlay(): Promise<void> {
    // noop
  }

  // ============================================================
  // Payments (Yandex Payments API)
  // ============================================================

  canUsePayments(): boolean {
    return Boolean(this.payments);
  }

  async getProductInfo(tag: string): Promise<ProductInfo | null> {
    if (!this.payments) return null;
    try {
      const catalog = await this.payments.getCatalog();
      const product = catalog.find((p) => p.id === tag);
      if (!product) return null;
      return { tag, title: product.title, price: product.price };
    } catch (err) {
      console.warn("[sdk.getProductInfo]", err);
      return null;
    }
  }

  async purchase(tag: string): Promise<PurchaseResult> {
    if (!this.payments) return { ok: false, reason: "unavailable" };
    try {
      await this.payments.purchase({ id: tag });
      return { ok: true };
    } catch (err) {
      console.error("[sdk.purchase] raw", err);
      if (this.isUnauthorized(err)) return { ok: false, reason: "unauthorized" };
      return { ok: false, reason: "error" };
    }
  }

  async getPurchases(): Promise<PurchasesResult> {
    if (!this.payments) return { ok: false, reason: "unavailable" };
    try {
      const list = await this.payments.getPurchases();
      return { ok: true, purchases: list.map((p) => ({ tag: p.productID })) };
    } catch (err) {
      console.error("[sdk.getPurchases] raw", err);
      if (this.isUnauthorized(err)) return { ok: false, reason: "unauthorized" };
      return { ok: false, reason: "error" };
    }
  }

  async triggerLogin(): Promise<void> {
    try {
      await this.sdk?.auth?.openAuthDialog();
    } catch (err) {
      console.warn("[sdk.auth]", err);
    }
  }

  private isUnauthorized(err: unknown): boolean {
    if (err instanceof Error) {
      return /unauthorized|not.authorized|not_authorized|auth/i.test(err.message);
    }
    if (typeof err === "string") {
      return /unauthorized|not.authorized|not_authorized|auth/i.test(err);
    }
    return false;
  }
}

