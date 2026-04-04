import { describe, expect, it } from "vitest";
import { getRewardMapPreviewData } from "@/scenes/rewardMapPreview";

describe("getRewardMapPreviewData", () => {
  it("returns a chapter preview with current point highlighted", () => {
    const preview = getRewardMapPreviewData("c1n3");

    expect(preview).not.toBeNull();
    expect(preview?.chapterId).toBe(1);
    expect(preview?.currentIndex).toBe(2);
    expect(preview?.points).toHaveLength(10);
    expect(preview?.points[2]).toMatchObject({ state: "current" });
    expect(preview?.points[0]).toMatchObject({ state: "completed" });
    expect(preview?.points[9]).toMatchObject({ state: "upcoming" });
  });

  it("returns null for unknown deals", () => {
    expect(getRewardMapPreviewData("missing-deal")).toBeNull();
  });
});
