import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdsService } from "./AdsService";
import type { SdkService } from "@/services/sdk/SdkService";
import type { AnalyticsService } from "@/services/analytics/AnalyticsService";
import type { SaveService } from "@/services/save/SaveService";
import type { ProgressState } from "@/core/game-state/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeProgress(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    currentChapter: 1,
    unlockedNodes: [],
    completedNodes: [],
    coins: 0,
    artifacts: [],
    dailyClaimedOn: null,
    locale: "ru",
    streakCount: 0,
    lastLoginDate: null,
    ...overrides,
  };
}

function makeSaveMock(progressOverrides: Partial<ProgressState> = {}) {
  const progress = makeProgress(progressOverrides);
  const state = { version: 1 as const, progress, currentGame: null };
  return {
    load: vi.fn(() => state),
    updateProgress: vi.fn((updater: (p: ProgressState) => ProgressState) => {
      state.progress = updater(state.progress);
      return state;
    }),
    flush: vi.fn(async () => undefined),
  } as unknown as SaveService;
}

function makeSdkMock() {
  return {
    showRewardedVideo: vi.fn(async () => true),
    showInterstitial: vi.fn(async () => undefined),
    showSticky: vi.fn(),
    closeSticky: vi.fn(),
    refreshSticky: vi.fn(),
    showPreloader: vi.fn(async () => true),
    gameplayStart: vi.fn(),
    gameplayStop: vi.fn(),
  } as unknown as SdkService;
}

function makeAnalyticsMock() {
  return { track: vi.fn() } as unknown as AnalyticsService;
}

function makeService(progressOverrides: Partial<ProgressState> = {}) {
  const sdk = makeSdkMock();
  const analytics = makeAnalyticsMock();
  const save = makeSaveMock(progressOverrides);
  const service = new AdsService(sdk, analytics, save);
  return { service, sdk, analytics, save };
}

// ── showPreloader ─────────────────────────────────────────────────────────────

describe("AdsService — showPreloader patron gate", () => {
  it("patron flag → returns false without calling sdk", async () => {
    const { service, sdk } = makeService({ patronSupport: true });
    const result = await service.showPreloader();
    expect(result).toBe(false);
    expect(sdk.showPreloader).not.toHaveBeenCalled();
  });

  it("non-patron → calls sdk.showPreloader", async () => {
    const { service, sdk } = makeService();
    await service.showPreloader();
    expect(sdk.showPreloader).toHaveBeenCalled();
  });
});

// ── showInterstitial ──────────────────────────────────────────────────────────

describe("AdsService — showInterstitial patron gate", () => {
  it("patron flag → no-op, sdk not called", async () => {
    const { service, sdk } = makeService({ patronSupport: true });
    await service.showInterstitial("test_placement");
    expect(sdk.showInterstitial).not.toHaveBeenCalled();
  });

  it("non-patron → calls sdk.showInterstitial", async () => {
    const { service, sdk } = makeService();
    await service.showInterstitial("test_placement");
    expect(sdk.showInterstitial).toHaveBeenCalled();
  });
});

// ── showStickyBanner ──────────────────────────────────────────────────────────

describe("AdsService — showStickyBanner patron gate", () => {
  it("patron flag → no-op, sdk not called", () => {
    const { service, sdk } = makeService({ patronSupport: true });
    service.showStickyBanner("test_placement");
    expect(sdk.showSticky).not.toHaveBeenCalled();
  });

  it("non-patron → calls sdk.showSticky", () => {
    const { service, sdk } = makeService();
    service.showStickyBanner("test_placement");
    expect(sdk.showSticky).toHaveBeenCalled();
  });
});

// ── showRewardedVideo ─────────────────────────────────────────────────────────

describe("AdsService — showRewardedVideo patron gate", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("patron flag → returns false + analytics rewarded_offer_skipped with reason:patron", async () => {
    const { service, sdk, analytics } = makeService({ patronSupport: true });
    const result = await service.showRewardedVideo("test_placement");
    expect(result).toBe(false);
    expect(sdk.showRewardedVideo).not.toHaveBeenCalled();
    expect(analytics.track).toHaveBeenCalledWith("rewarded_offer_skipped", {
      placement: "test_placement",
      reason: "patron",
    });
  });

  it("non-patron → calls sdk.showRewardedVideo", async () => {
    const { service, sdk } = makeService();
    await service.showRewardedVideo("test_placement");
    expect(sdk.showRewardedVideo).toHaveBeenCalled();
  });
});

// ── patron cache methods ──────────────────────────────────────────────────────

describe("AdsService — patron cache management", () => {
  it("markPatronConfirmed: sets cached flag AND calls sdk.closeSticky", async () => {
    const { service, sdk } = makeService();
    service.markPatronConfirmed();
    expect(sdk.closeSticky).toHaveBeenCalled();
    // After confirmed, isPatron() returns true → showPreloader returns false
    const result = await service.showPreloader();
    expect(result).toBe(false);
    expect(sdk.showPreloader).not.toHaveBeenCalled();
  });

  it("setPatronOptimistic: sets cached flag but does NOT call closeSticky", async () => {
    const { service, sdk } = makeService();
    service.setPatronOptimistic();
    expect(sdk.closeSticky).not.toHaveBeenCalled();
    // But isPatron() is true → ads suppressed
    const result = await service.showPreloader();
    expect(result).toBe(false);
  });

  it("clearPatronOptimistic: resets cached → ads poll save.load()", async () => {
    const { service, sdk } = makeService(); // no patronSupport in save
    service.setPatronOptimistic();

    // With optimistic set — suppressed
    expect(await service.showPreloader()).toBe(false);

    service.clearPatronOptimistic();

    // After clear — no patronSupport in save → sdk called
    await service.showPreloader();
    expect(sdk.showPreloader).toHaveBeenCalled();
  });

  it("clearPatronOptimistic + save.patronSupport=true → still patron via save", async () => {
    const { service, sdk } = makeService({ patronSupport: true });
    service.setPatronOptimistic();
    service.clearPatronOptimistic();
    // patronCached is undefined, falls back to save → patronSupport=true
    const result = await service.showPreloader();
    expect(result).toBe(false);
    expect(sdk.showPreloader).not.toHaveBeenCalled();
  });
});
