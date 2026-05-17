import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, countEntriesByEntity } from "@/data/achievements";
import { CHAPTERS } from "@/data/chapters";

const ALL_NODES = CHAPTERS.flatMap((c) => c.nodes.map((n) => n.id));

const find = (tag: string) => {
  const meta = ACHIEVEMENTS.find((a) => a.tag === tag);
  if (!meta) throw new Error(`unknown tag ${tag}`);
  return meta;
};

describe("achievements metadata", () => {
  it("contains all 21 expected tags", () => {
    const tags = ACHIEVEMENTS.map((a) => a.tag).sort();
    expect(tags).toEqual(
      [
        "all_artifacts",
        "chapter_1_complete",
        "chapter_2_complete",
        "chapter_3_complete",
        "coins_1000",
        "coins_2000",
        "coins_500",
        "entries_klimova",
        "entries_levin",
        "entries_mirskaya",
        "entries_rudenko",
        "entries_voronov",
        "epilogue",
        "first_artifact",
        "first_community_join",
        "first_entry",
        "first_share",
        "first_win",
        "no_hint_win",
        "no_undo_win",
        "patron",
      ].sort(),
    );
  });

  it("character entry max values match actual achievable counts (R2 fix M1)", () => {
    // Counts verified by grep entries.ru.ts:
    //   leader=13, archaeologist=6, cartographer=4, photographer_archivist=4, quartermaster_guide=3
    //   sum = 30 (= total entries)
    expect(countEntriesByEntity(ALL_NODES, "leader")).toBe(13);
    expect(countEntriesByEntity(ALL_NODES, "archaeologist")).toBe(6);
    expect(countEntriesByEntity(ALL_NODES, "cartographer")).toBe(4);
    expect(countEntriesByEntity(ALL_NODES, "photographer_archivist")).toBe(4);
    expect(countEntriesByEntity(ALL_NODES, "quartermaster_guide")).toBe(3);

    // Каждая character-entry ачивка должна иметь max === actual count.
    // Если max < count — игрок зацепит лишний прогресс впустую. Если
    // max > count — ачивка станет недостижимой.
    expect(find("entries_voronov").max).toBe(13);
    expect(find("entries_levin").max).toBe(6);
    expect(find("entries_mirskaya").max).toBe(4);
    expect(find("entries_klimova").max).toBe(4);
    expect(find("entries_rudenko").max).toBe(3);
  });

  it("sums of character entry counts cover all 30 entries", () => {
    const total =
      countEntriesByEntity(ALL_NODES, "leader") +
      countEntriesByEntity(ALL_NODES, "archaeologist") +
      countEntriesByEntity(ALL_NODES, "cartographer") +
      countEntriesByEntity(ALL_NODES, "photographer_archivist") +
      countEntriesByEntity(ALL_NODES, "quartermaster_guide");
    expect(total).toBe(30);
    expect(total).toBe(ALL_NODES.length);
  });

  it("chapter complete max values match 10 nodes per chapter", () => {
    expect(find("chapter_1_complete").max).toBe(10);
    expect(find("chapter_2_complete").max).toBe(10);
    expect(find("chapter_3_complete").max).toBe(10);
  });

  it("all_artifacts max matches total artifact drops in chapters", () => {
    const artifactDrops = CHAPTERS.flatMap((c) => c.nodes)
      .filter((n) => Boolean(n.artifactId)).length;
    expect(find("all_artifacts").max).toBe(artifactDrops);
  });

  it("hidden flag is set on epilogue / all_artifacts / mastery", () => {
    expect(find("epilogue").hidden).toBe(true);
    expect(find("all_artifacts").hidden).toBe(true);
    expect(find("no_undo_win").hidden).toBe(true);
    expect(find("no_hint_win").hidden).toBe(true);
    // Прочие ачивки видимы по умолчанию.
    expect(find("first_win").hidden).toBeUndefined();
  });
});

describe("compute functions", () => {
  const emptyProgress = {
    currentChapter: 1,
    unlockedNodes: [],
    completedNodes: [],
    coins: 0,
    artifacts: [],
    dailyClaimedOn: null,
    locale: "ru" as const,
    streakCount: 0,
    lastLoginDate: null,
  };

  it("first_win triggers after first completed node", () => {
    expect(find("first_win").compute({ progress: emptyProgress })).toBeFalsy();
    expect(
      find("first_win").compute({
        progress: { ...emptyProgress, completedNodes: ["c1n1"] },
      }),
    ).toBeTruthy();
  });

  it("chapter_N_complete counts only nodes in that chapter", () => {
    const progress = {
      ...emptyProgress,
      completedNodes: ["c1n1", "c1n2", "c2n1", "c3n5"],
    };
    expect(find("chapter_1_complete").compute({ progress })).toBe(2);
    expect(find("chapter_2_complete").compute({ progress })).toBe(1);
    expect(find("chapter_3_complete").compute({ progress })).toBe(1);
  });

  it("coins_* read balance directly (monotonic via reconciler cap+skip)", () => {
    const progress = { ...emptyProgress, coins: 750 };
    expect(find("coins_500").compute({ progress })).toBe(750);
    expect(find("coins_1000").compute({ progress })).toBe(750);
  });

  it("no_undo_win triggers from lastWin or durable fact", () => {
    const lastWin = { mode: "adventure", dealId: "c1n1", undoCount: 0, hintCount: 5 };
    expect(
      find("no_undo_win").compute({ progress: emptyProgress, lastWin }),
    ).toBeTruthy();

    // Durable fact survives без lastWin (после SDK retry).
    expect(
      find("no_undo_win").compute({
        progress: { ...emptyProgress, achievementFacts: { noUndoWinEver: true } },
      }),
    ).toBeTruthy();
  });

  it("no_hint_win mirrors mastery semantics for hints", () => {
    const lastWin = { mode: "adventure", dealId: "c1n1", undoCount: 3, hintCount: 0 };
    expect(
      find("no_hint_win").compute({ progress: emptyProgress, lastWin }),
    ).toBeTruthy();
    const lastWinWithHints = { ...lastWin, hintCount: 1 };
    expect(
      find("no_hint_win").compute({ progress: emptyProgress, lastWin: lastWinWithHints }),
    ).toBeFalsy();
  });

  it("first_share / first_community_join read achievementFacts", () => {
    expect(find("first_share").compute({ progress: emptyProgress })).toBeFalsy();
    expect(
      find("first_share").compute({
        progress: { ...emptyProgress, achievementFacts: { sharedEver: true } },
      }),
    ).toBeTruthy();
  });

  it("patron returns true when patronSupport === true, false otherwise", () => {
    expect(find("patron").compute({ progress: emptyProgress })).toBeFalsy();
    expect(
      find("patron").compute({
        progress: { ...emptyProgress, patronSupport: true },
      }),
    ).toBeTruthy();
    expect(
      find("patron").compute({
        progress: { ...emptyProgress, patronSupport: false },
      }),
    ).toBeFalsy();
  });

  it("epilogue requires c3n10 specifically", () => {
    expect(
      find("epilogue").compute({
        progress: { ...emptyProgress, completedNodes: ["c3n9"] },
      }),
    ).toBeFalsy();
    expect(
      find("epilogue").compute({
        progress: { ...emptyProgress, completedNodes: ["c3n10"] },
      }),
    ).toBeTruthy();
  });
});
