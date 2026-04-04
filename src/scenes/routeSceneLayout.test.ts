import { describe, expect, it } from "vitest";

import {
  ROUTE_BOTTOM_NAV_HEIGHT,
  ROUTE_SAFE_BOTTOM,
  buildRouteSheetPoints,
  getDesktopPageControls,
} from "@/scenes/routeSceneLayout";

describe("routeSceneLayout", () => {
  it("builds bottom-to-top points inside the safe route area", () => {
    const points = buildRouteSheetPoints(8);
    const xDeltas = points.slice(1).map((point, index) => point.x - points[index]!.x);

    expect(points).toHaveLength(8);
    expect(points[0]!.y).toBeGreaterThan(points[7]!.y);
    expect(points.every((point) => Number.isInteger(point.x) && Number.isInteger(point.y))).toBe(true);
    expect(points.every((point) => point.y < ROUTE_SAFE_BOTTOM)).toBe(true);
    expect(xDeltas.some((delta) => delta > 0)).toBe(true);
    expect(xDeltas.some((delta) => delta < 0)).toBe(true);
  });

  it("returns desktop edge controls outside the route content area", () => {
    const controls = getDesktopPageControls();

    expect(controls.left.x).toBeLessThan(40);
    expect(controls.right.x).toBeGreaterThan(350);
    expect(controls.left.y).toBeLessThan(844 - ROUTE_BOTTOM_NAV_HEIGHT);
    expect(controls.right.y).toBeLessThan(844 - ROUTE_BOTTOM_NAV_HEIGHT);
  });
});
