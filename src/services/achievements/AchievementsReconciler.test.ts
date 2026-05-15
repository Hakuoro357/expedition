import { beforeEach, describe, expect, it, vi } from "vitest";
import { AchievementsReconciler } from "@/services/achievements/AchievementsReconciler";
import type { SdkService } from "@/services/sdk/SdkService";
import type { ReconcileState } from "@/data/achievements";

type SdkMock = {
  canUseAchievements: ReturnType<typeof vi.fn>;
  fetchAchievements: ReturnType<typeof vi.fn>;
  getPlayerAchievements: ReturnType<typeof vi.fn>;
  unlockAchievement: ReturnType<typeof vi.fn>;
  setAchievementProgress: ReturnType<typeof vi.fn>;
  openAchievementsOverlay: ReturnType<typeof vi.fn>;
};

function createSdkMock(overrides: Partial<SdkMock> = {}): SdkMock & SdkService {
  const base: SdkMock = {
    canUseAchievements: vi.fn(() => true),
    fetchAchievements: vi.fn(async () => undefined),
    getPlayerAchievements: vi.fn(() => []),
    unlockAchievement: vi.fn(async () => true),
    setAchievementProgress: vi.fn(async () => true),
    openAchievementsOverlay: vi.fn(async () => undefined),
    ...overrides,
  };
  // The reconciler uses only the achievements surface — остальные методы
  // не нужны, но интерфейс требует. Касты делают тест лаконичным.
  return base as unknown as SdkMock & SdkService;
}

function emptyState(): ReconcileState {
  return {
    progress: {
      currentChapter: 1,
      unlockedNodes: [],
      completedNodes: [],
      coins: 0,
      artifacts: [],
      dailyClaimedOn: null,
      locale: "ru",
      streakCount: 0,
      lastLoginDate: null,
    },
  };
}

// Утилита: ждём пока все pending микротаски схлопнутся.
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("AchievementsReconciler — basic behavior", () => {
  let persistProgress: ReturnType<typeof vi.fn>;
  let persistUnlocked: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    persistProgress = vi.fn();
    persistUnlocked = vi.fn();
  });

  it("no-op when SDK does not support achievements", async () => {
    const sdk = createSdkMock({ canUseAchievements: vi.fn(() => false) });
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    await r.bootstrap(emptyState());
    expect(sdk.fetchAchievements).not.toHaveBeenCalled();

    r.reconcile({
      progress: { ...emptyState().progress, completedNodes: ["c1n1"] },
    });
    expect(sdk.unlockAchievement).not.toHaveBeenCalled();
  });

  it("caps progress at max and skips when committed already covers", async () => {
    const sdk = createSdkMock();
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    // coins = 750, coins_500 имеет max=500 — должны послать setProgress(500).
    r.reconcile({
      progress: { ...emptyState().progress, coins: 750 },
    });
    await flush();

    expect(sdk.setAchievementProgress).toHaveBeenCalledWith("coins_500", 500);
    expect(persistUnlocked).toHaveBeenCalledWith("coins_500");

    // Повторный reconcile — already unlocked, skip.
    const callsBefore = sdk.setAchievementProgress.mock.calls.length;
    r.reconcile({
      progress: { ...emptyState().progress, coins: 750 },
    });
    await flush();
    expect(sdk.setAchievementProgress).toHaveBeenCalledTimes(callsBefore);
  });

  it("partial progress write commits lastProgress without unlock (R3 fix M4)", async () => {
    const sdk = createSdkMock();
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    // chapter_1_complete max=10. completedNodes = 3 узла chapter 1.
    r.reconcile({
      progress: { ...emptyState().progress, completedNodes: ["c1n1", "c1n2", "c1n3"] },
    });
    await flush();

    expect(sdk.setAchievementProgress).toHaveBeenCalledWith("chapter_1_complete", 3);
    expect(persistProgress).toHaveBeenCalledWith("chapter_1_complete", 3);
    // НЕ unlocked — capped=3 < max=10.
    expect(persistUnlocked).not.toHaveBeenCalledWith("chapter_1_complete");

    // Следующий reconcile с тем же desired → no SDK call (skip-by-cap).
    sdk.setAchievementProgress.mockClear();
    r.reconcile({
      progress: { ...emptyState().progress, completedNodes: ["c1n1", "c1n2", "c1n3"] },
    });
    await flush();
    expect(sdk.setAchievementProgress).not.toHaveBeenCalled();
  });

  it("one-shot unlock not called twice (pendingUnlocks dedup)", async () => {
    let resolveUnlock: (v: boolean) => void;
    const pendingPromise = new Promise<boolean>((resolve) => {
      resolveUnlock = resolve;
    });
    const sdk = createSdkMock({
      unlockAchievement: vi.fn(() => pendingPromise),
    });
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    const state = {
      progress: { ...emptyState().progress, completedNodes: ["c1n1"] },
    };
    r.reconcile(state);
    r.reconcile(state); // in-flight
    r.reconcile(state); // in-flight

    // completedNodes=["c1n1"] триггерит first_win и first_entry — два one-shot.
    // Каждый вызывается ровно один раз благодаря pendingUnlocks-дедупу.
    const firstWinCalls = sdk.unlockAchievement.mock.calls.filter((c) => c[0] === "first_win");
    const firstEntryCalls = sdk.unlockAchievement.mock.calls.filter((c) => c[0] === "first_entry");
    expect(firstWinCalls.length).toBe(1);
    expect(firstEntryCalls.length).toBe(1);

    resolveUnlock!(true);
    await flush();

    expect(persistUnlocked).toHaveBeenCalledWith("first_win");
    expect(persistUnlocked).toHaveBeenCalledWith("first_entry");

    // Уже cached — повторный reconcile НЕ вызывает SDK.
    sdk.unlockAchievement.mockClear();
    r.reconcile(state);
    await flush();
    expect(sdk.unlockAchievement).not.toHaveBeenCalled();
  });

  it("on SDK fail (ok=false) cache not updated, retry works on next reconcile", async () => {
    const sdk = createSdkMock({
      unlockAchievement: vi.fn(async () => false),
    });
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    const state = {
      progress: { ...emptyState().progress, completedNodes: ["c1n1"] },
    };
    r.reconcile(state);
    await flush();

    expect(persistUnlocked).not.toHaveBeenCalled();

    // Following reconcile retries — first_win должен быть позван второй раз.
    r.reconcile(state);
    await flush();
    const firstWinCalls = sdk.unlockAchievement.mock.calls.filter((c) => c[0] === "first_win");
    expect(firstWinCalls.length).toBe(2);
  });

  it("on SDK throw (.catch defense-in-depth — R3 fix M-MINOR1)", async () => {
    const sdk = createSdkMock({
      unlockAchievement: vi.fn(async () => {
        throw new Error("unexpected boom");
      }),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    const state = {
      progress: { ...emptyState().progress, completedNodes: ["c1n1"] },
    };
    r.reconcile(state);
    await flush();

    expect(warn).toHaveBeenCalled();
    // pendingUnlocks был очищен в .catch — следующий reconcile может ретраить.
    r.reconcile(state);
    await flush();
    const firstWinCalls = sdk.unlockAchievement.mock.calls.filter((c) => c[0] === "first_win");
    expect(firstWinCalls.length).toBe(2);
    warn.mockRestore();
  });
});

describe("AchievementsReconciler — R4 fix M1: pendingDesired drain", () => {
  it("drains to latest desired when desired grew during in-flight write", async () => {
    // Симулируем: первый setProgress(coins_2000, 1900) висит, во время этого
    // reconcile вызывается с coins=2050 → pendingDesired накапливает 2000.
    // После resolve writeProgress читает latest, drain'ит до 2000.
    let resolveFirst2000Call: (v: boolean) => void;
    const firstCall2000 = new Promise<boolean>((res) => {
      resolveFirst2000Call = res;
    });
    let coins2000CallCount = 0;
    const setProgressMock = vi.fn(async (tag: string, _progress: number) => {
      if (tag === "coins_2000") {
        coins2000CallCount += 1;
        if (coins2000CallCount === 1) return firstCall2000;
        return true;
      }
      // Прочие ачивки (coins_500, coins_1000, chapter_*, и т.д.) —
      // моментальный success, чтобы не путать счётчик coins_2000.
      return true;
    });

    const sdk = createSdkMock({ setAchievementProgress: setProgressMock });
    const persistProgress = vi.fn();
    const persistUnlocked = vi.fn();
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    // 1) coins=1900 → coins_2000 in-flight setProgress(1900) (cap'нулось).
    r.reconcile({
      progress: { ...emptyState().progress, coins: 1900 },
    });
    await flush();
    const coins2000Calls1 = setProgressMock.mock.calls.filter((c) => c[0] === "coins_2000");
    expect(coins2000Calls1.length).toBe(1);
    expect(coins2000Calls1[0]?.[1]).toBe(1900);

    // 2) Пока in-flight, coins вырастают до 2050 → pendingDesired.set("coins_2000", 2000).
    r.reconcile({
      progress: { ...emptyState().progress, coins: 2050 },
    });
    await flush();
    // ВТОРОЙ SDK call для coins_2000 ещё НЕ должен случиться — pendingDesired занят.
    const coins2000Calls2 = setProgressMock.mock.calls.filter((c) => c[0] === "coins_2000");
    expect(coins2000Calls2.length).toBe(1);

    // 3) Resolve первого → writeProgress читает latest=2000, drain'ит до 2000.
    resolveFirst2000Call!(true);
    await flush();

    // R4 fix M1: ДВА вызова setProgress(coins_2000), второй на 2000 (capped по max).
    // На R3-реализации (.finally + recursive reconcile(state)) этот тест падал бы.
    const coins2000Calls3 = setProgressMock.mock.calls.filter((c) => c[0] === "coins_2000");
    expect(coins2000Calls3.length).toBe(2);
    expect(coins2000Calls3[1]?.[1]).toBe(2000);
    expect(persistUnlocked).toHaveBeenCalledWith("coins_2000");
  });
});

describe("AchievementsReconciler — R4 fix M2: bootstrap sync seed before await", () => {
  it("persisted unlocked is in cache BEFORE fetchAchievements resolves", async () => {
    // fetchAchievements resolves через 50ms. В этом окне зовём reconcile —
    // должен видеть persisted first_share как unlocked → НЕ слать unlock.
    let resolveFetch: () => void;
    const fetchPromise = new Promise<void>((res) => {
      resolveFetch = res;
    });
    const sdk = createSdkMock({
      fetchAchievements: vi.fn(() => fetchPromise),
    });
    const persistProgress = vi.fn();
    const persistUnlocked = vi.fn();
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    const state: ReconcileState = {
      progress: {
        ...emptyState().progress,
        achievementUnlocked: { first_share: true },
        achievementFacts: { sharedEver: true },
      },
    };

    // Запускаем bootstrap — fetchAchievements висит, но persisted seed
    // ОБЯЗАН произойти СИНХРОННО (R4 fix M2).
    const bootstrapPromise = r.bootstrap(state);

    // В этом окне — reconcile с тем же state.
    r.reconcile(state);

    // R4 fix M2: unlock first_share НЕ должен быть вызван — persisted cache.
    expect(sdk.unlockAchievement).not.toHaveBeenCalledWith("first_share");

    resolveFetch!();
    await bootstrapPromise;
    await flush();

    // После bootstrap — тоже не вызывается, потому что cache содержит first_share.
    expect(sdk.unlockAchievement).not.toHaveBeenCalledWith("first_share");
  });
});

describe("AchievementsReconciler — R5 + R6 fix: SDK list merge", () => {
  it("persists SDK-sourced unlocked + progress locally (R5 fix M1)", async () => {
    const sdk = createSdkMock({
      getPlayerAchievements: vi.fn(() => [
        { tag: "first_share", progress: 0, unlocked: true },
        { tag: "coins_500", progress: 250, unlocked: false },
      ]),
    });
    const persistProgress = vi.fn();
    const persistUnlocked = vi.fn();
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    await r.bootstrap(emptyState());
    await flush();

    expect(persistUnlocked).toHaveBeenCalledWith("first_share");
    expect(persistProgress).toHaveBeenCalledWith("coins_500", 250);
  });

  it("treats SDK progress >= max as effectively unlocked (R6 fix M1 — durable suppressor)", async () => {
    const sdk = createSdkMock({
      getPlayerAchievements: vi.fn(() => [
        // Несогласованное GP-состояние: progress=500, unlocked=false при max=500.
        { tag: "coins_500", progress: 500, unlocked: false },
        // Over-max: progress > max → clamp + treat as unlocked.
        { tag: "coins_1000", progress: 9999, unlocked: false },
      ]),
    });
    const persistProgress = vi.fn();
    const persistUnlocked = vi.fn();
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    await r.bootstrap(emptyState());
    await flush();

    expect(persistUnlocked).toHaveBeenCalledWith("coins_500");
    expect(persistUnlocked).toHaveBeenCalledWith("coins_1000");

    // Durable suppressor regression: следующий reconcile с coins=500 НЕ
    // должен слать setProgress (unlockedCache содержит coins_500).
    sdk.setAchievementProgress.mockClear();
    r.reconcile({
      progress: { ...emptyState().progress, coins: 500 },
    });
    await flush();
    expect(sdk.setAchievementProgress).not.toHaveBeenCalledWith("coins_500", expect.anything());
  });

  it("ignores orphan SDK tags not in ACHIEVEMENTS list (R6 fix M1)", async () => {
    const sdk = createSdkMock({
      getPlayerAchievements: vi.fn(() => [
        { tag: "unknown_orphan_legacy_tag", progress: 100, unlocked: true },
      ]),
    });
    const persistProgress = vi.fn();
    const persistUnlocked = vi.fn();
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    await r.bootstrap(emptyState());
    await flush();

    expect(persistUnlocked).not.toHaveBeenCalled();
    expect(persistProgress).not.toHaveBeenCalled();
  });

  it("does not double-persist SDK unlocked tag already in persisted state", async () => {
    const sdk = createSdkMock({
      getPlayerAchievements: vi.fn(() => [
        { tag: "first_share", progress: 0, unlocked: true },
      ]),
    });
    const persistProgress = vi.fn();
    const persistUnlocked = vi.fn();
    const r = new AchievementsReconciler(sdk, persistProgress, persistUnlocked);

    await r.bootstrap({
      progress: {
        ...emptyState().progress,
        achievementUnlocked: { first_share: true },
      },
    });
    await flush();

    expect(persistUnlocked).not.toHaveBeenCalled();
  });
});
