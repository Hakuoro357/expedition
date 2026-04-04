import { describe, expect, test } from "vitest";

import type { ProgressState } from "@/core/game-state/types";
import {
  ROUTE_SHEETS,
  getCurrentRoutePointState,
  getNextPlayableDealId,
  getRouteSheetByDealId,
  getRouteSheetByPage,
  getRouteSheetTitle,
  isRouteSheetUnlocked,
} from "@/data/routeSheets";

function createProgressState(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    currentChapter: 1,
    unlockedNodes: ["c1n1"],
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

describe("routeSheets", () => {
  test("groups 30 deals into four route sheets with 8/8/7/7 distribution", () => {
    expect(ROUTE_SHEETS.map((sheet) => sheet.dealIds.length)).toEqual([8, 8, 7, 7]);
    expect(ROUTE_SHEETS.flatMap((sheet) => sheet.dealIds)).toHaveLength(30);
    expect(new Set(ROUTE_SHEETS.flatMap((sheet) => sheet.dealIds)).size).toBe(30);
  });

  test("maps deal ids to the expected route sheet page", () => {
    expect(getRouteSheetByDealId("c1n1")?.page).toBe(1);
    expect(getRouteSheetByDealId("c1n8")?.page).toBe(1);
    expect(getRouteSheetByDealId("c1n9")?.page).toBe(2);
    expect(getRouteSheetByDealId("c2n6")?.page).toBe(2);
    expect(getRouteSheetByDealId("c2n7")?.page).toBe(3);
    expect(getRouteSheetByDealId("c3n10")?.page).toBe(4);
    expect(getRouteSheetByPage(4)?.dealIds.at(-1)).toBe("c3n10");
    expect(getRouteSheetTitle(1, "ru")).toBe("Начало пути");
    expect(getRouteSheetTitle(2, "ru")).toBe("Каменная гряда");
    expect(getRouteSheetTitle(3, "ru")).toBe("Разорванный маршрут");
    expect(getRouteSheetTitle(4, "ru")).toBe("Последняя стоянка");
  });

  test("unlocks route sheets strictly in sequence based on the next playable deal", () => {
    const initial = createProgressState();
    const afterFirstSheet = createProgressState({
      completedNodes: ROUTE_SHEETS[0]!.dealIds,
      unlockedNodes: ["c1n1", "c1n2", "c1n3", "c1n4", "c1n5", "c1n6", "c1n7", "c1n8", "c1n9"],
    });
    const afterSecondSheet = createProgressState({
      completedNodes: [...ROUTE_SHEETS[0]!.dealIds, ...ROUTE_SHEETS[1]!.dealIds],
      unlockedNodes: ROUTE_SHEETS.slice(0, 2).flatMap((sheet) => sheet.dealIds).concat("c2n7"),
    });

    expect(isRouteSheetUnlocked(1, initial)).toBe(true);
    expect(isRouteSheetUnlocked(2, initial)).toBe(false);

    expect(isRouteSheetUnlocked(2, afterFirstSheet)).toBe(true);
    expect(isRouteSheetUnlocked(3, afterFirstSheet)).toBe(false);

    expect(isRouteSheetUnlocked(3, afterSecondSheet)).toBe(true);
    expect(isRouteSheetUnlocked(4, afterSecondSheet)).toBe(false);
  });

  test("resolves the next playable deal from existing progress", () => {
    expect(getNextPlayableDealId(createProgressState())).toBe("c1n1");

    expect(
      getNextPlayableDealId(
        createProgressState({
          completedNodes: ["c1n1", "c1n2", "c1n3"],
          unlockedNodes: ["c1n1", "c1n2", "c1n3", "c1n4"],
        }),
      ),
    ).toBe("c1n4");

    expect(
      getNextPlayableDealId(
        createProgressState({
          completedNodes: ROUTE_SHEETS.flatMap((sheet) => sheet.dealIds),
          unlockedNodes: ROUTE_SHEETS.flatMap((sheet) => sheet.dealIds),
        }),
      ),
    ).toBeNull();
  });

  test("marks only one incomplete point as current and leaves later points as future", () => {
    const progress = createProgressState({
      completedNodes: ["c1n1", "c1n2"],
      unlockedNodes: ["c1n1", "c1n2", "c1n3"],
    });

    expect(getCurrentRoutePointState("c1n1", progress)).toBe("passed");
    expect(getCurrentRoutePointState("c1n2", progress)).toBe("passed");
    expect(getCurrentRoutePointState("c1n3", progress)).toBe("current");
    expect(getCurrentRoutePointState("c1n4", progress)).toBe("future");
    expect(getCurrentRoutePointState("c3n10", progress)).toBe("future");
  });
});
