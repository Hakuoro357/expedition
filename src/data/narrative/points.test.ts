import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/data/chapters";
import { getPointByDealId } from "@/data/narrative/points";

describe("narrative points", () => {
  it("maps legacy deal ids to canonical point ids", () => {
    expect(getPointByDealId("c1n1")?.pointId).toBe("pt_01");
    expect(getPointByDealId("c2n1")?.pointId).toBe("pt_11");
    expect(getPointByDealId("c3n10")?.rewardId).toBe("reward_finale_bundle_01");
  });

  it("exposes point ids through chapter nodes", () => {
    expect(CHAPTERS[0]?.nodes[0]?.pointId).toBe("pt_01");
    expect(CHAPTERS[1]?.nodes[0]?.entryId).toBe("entry_11");
  });
});
