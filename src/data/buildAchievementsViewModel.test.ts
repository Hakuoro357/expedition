import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "@/data/achievements";
import {
  ACHIEVEMENT_GROUPS,
  ACHIEVEMENT_UI_META,
} from "@/data/achievementUiMeta";
import { buildAchievementsViewModel } from "@/data/buildAchievementsViewModel";
import type { ProgressState } from "@/core/game-state/types";

// Echo-translator — keeps tests language-independent.
const t = (k: string) => k;
const HIDDEN = "???";

function emptyProgress(): ProgressState {
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
  };
}

function vm(p: Partial<{
  progress: ProgressState;
  sdkUnlockedTags: Set<string>;
  sdkProgressByTag: Map<string, number>;
  persistedUnlocked: Record<string, true>;
  persistedProgress: Record<string, number>;
}> = {}) {
  return buildAchievementsViewModel({
    progress: p.progress ?? emptyProgress(),
    sdkUnlockedTags: p.sdkUnlockedTags ?? new Set(),
    sdkProgressByTag: p.sdkProgressByTag ?? new Map(),
    persistedUnlocked: p.persistedUnlocked ?? {},
    persistedProgress: p.persistedProgress ?? {},
    translate: t,
    hiddenTitlePlaceholder: HIDDEN,
  });
}

function findCard(model: ReturnType<typeof vm>, tag: string) {
  for (const group of model.groups) {
    const found = group.items.find((c) => c.tag === tag);
    if (found) return found;
  }
  throw new Error(`Card ${tag} not found in VM`);
}

describe("buildAchievementsViewModel — structure", () => {
  it("renders all 6 groups in declared order", () => {
    const model = vm();
    expect(model.groups.map((g) => g.tag)).toEqual(
      ACHIEVEMENT_GROUPS.map((g) => g.tag),
    );
  });

  it("each group has items sorted by `order`", () => {
    const model = vm();
    for (const group of model.groups) {
      const orders = ACHIEVEMENT_UI_META
        .filter((m) => m.groupTag === group.tag)
        .sort((a, b) => a.order - b.order)
        .map((m) => m.tag);
      expect(group.items.map((i) => i.tag)).toEqual(orders);
    }
  });

  it("renders all 20 cards across groups", () => {
    const model = vm();
    const total = model.groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(total).toBe(20);
  });
});

describe("buildAchievementsViewModel — parity (R3 codex-M5)", () => {
  it("ACHIEVEMENT_UI_META tags === ACHIEVEMENTS tags (1:1)", () => {
    const uiTags = ACHIEVEMENT_UI_META.map((m) => m.tag).sort();
    const computeTags = ACHIEVEMENTS.map((a) => a.tag).sort();
    expect(uiTags).toEqual(computeTags);
  });

  it("ACHIEVEMENT_UI_META tags are unique", () => {
    const tags = ACHIEVEMENT_UI_META.map((m) => m.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it("ACHIEVEMENT_UI_META groupTag values are all known", () => {
    const known = new Set(ACHIEVEMENT_GROUPS.map((g) => g.tag));
    for (const m of ACHIEVEMENT_UI_META) {
      expect(known.has(m.groupTag)).toBe(true);
    }
  });

  it("within a group, every `order` is unique and positive", () => {
    for (const group of ACHIEVEMENT_GROUPS) {
      const orders = ACHIEVEMENT_UI_META
        .filter((m) => m.groupTag === group.tag)
        .map((m) => m.order);
      expect(new Set(orders).size).toBe(orders.length);
      orders.forEach((o) => expect(o).toBeGreaterThan(0));
    }
  });
});

describe("buildAchievementsViewModel — hidden masking", () => {
  it("hidden + !unlocked → '???' title, empty description, locked-generic icon, no progress", () => {
    const model = vm();
    // epilogue is hidden
    const card = findCard(model, "epilogue");
    expect(card.visuallyLocked).toBe(true);
    expect(card.title).toBe(HIDDEN);
    expect(card.description).toBe("");
    expect(card.iconBasename).toBe("locked-generic.png");
    expect(card.unlocked).toBe(false);
    expect(card.displayProgress).toBeUndefined();
    expect(card.displayPct).toBeUndefined();
  });

  it("hidden + unlocked → full info revealed", () => {
    const model = vm({
      progress: { ...emptyProgress(), completedNodes: ["c3n10"] },
    });
    const card = findCard(model, "epilogue");
    expect(card.visuallyLocked).toBe(false);
    expect(card.title).toBe("ach_epilogue_title");
    expect(card.description).toBe("ach_epilogue_description");
    expect(card.iconBasename).toBe("epilogue.png");
    expect(card.unlocked).toBe(true);
  });
});

describe("buildAchievementsViewModel — unlock rules (R4 codex-M2 unified)", () => {
  it("compute() >= max → unlocked without SDK/persisted", () => {
    const model = vm({
      progress: { ...emptyProgress(), completedNodes: Array.from({ length: 10 }, (_, i) => `c1n${i + 1}`) },
    });
    const card = findCard(model, "chapter_1_complete");
    expect(card.unlocked).toBe(true);
    expect(card.displayProgress).toBe(10);
    expect(card.displayPct).toBe(100);
  });

  it("compute() < max + sdkUnlockedTags.has(tag) → unlocked, display clamps to max", () => {
    const model = vm({
      progress: { ...emptyProgress(), completedNodes: ["c1n1", "c1n2", "c1n3"] },
      sdkUnlockedTags: new Set(["chapter_1_complete"]),
    });
    const card = findCard(model, "chapter_1_complete");
    expect(card.unlocked).toBe(true);
    expect(card.displayProgress).toBe(10); // clamped to max
    expect(card.displayPct).toBe(100);
  });

  it("one-shot achievement: unlocked iff compute===true || sdk || persisted", () => {
    // first_win is one-shot (no max).
    // compute is `s.progress.completedNodes.length > 0`.
    // case: no progress → locked
    const m0 = vm();
    expect(findCard(m0, "first_win").unlocked).toBe(false);

    // case: compute fires → unlocked
    const m1 = vm({
      progress: { ...emptyProgress(), completedNodes: ["c1n1"] },
    });
    expect(findCard(m1, "first_win").unlocked).toBe(true);

    // case: compute false, but SDK says unlocked (cross-device) → unlocked
    const m2 = vm({ sdkUnlockedTags: new Set(["first_win"]) });
    expect(findCard(m2, "first_win").unlocked).toBe(true);

    // case: compute false, persisted unlocked → unlocked
    const m3 = vm({ persistedUnlocked: { first_win: true } });
    expect(findCard(m3, "first_win").unlocked).toBe(true);
  });

  it("one-shot has NO progressbar fields in VM (R3 codex-M4)", () => {
    const model = vm({
      progress: { ...emptyProgress(), completedNodes: ["c1n1"] },
    });
    const card = findCard(model, "first_win");
    expect(card.unlocked).toBe(true);
    expect(card.displayProgress).toBeUndefined();
    expect(card.displayPct).toBeUndefined();
    expect(card.max).toBeUndefined();
  });
});

describe("buildAchievementsViewModel — monotonic progress (R5 codex)", () => {
  it("coin regression: spent below peak → display shows peak from persisted", () => {
    // Player peaked at 1000 coins, spent down to 300.
    // compute(coins_2000) = 300 (current balance)
    // persistedProgress.coins_2000 = 1000 (recorded peak)
    // UI should show 1000/2000, NOT 300/2000.
    const model = vm({
      progress: { ...emptyProgress(), coins: 300 },
      persistedProgress: { coins_2000: 1000 },
    });
    const card = findCard(model, "coins_2000");
    expect(card.unlocked).toBe(false); // 1000 < 2000
    expect(card.displayProgress).toBe(1000);
    expect(card.displayPct).toBe(50);
  });

  it("SDK progress > compute > persisted → uses SDK", () => {
    const model = vm({
      progress: { ...emptyProgress(), coins: 300 },
      sdkProgressByTag: new Map([["coins_2000", 1500]]),
      persistedProgress: { coins_2000: 800 },
    });
    const card = findCard(model, "coins_2000");
    expect(card.displayProgress).toBe(1500);
  });

  it("effectiveProgress >= max → marked unlocked even without SDK confirmation", () => {
    const model = vm({
      progress: { ...emptyProgress(), coins: 0 },
      persistedProgress: { coins_500: 500 },
    });
    const card = findCard(model, "coins_500");
    expect(card.unlocked).toBe(true);
    expect(card.displayProgress).toBe(500);
  });

  it("non-finite persisted progress is sanitized to 0 (R6 codex)", () => {
    const model = vm({
      progress: { ...emptyProgress(), coins: 250 },
      // Simulated corruption: NaN slipped into save.
      persistedProgress: { coins_500: Number.NaN } as Record<string, number>,
    });
    const card = findCard(model, "coins_500");
    expect(card.displayProgress).toBe(250); // falls back to compute
    expect(Number.isFinite(card.displayPct)).toBe(true);
  });
});

describe("buildAchievementsViewModel — empty state", () => {
  it("new player (empty progress) → all 20 achievements locked", () => {
    const model = vm();
    const allLocked = model.groups
      .flatMap((g) => g.items)
      .every((c) => !c.unlocked);
    expect(allLocked).toBe(true);
  });

  it("new player: hidden cards anonymized; visible cards show real titles", () => {
    const model = vm();
    const epilogue = findCard(model, "epilogue"); // hidden
    expect(epilogue.visuallyLocked).toBe(true);
    expect(epilogue.title).toBe(HIDDEN);

    const firstWin = findCard(model, "first_win"); // visible
    expect(firstWin.visuallyLocked).toBe(false);
    expect(firstWin.title).toBe("ach_first_win_title");
  });
});
