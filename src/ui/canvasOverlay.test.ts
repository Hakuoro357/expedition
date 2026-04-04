import { describe, expect, it } from "vitest";
import { computeCanvasOverlayFrame } from "@/ui/canvasOverlay";

describe("canvasOverlay", () => {
  it("computes overlay frame relative to the canvas parent", () => {
    const frame = computeCanvasOverlayFrame(
      { left: 120, top: 40, width: 390, height: 844 },
      { left: 20, top: 10, width: 800, height: 900 },
      390
    );

    expect(frame).toEqual({
      left: 100,
      top: 30,
      width: 390,
      height: 844,
      scale: 1,
    });
  });

  it("scales from the logical width", () => {
    const frame = computeCanvasOverlayFrame(
      { left: 100, top: 20, width: 195, height: 422 },
      { left: 0, top: 0, width: 500, height: 600 },
      390
    );

    expect(frame.scale).toBe(0.5);
  });
});
