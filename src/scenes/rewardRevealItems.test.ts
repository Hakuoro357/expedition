import { describe, expect, it } from "vitest";
import { buildRewardRevealItems } from "@/scenes/rewardRevealItems";

describe("buildRewardRevealItems", () => {
  it("returns an entry item before an artifact item when a point has both", () => {
    const items = buildRewardRevealItems({
      dealId: "c2n6",
      rewardId: "reward_anonymous_note_01",
      artifactAwarded: "field-journal",
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry", "artifact"]);
    expect(items[0]?.id).toBe("entry_16");
    expect(items[0]?.title).toContain("16");
    expect(items[1]?.id).toBe("field-journal");
    expect(items[1]?.title).toBe("Записка без подписи");
  });

  it("does not create an artifact item when artifactAwarded is null", () => {
    const items = buildRewardRevealItems({
      dealId: "c1n1",
      rewardId: "reward_diary_page_01",
      artifactAwarded: null,
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry"]);
  });

  it("does not create an artifact item for a stale award id", () => {
    const items = buildRewardRevealItems({
      dealId: "c2n6",
      rewardId: "reward_anonymous_note_01",
      artifactAwarded: "old-map",
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry"]);
    expect(items[0]?.id).toBe("entry_16");
  });

  it("does not create a map item when rewardId does not match the deal", () => {
    const items = buildRewardRevealItems({
      dealId: "c1n3",
      rewardId: "reward_camp_marker_01",
      artifactAwarded: null,
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry"]);
    expect(items[0]?.id).toBe("entry_03");
  });

  it("does not let a foreign rewardId hide the correct artifact reveal", () => {
    const items = buildRewardRevealItems({
      dealId: "c2n6",
      rewardId: "reward_map_piece_01",
      artifactAwarded: "field-journal",
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry", "artifact"]);
    expect(items[1]).toMatchObject({
      type: "artifact",
      id: "field-journal",
      title: "Записка без подписи",
      badgeLabel: "Артефакт",
      subtitle: "Ни имени, ни даты. Кто-то проговорил вслух то, о чём экспедиция молчала.",
    });
  });

  it("creates entry plus map, not artifact, for a map reward with collectibleArtifactId", () => {
    const items = buildRewardRevealItems({
      dealId: "c1n3",
      rewardId: "reward_map_piece_01",
      artifactAwarded: "old-map",
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry", "map"]);
    expect(items[0]).toMatchObject({
      type: "entry",
      id: "entry_03",
      title: "Точка 03",
      badgeLabel: "Запись",
      subtitle: expect.any(String),
    });
    expect(items[1]).toMatchObject({
      type: "map",
      id: "reward_map_piece_01",
      title: "Первый фрагмент карты",
      badgeLabel: "Карта",
      subtitle: "Маршрут начинает складываться визуально.",
    });
  });

  it.each([
    {
      dealId: "c1n8",
      rewardId: "reward_map_variant_01",
      title: "Схема с расхождениями",
      subtitle: "Первый явный след двойного маршрута.",
    },
    {
      dealId: "c1n4",
      rewardId: "reward_camp_marker_01",
      title: "Отметка стоянки",
      subtitle: "Ещё одна точка реального пути.",
    },
    {
      dealId: "c1n10",
      rewardId: "reward_chapter_piece_01",
      title: "Ключевой фрагмент главы",
      subtitle: "Скрытый слой первого участка начинает раскрываться.",
    },
  ] as const)("creates a map item for $rewardId", ({ dealId, rewardId, title, subtitle }) => {
    const items = buildRewardRevealItems({
      dealId,
      rewardId,
      artifactAwarded: null,
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry", "map"]);
    expect(items[1]).toMatchObject({
      type: "map",
      id: rewardId,
      title,
      badgeLabel: "Карта",
      subtitle,
    });
  });

  it("returns a localized map item in global locale", () => {
    const items = buildRewardRevealItems({
      dealId: "c1n3",
      rewardId: "reward_map_piece_01",
      artifactAwarded: null,
      locale: "global",
    });

    expect(items.map((item) => item.type)).toEqual(["entry", "map"]);
    expect(items[0]).toMatchObject({
      type: "entry",
      id: "entry_03",
      title: "Point 03",
      badgeLabel: "Entry",
      subtitle: expect.any(String),
    });
    expect(items[1]).toMatchObject({
      type: "map",
      id: "reward_map_piece_01",
      title: "First Map Fragment",
      badgeLabel: "Map",
      subtitle: "The route begins to take shape.",
    });
  });
});
