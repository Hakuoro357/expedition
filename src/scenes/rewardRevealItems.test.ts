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
    expect(items[0]?.title).toBe("Между страницами");
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

  it("uses a short excerpt instead of the full canonical entry body", () => {
    const items = buildRewardRevealItems({
      dealId: "c1n1",
      rewardId: "reward_diary_page_01",
      artifactAwarded: null,
      locale: "ru",
    });

    expect(items[0]?.type).toBe("entry");
    expect(items[0]?.subtitle).toContain("Выход в шесть двенадцать");
    expect(items[0]?.subtitle?.length).toBeLessThan(151);
  });

  it("creates entry plus artifact for a reward with collectibleArtifactId when artifact is awarded", () => {
    const items = buildRewardRevealItems({
      dealId: "c1n3",
      rewardId: "reward_map_piece_01",
      artifactAwarded: "old-map",
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry", "artifact"]);
    expect(items[0]).toMatchObject({
      type: "entry",
      id: "entry_03",
      title: "Линия по хребту",
      badgeLabel: "Запись",
      subtitle: expect.any(String),
      mediaUrl: expect.any(String),
    });
    expect(items[1]).toMatchObject({
      type: "artifact",
      id: "old-map",
      title: "Первый фрагмент карты",
      badgeLabel: "Артефакт",
      subtitle: "Клочок маршрута, жёлтый и ломкий. С него путь начинает собираться заново.",
      mediaUrl: expect.any(String),
    });
  });

  it.each([
    "reward_map_variant_01",
    "reward_camp_marker_01",
    "reward_chapter_piece_01",
  ] as const)("does not create a map item for %s anymore", (rewardId) => {
    const items = buildRewardRevealItems({
      dealId: rewardId === "reward_map_variant_01" ? "c1n8" : rewardId === "reward_camp_marker_01" ? "c1n4" : "c1n10",
      rewardId,
      artifactAwarded: null,
      locale: "ru",
    });

    expect(items.map((item) => item.type)).toEqual(["entry"]);
  });

  it("returns only entry in global locale when no artifact was awarded", () => {
    const items = buildRewardRevealItems({
      dealId: "c1n3",
      rewardId: "reward_map_piece_01",
      artifactAwarded: null,
      locale: "global",
    });

    expect(items.map((item) => item.type)).toEqual(["entry"]);
    expect(items[0]).toMatchObject({
      type: "entry",
      id: "entry_03",
      title: "Line Along the Ridge",
      badgeLabel: "Entry",
      subtitle: expect.any(String),
    });
  });
});
