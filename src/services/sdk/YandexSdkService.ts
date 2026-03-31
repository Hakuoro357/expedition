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
      adv.showRewardedVideo?.({
        callbacks: {
          onRewarded: () => resolve(true),
          onClose: () => resolve(false),
          onError: () => resolve(false)
        }
      });
    });
  }
}

