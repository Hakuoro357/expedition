import { describe, expect, it } from "vitest";
import { getGameResolution, getScaledGameSize, getTextResolution } from "@/app/rendering";

describe("rendering helpers", () => {
  it("caps game resolution for HiDPI rendering", () => {
    expect(getGameResolution(0.8)).toBe(1);
    expect(getGameResolution(1)).toBe(1);
    expect(getGameResolution(1.75)).toBe(1.75);
    expect(getGameResolution(2)).toBe(2);
    expect(getGameResolution(4)).toBe(2);
  });

  it("caps text resolution to keep canvas text crisp without excessive buffers", () => {
    expect(getTextResolution(0.8)).toBe(1);
    expect(getTextResolution(1)).toBe(1);
    expect(getTextResolution(2)).toBe(2);
    expect(getTextResolution(4)).toBe(3);
  });

  it("derives scaled bitmap size for the game canvas", () => {
    expect(getScaledGameSize(1)).toEqual({ scale: 1, width: 430, height: 844 });
    expect(getScaledGameSize(1.75)).toEqual({ scale: 1.75, width: 753, height: 1477 });
  });
});
