import type { SdkService } from "@/services/sdk/SdkService";
import { GamePushSdkService } from "@/services/sdk/GamePushSdkService";
import { YandexSdkService } from "@/services/sdk/YandexSdkService";
import { DevStubSdkService } from "@/services/sdk/DevStubSdkService";

/**
 * Factory that selects the correct SDK adapter.
 *
 * Selection order:
 * 1. DEV-only URL override via `?platform=<value>` query param.
 *    Allows switching adapters in local dev without rebuilding.
 *    Disabled in production bundles (tree-shaken by Vite).
 * 2. `__PLATFORM__` build flag injected by vite.config.ts via PLATFORM env var.
 *    Defaults to "gamepush" if PLATFORM is not set.
 * 3. DevStubSdkService as final fallback (should not happen in production).
 */
export function createSdkService(): SdkService {
  // DEV-only URL override — stripped from production bundles
  if (import.meta.env.DEV) {
    const forced = new URLSearchParams(window.location.search).get("platform");
    if (forced === "yandex") return new YandexSdkService();
    if (forced === "gamepush") return new GamePushSdkService();
    if (forced === "dev") return new DevStubSdkService();
  }

  // Build-flag dispatch
  if (__PLATFORM__ === "gamepush") return new GamePushSdkService();
  if (__PLATFORM__ === "yandex") return new YandexSdkService();

  return new DevStubSdkService();
}
