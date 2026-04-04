import { describe, expect, it } from "vitest";
import { buildRoutePoints, MAP_SCENE_SPACING, MAP_SCENE_TYPOGRAPHY } from "@/scenes/mapSceneLayout";

describe("mapSceneLayout", () => {
  it("keeps serif only for major headings", () => {
    expect(MAP_SCENE_TYPOGRAPHY.title.fontFamily).toContain("Georgia");
    expect(MAP_SCENE_TYPOGRAPHY.chapter.fontFamily).toContain("Georgia");
    expect(MAP_SCENE_TYPOGRAPHY.expedition.fontFamily).not.toContain("Georgia");
    expect(MAP_SCENE_TYPOGRAPHY.subtitle.fontFamily).not.toContain("Georgia");
    expect(MAP_SCENE_TYPOGRAPHY.progress.fontFamily).not.toContain("Georgia");
    expect(MAP_SCENE_TYPOGRAPHY.node.fontFamily).not.toContain("Georgia");
  });

  it("returns rounded route points within the requested bounds", () => {
    const points = buildRoutePoints(5, {
      left: 56,
      right: 334,
      top: MAP_SCENE_SPACING.mapTop,
      bottom: MAP_SCENE_SPACING.mapBottom,
      waveAmplitude: 44,
    });

    expect(points).toHaveLength(5);
    expect(points.every((point) => Number.isInteger(point.x) && Number.isInteger(point.y))).toBe(true);
    expect(points.every((point) => point.x >= 56 && point.x <= 334)).toBe(true);
    expect(points.every((point) => point.y >= MAP_SCENE_SPACING.mapTop - 44 && point.y <= MAP_SCENE_SPACING.mapBottom + 44)).toBe(true);
  });
});
