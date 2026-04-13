import type { Locale } from "@/services/i18n/locales";
import type { SdkService } from "@/services/sdk/SdkService";

/**
 * Wait for GamePush SDK to be available on `window.__gp`.
 *
 * The inline script in index.html registers `window.onGPInit` BEFORE
 * the GamePush CDN script loads, so by the time this function runs
 * `window.__gp` is usually already set.  We poll as a safety net
 * for slow networks where the CDN script hasn't finished yet.
 */
function waitForGamePush(timeoutMs: number): Promise<GamePushSDK | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    if (window.__gp) {
      resolve(window.__gp);
      return;
    }
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (window.__gp) {
        window.clearInterval(interval);
        resolve(window.__gp);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        window.clearInterval(interval);
        resolve(null);
      }
    }, 50);
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
    // GamePush self-test requires explicit use of gp.language.
    // Read it as a separate step so the SDK can track the access.
    const gpLang = this.gp ? this.gp.language : null;
    const raw = gpLang ??
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

  onPause(callback: () => void): void {
    this.gp?.on("pause", callback);
  }

  onResume(callback: () => void): void {
    this.gp?.on("resume", callback);
  }
}
