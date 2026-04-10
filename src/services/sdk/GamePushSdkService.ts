import type { Locale } from "@/services/i18n/locales";
import type { SdkService } from "@/services/sdk/SdkService";

/**
 * Wait for the GamePush SDK to fire its `onGPInit` callback.
 * The script tag in index.html sets `callback=onGPInit` which GamePush
 * calls once the SDK is bootstrapped.  We register the global handler
 * and resolve with the `gp` instance (or null on timeout).
 */
function waitForGamePush(timeoutMs: number): Promise<GamePushSDK | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    // Already initialized (e.g. hot-reload in dev)
    if (window.__gp) {
      resolve(window.__gp);
      return;
    }

    let settled = false;
    const settle = (value: GamePushSDK | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    // GamePush calls window.onGPInit(gp) after bootstrap
    (window as Window & { onGPInit?: (gp: GamePushSDK) => void }).onGPInit = (gp) => {
      window.__gp = gp;
      settle(gp);
    };

    setTimeout(() => settle(null), timeoutMs);
  });
}

const CLOUD_SAVE_FIELD = "save";

export class GamePushSdkService implements SdkService {
  private gp: GamePushSDK | null = null;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      this.gp = await waitForGamePush(5000);
      if (this.gp) {
        await this.gp.player.ready;
      }
      this.initialized = true;
    } catch (error) {
      console.warn("[gp] failed to initialize", error);
      this.gp = null;
      this.initialized = true;
    }
  }

  isAvailable(): boolean {
    return this.gp !== null;
  }

  signalReady(): void {
    try {
      this.gp?.gameStart();
    } catch (error) {
      console.warn("[gp] gameStart failed", error);
    }
  }

  gameplayStart(): void {
    try {
      this.gp?.gameplayStart();
    } catch (error) {
      console.warn("[gp] gameplayStart failed", error);
    }
  }

  gameplayStop(): void {
    try {
      this.gp?.gameplayStop();
    } catch (error) {
      console.warn("[gp] gameplayStop failed", error);
    }
  }

  detectLocale(): Locale | null {
    const raw =
      this.gp?.language ??
      (typeof navigator !== "undefined" ? navigator.language : "");
    if (!raw) return null;
    const lang = raw.slice(0, 2).toLowerCase();
    if (lang === "ru") return "ru";
    if (lang === "tr") return "tr";
    return "en";
  }

  async showRewardedVideo(): Promise<boolean> {
    if (!this.gp?.ads) return false;
    try {
      const success = await this.gp.ads.showRewardedVideo();
      return !!success;
    } catch {
      return false;
    }
  }

  async showInterstitial(): Promise<void> {
    if (!this.gp?.ads) return;
    try {
      await this.gp.ads.showFullscreen();
    } catch {
      // silently swallow — interstitial is best-effort
    }
  }

  async getCloudSave(): Promise<string | null> {
    if (!this.gp?.player) return null;
    try {
      const value = this.gp.player.get(CLOUD_SAVE_FIELD) as unknown;
      return typeof value === "string" && value.length > 0 ? value : null;
    } catch (error) {
      console.warn("[gp] getCloudSave failed", error);
      return null;
    }
  }

  async setCloudSave(json: string): Promise<void> {
    if (!this.gp?.player) return;
    try {
      this.gp.player.set(CLOUD_SAVE_FIELD, json);
      this.gp.player.sync();
    } catch (error) {
      console.warn("[gp] setCloudSave failed", error);
    }
  }
}
