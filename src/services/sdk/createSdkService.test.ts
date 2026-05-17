// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSdkService } from "@/services/sdk/createSdkService";

// __PLATFORM__ is a global constant injected by vite define.
// vi.stubGlobal sets it on the globalThis object so the factory reads the
// stubbed value at call-time.

function setLocationSearch(search: string): void {
  Object.defineProperty(window, "location", {
    writable: true,
    configurable: true,
    value: { search },
  });
}

describe("createSdkService", () => {
  beforeEach(() => {
    setLocationSearch("");
    vi.unstubAllGlobals();
  });

  it("returns GamePushSdkService when __PLATFORM__ = gamepush and no URL override", () => {
    vi.stubGlobal("__PLATFORM__", "gamepush");
    setLocationSearch("");
    const service = createSdkService();
    expect(service.constructor.name).toBe("GamePushSdkService");
  });

  it("returns YandexSdkService when __PLATFORM__ = yandex and no URL override", () => {
    vi.stubGlobal("__PLATFORM__", "yandex");
    setLocationSearch("");
    const service = createSdkService();
    expect(service.constructor.name).toBe("YandexSdkService");
  });

  it("returns DevStubSdkService when ?platform=dev URL override (DEV env is true in vitest)", () => {
    vi.stubGlobal("__PLATFORM__", "gamepush");
    setLocationSearch("?platform=dev");
    const service = createSdkService();
    expect(service.constructor.name).toBe("DevStubSdkService");
  });

  it("returns YandexSdkService when ?platform=yandex URL override", () => {
    vi.stubGlobal("__PLATFORM__", "gamepush");
    setLocationSearch("?platform=yandex");
    const service = createSdkService();
    expect(service.constructor.name).toBe("YandexSdkService");
  });

  it("returns GamePushSdkService when ?platform=gamepush URL override", () => {
    vi.stubGlobal("__PLATFORM__", "yandex");
    setLocationSearch("?platform=gamepush");
    const service = createSdkService();
    expect(service.constructor.name).toBe("GamePushSdkService");
  });
});
