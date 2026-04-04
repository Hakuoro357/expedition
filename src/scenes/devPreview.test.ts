import { describe, expect, it } from "vitest";
import { getDevScenePreview, getRewardPreviewLinks } from "@/scenes/devPreview";

describe("getDevScenePreview", () => {
  it("returns reward preview config in dev for valid params", () => {
    expect(
      getDevScenePreview("?preview=reward&dealId=c1n3&mode=adventure", true)
    ).toEqual({
      scene: "reward",
      dealId: "c1n3",
      mode: "adventure",
      preview: true,
    });
  });

  it("falls back to quick mode when dealId is missing", () => {
    expect(
      getDevScenePreview("?preview=reward&mode=adventure", true)
    ).toEqual({
      scene: "reward",
      dealId: undefined,
      mode: "quick-play",
      preview: true,
    });
  });

  it("does nothing outside dev mode", () => {
    expect(
      getDevScenePreview("?preview=reward&dealId=c1n3&mode=adventure", false)
    ).toBeNull();
  });

  it("returns reward list preview config in dev", () => {
    expect(
      getDevScenePreview("?preview=reward-list", true)
    ).toEqual({
      scene: "reward-list",
      preview: true,
    });
  });

  it("returns the expected reward preview links", () => {
    expect(getRewardPreviewLinks("http://127.0.0.1:4175")).toEqual([
      {
        dealId: "c1n3",
        label: "c1n3 — запись + карта",
        url: "http://127.0.0.1:4175/?preview=reward&dealId=c1n3&mode=adventure",
      },
      {
        dealId: "c2n6",
        label: "c2n6 — запись + артефакт",
        url: "http://127.0.0.1:4175/?preview=reward&dealId=c2n6&mode=adventure",
      },
      {
        dealId: "c3n1",
        label: "c3n1 — запись + карта",
        url: "http://127.0.0.1:4175/?preview=reward&dealId=c3n1&mode=adventure",
      },
    ]);
  });
});
