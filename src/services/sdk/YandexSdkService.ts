import type { Locale } from "@/services/i18n/locales";

export class YandexSdkService {
  private sdk: YaGamesSDK | null = null;
  private initialized = false;
  private player: YaGamesPlayer | null = null;

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      this.sdk = window.YaGames ? await window.YaGames.init() : null;
      this.initialized = true;
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
   * Турецкий пока не поддержан в Locale union — будет добавлен вместе
   * с пакетом турецкой локализации; до тех пор tr-игроки получают en.
   */
  detectLocale(): Locale | null {
    const raw =
      this.sdk?.environment?.i18n?.lang ??
      (typeof navigator !== "undefined" ? navigator.language : "");
    if (!raw) return null;
    const lang = raw.slice(0, 2).toLowerCase();
    if (lang === "ru") return "ru";
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
}

