import { describe, expect, it } from "vitest";
import { getRewardById, getRewardDisplayText } from "@/data/narrative/rewards";

describe("narrative rewards", () => {
  it("returns reward metadata by reward id", () => {
    expect(getRewardById("reward_diary_page_01")?.rewardType).toBe("diary_page");
    expect(getRewardById("reward_finale_bundle_01")?.rewardType).toBe("finale_reward");
    expect(getRewardById("reward_unknown_item_01")?.collectibleArtifactId).toBeTruthy();
  });

  it("returns localized reward display text", () => {
    expect(getRewardDisplayText("reward_diary_page_01", "ru")?.title).toBe("Первая страница дневника");
    expect(getRewardDisplayText("reward_diary_page_01", "global")?.title).toBe("First Diary Page");
  });
});
