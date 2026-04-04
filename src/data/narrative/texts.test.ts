import { describe, expect, it } from "vitest";
import { narrativeEntriesGlobal } from "@/data/narrative/entries.global";
import { narrativeEntriesRu } from "@/data/narrative/entries.ru";
import { getNarrativeEntry, getNarrativeEntryExcerpt } from "@/data/narrative/entries";
import { rewardTextsGlobal } from "@/data/narrative/rewardTexts.global";
import { rewardTextsRu } from "@/data/narrative/rewardTexts.ru";

describe("narrative text packs", () => {
  it("contains ru and global entry text for entry_01", () => {
    expect(narrativeEntriesRu.entry_01.body.length).toBeGreaterThan(0);
    expect(narrativeEntriesGlobal.entry_01.body.length).toBeGreaterThan(0);
  });

  it("contains ru and global reward text", () => {
    expect(rewardTextsRu.reward_diary_page_01.title.length).toBeGreaterThan(0);
    expect(rewardTextsGlobal.reward_finale_bundle_01.title.length).toBeGreaterThan(0);
  });

  it("returns narrative entries through helper", () => {
    expect(getNarrativeEntry("entry_01", "ru")?.body).toContain("Выход");
    expect(getNarrativeEntry("entry_01", "global")?.body).toContain("departure");
  });

  it("builds a short excerpt from a canonical entry", () => {
    const excerpt = getNarrativeEntryExcerpt("entry_01", "ru");

    expect(excerpt).toContain("Выход");
    expect(excerpt?.length).toBeLessThan(151);
  });
});
