import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentsService, PATRON_TAG, PATRON_BONUS_COINS } from "./PaymentsService";
import type { SdkService, PurchasesResult } from "@/services/sdk/SdkService";
import type { AnalyticsService } from "@/services/analytics/AnalyticsService";
import type { SaveService } from "@/services/save/SaveService";
import type { AchievementsReconciler } from "@/services/achievements/AchievementsReconciler";
import type { AdsService } from "@/services/ads/AdsService";
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

function makeSdkMock(overrides: Partial<{
  canUsePayments: boolean;
  purchase: () => ReturnType<SdkService["purchase"]>;
  getPurchases: () => Promise<PurchasesResult>;
  getProductInfo: () => ReturnType<SdkService["getProductInfo"]>;
}> = {}) {
  return {
    canUsePayments: vi.fn(() => overrides.canUsePayments ?? true),
    purchase: vi.fn(overrides.purchase ?? (() => Promise.resolve({ ok: true }))),
    getPurchases: vi.fn(overrides.getPurchases ?? (() => Promise.resolve({ ok: true, purchases: [] }))),
    getProductInfo: vi.fn(overrides.getProductInfo ?? (() => Promise.resolve(null))),
  } as unknown as SdkService;
}

function makeAnalyticsMock() {
  return { track: vi.fn() } as unknown as AnalyticsService;
}

function makeAchievementsMock() {
  return {
    markPatronJustActivated: vi.fn(),
    reconcile: vi.fn(),
  } as unknown as AchievementsReconciler;
}

function makeAdsMock() {
  return {
    markPatronConfirmed: vi.fn(),
    setPatronOptimistic: vi.fn(),
    clearPatronOptimistic: vi.fn(),
  } as unknown as AdsService;
}

function makeService(
  sdkOverrides: Parameters<typeof makeSdkMock>[0] = {},
  progressOverrides: Partial<ProgressState> = {},
) {
  const sdk = makeSdkMock(sdkOverrides);
  const analytics = makeAnalyticsMock();
  const save = makeSaveMock(progressOverrides);
  const achievements = makeAchievementsMock();
  const ads = makeAdsMock();
  const service = new PaymentsService(sdk, analytics, save, achievements, ads);
  return { service, sdk, analytics, save, achievements, ads };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("PaymentsService — purchasePatron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("happy-path: sets patron flags, grants 300 coins, tracks success, calls markPatron", async () => {
    const { service, analytics, save, achievements, ads } = makeService(
      { purchase: () => Promise.resolve({ ok: true }) },
    );

    const result = await service.purchasePatron("settings");

    expect(result.ok).toBe(true);
    expect(analytics.track).toHaveBeenCalledWith("patron_purchase_attempt", { source: "settings" });
    expect(analytics.track).toHaveBeenCalledWith("patron_purchase_success", { source: "settings" });
    expect(save.updateProgress).toHaveBeenCalled();
    const progress = save.load().progress;
    expect(progress.patronSupport).toBe(true);
    expect(progress.patronBonusGranted).toBe(true);
    expect(progress.coins).toBe(PATRON_BONUS_COINS);
    expect(achievements.markPatronJustActivated).toHaveBeenCalled();
    expect(ads.markPatronConfirmed).toHaveBeenCalled();
    expect(save.flush).toHaveBeenCalled();
  });

  it("canUsePayments=false → blocked event, no purchase attempt", async () => {
    const { service, analytics, sdk } = makeService({ canUsePayments: false });

    const result = await service.purchasePatron("settings");

    expect(result.ok).toBe(false);
    expect(analytics.track).toHaveBeenCalledWith("patron_purchase_blocked", { source: "settings", reason: "not_eligible" });
    expect(sdk.purchase).not.toHaveBeenCalled();
  });

  it("already patron → blocked event, no purchase attempt", async () => {
    const { service, analytics, sdk } = makeService({}, { patronSupport: true });

    const result = await service.purchasePatron("settings");

    expect(result.ok).toBe(false);
    expect(analytics.track).toHaveBeenCalledWith("patron_purchase_blocked", expect.objectContaining({ reason: "not_eligible" }));
    expect(sdk.purchase).not.toHaveBeenCalled();
  });

  it("cancelled → patron_purchase_cancelled event", async () => {
    const { service, analytics } = makeService({
      purchase: () => Promise.resolve({ ok: false, reason: "cancelled" }),
    });

    const result = await service.purchasePatron("settings");

    expect(result.ok).toBe(false);
    expect(analytics.track).toHaveBeenCalledWith("patron_purchase_cancelled", expect.objectContaining({ reason: "cancelled" }));
  });

  it("error → patron_purchase_error event", async () => {
    const { service, analytics } = makeService({
      purchase: () => Promise.resolve({ ok: false, reason: "error" }),
    });

    const result = await service.purchasePatron("settings");

    expect(result.ok).toBe(false);
    expect(analytics.track).toHaveBeenCalledWith("patron_purchase_error", expect.objectContaining({ reason: "error" }));
  });

  it("in-flight lock: 2nd purchase while 1st pending → blocked event", async () => {
    let resolveFirst!: () => void;
    const firstPurchase = new Promise<{ ok: true }>((resolve) => {
      resolveFirst = () => resolve({ ok: true });
    });

    const { service, analytics } = makeService({ purchase: () => firstPurchase });

    const first = service.purchasePatron("settings");
    const second = service.purchasePatron("settings");

    const secondResult = await second;
    expect(secondResult.ok).toBe(false);
    expect(analytics.track).toHaveBeenCalledWith("patron_purchase_blocked", expect.objectContaining({ reason: "in_flight" }));

    resolveFirst();
    await first;
  });
});

describe("PaymentsService — restorePatronManual", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("alreadyActive: platform confirms + local says yes → alreadyActive:true, no activate", async () => {
    const { service, ads } = makeService(
      { getPurchases: () => Promise.resolve({ ok: true, purchases: [{ tag: PATRON_TAG }] }) },
      { patronSupport: true },
    );

    const result = await service.restorePatronManual();

    expect(result).toEqual({ ok: true, alreadyActive: true });
    expect(ads.markPatronConfirmed).toHaveBeenCalled();
  });

  it("not_found: platform has no purchase, local empty → reason:not_found", async () => {
    const { service } = makeService({
      getPurchases: () => Promise.resolve({ ok: true, purchases: [] }),
    });

    const result = await service.restorePatronManual();

    expect(result).toEqual({ ok: false, alreadyActive: false, reason: "not_found" });
  });

  it("mismatch: platform NOT patron, local says yes → mismatch:true", async () => {
    const { service, ads } = makeService(
      { getPurchases: () => Promise.resolve({ ok: true, purchases: [] }) },
      { patronSupport: true },
    );

    const result = await service.restorePatronManual();

    expect(result).toEqual({ ok: true, alreadyActive: true, mismatch: true });
    expect(ads.markPatronConfirmed).toHaveBeenCalled();
  });

  it("unauthorized → reason:unauthorized, alreadyActive reflects local", async () => {
    const { service } = makeService({
      getPurchases: () => Promise.resolve({ ok: false, reason: "unauthorized" }),
    });

    const result = await service.restorePatronManual();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unauthorized");
      expect(result.alreadyActive).toBe(false);
    }
  });

  it("U3: SDK hangs — returns within RESTORE_MANUAL_TIMEOUT_MS with reason:timeout", async () => {
    const { service } = makeService({
      getPurchases: () => new Promise(() => { /* never resolves */ }),
    });

    const resultPromise = service.restorePatronManual();
    // Advance timers past the 10s manual timeout
    await vi.advanceTimersByTimeAsync(10001);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("timeout");
    }
  });

  it("in-flight: second call while first pending → blocked", async () => {
    let resolveFirst!: (r: PurchasesResult) => void;
    const pending = new Promise<PurchasesResult>((resolve) => { resolveFirst = resolve; });
    const { service, analytics } = makeService({ getPurchases: () => pending });

    const first = service.restorePatronManual();
    const second = service.restorePatronManual();

    const secondResult = await second;
    expect(secondResult.ok).toBe(false);
    expect(analytics.track).toHaveBeenCalledWith("patron_purchase_blocked", expect.objectContaining({ reason: "in_flight" }));

    resolveFirst({ ok: true, purchases: [] });
    await first;
  });
});

describe("PaymentsService — restoreOnBoot (U1, U2)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("U1: canUsePayments=false + localPatron=true → confirmPatronEntitlement called, no analytics noise", async () => {
    const { service, ads, achievements, analytics } = makeService(
      { canUsePayments: false },
      { patronSupport: true },
    );

    const p = service.restoreOnBoot();
    await vi.runAllTimersAsync();
    await p;

    expect(ads.markPatronConfirmed).toHaveBeenCalled();
    expect(achievements.reconcile).toHaveBeenCalled();
    // No patron_purchase_attempt or purchase analytics
    const trackCalls = (analytics.track as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(trackCalls).not.toContain("patron_purchase_attempt");
    expect(trackCalls).not.toContain("patron_purchase_success");
  });

  it("U1: canUsePayments=false + localPatron=false → no confirmPatronEntitlement, silent return", async () => {
    const { service, ads, analytics } = makeService({ canUsePayments: false });

    const p = service.restoreOnBoot();
    await vi.runAllTimersAsync();
    await p;

    expect(ads.markPatronConfirmed).not.toHaveBeenCalled();
    const trackCalls = (analytics.track as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(trackCalls.filter(e => e.startsWith("patron_"))).toHaveLength(0);
  });

  it("U2: boot timeout fires — late SDK success still calls activatePatron via .then()", async () => {
    let resolveGetPurchases!: (r: PurchasesResult) => void;
    const latePurchases = new Promise<PurchasesResult>((resolve) => { resolveGetPurchases = resolve; });

    const { service, ads, analytics } = makeService({ getPurchases: () => latePurchases });

    const bootPromise = service.restoreOnBoot();
    // Advance past boot timeout (1500ms)
    await vi.advanceTimersByTimeAsync(1600);
    await bootPromise;

    // SDK hasn't responded yet — boot returned
    expect(ads.markPatronConfirmed).not.toHaveBeenCalled();

    // Now SDK resolves with a purchase — late .then() should activate
    resolveGetPurchases({ ok: true, purchases: [{ tag: PATRON_TAG }] });
    // Flush microtasks
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(ads.markPatronConfirmed).toHaveBeenCalled();
    const trackCalls = (analytics.track as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(trackCalls).toContain("patron_purchase_restore");
  });

  it("U2: setPatronOptimistic called when localHint=true and no localPatron", async () => {
    // Inject localStorage mock to simulate localHint=true
    const localStorageMock: Record<string, string> = { isPatron: "true" };
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => localStorageMock[k] ?? null,
      setItem: (k: string, v: string) => { localStorageMock[k] = v; },
      removeItem: (k: string) => { delete localStorageMock[k]; },
    });

    let resolveGetPurchases!: (r: PurchasesResult) => void;
    const neverResolves = new Promise<PurchasesResult>((resolve) => { resolveGetPurchases = resolve; });

    const { service, ads } = makeService({ getPurchases: () => neverResolves });

    const bootPromise = service.restoreOnBoot();

    await vi.advanceTimersByTimeAsync(1600);
    await bootPromise;

    // setPatronOptimistic was called (localHint && !localPatron path)
    expect(ads.setPatronOptimistic).toHaveBeenCalled();
    // timeout fired while SDK pending and no localPatron → clear optimistic
    expect(ads.clearPatronOptimistic).toHaveBeenCalled();

    // cleanup
    resolveGetPurchases({ ok: true, purchases: [] });
    vi.unstubAllGlobals();
  });
});

describe("PaymentsService — confirmPatronEntitlement (U4)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("U4: preserved-path calls reconcile to repair missing achievements", async () => {
    // localPatron=true, canUsePayments=false → goes through U1 confirmPatronEntitlement("preserved")
    const { service, achievements } = makeService(
      { canUsePayments: false },
      { patronSupport: true },
    );

    const p = service.restoreOnBoot();
    await vi.runAllTimersAsync();
    await p;

    expect(achievements.reconcile).toHaveBeenCalled();
    // preserved path does NOT call markPatronJustActivated
    expect(achievements.markPatronJustActivated).not.toHaveBeenCalled();
  });

  it("purchase-path calls markPatronJustActivated AND reconcile", async () => {
    const { service, achievements } = makeService({
      purchase: () => Promise.resolve({ ok: true }),
    });

    await service.purchasePatron("settings");

    expect(achievements.markPatronJustActivated).toHaveBeenCalled();
    expect(achievements.reconcile).toHaveBeenCalled();
  });
});
