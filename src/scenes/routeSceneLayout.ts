import { GAME_HEIGHT, GAME_WIDTH } from "@/app/config/gameConfig";

export const ROUTE_BOTTOM_NAV_HEIGHT = 78;
export const GAME_BOTTOM_NAV_HEIGHT = 62;
export const ROUTE_PAGE_TOP = 92;
export const ROUTE_SAFE_BOTTOM = GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT - 148;
const ROUTE_LEFT = 62;
const ROUTE_RIGHT = GAME_WIDTH - 62;

export type RoutePoint = {
  x: number;
  y: number;
};

export function buildRouteSheetPoints(count: number): RoutePoint[] {
  const centerX = Math.round((ROUTE_LEFT + ROUTE_RIGHT) / 2);
  const spanX = (ROUTE_RIGHT - ROUTE_LEFT) / 2;

  return Array.from({ length: count }, (_, idx) => {
    const t = count === 1 ? 0.5 : idx / Math.max(count - 1, 1);

    // River-like meander: alternating S-curves that swing left and right
    const meander = Math.sin(t * Math.PI * 3.4 + 0.6) * spanX * 0.72;
    const drift = Math.sin(t * Math.PI * 1.1 - 0.4) * spanX * 0.25;
    const rawX = centerX + meander + drift;

    const rawY = ROUTE_SAFE_BOTTOM - (ROUTE_SAFE_BOTTOM - ROUTE_PAGE_TOP) * t;
    const y = Math.max(ROUTE_PAGE_TOP, Math.min(ROUTE_SAFE_BOTTOM - 1, rawY));
    const x = Math.max(ROUTE_LEFT, Math.min(ROUTE_RIGHT, rawX));

    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  });
}

export function getDesktopPageControls(): {
  left: RoutePoint;
  right: RoutePoint;
} {
  const y = Math.round((ROUTE_PAGE_TOP + ROUTE_SAFE_BOTTOM) / 2);

  return {
    left: { x: 22, y },
    right: { x: GAME_WIDTH - 22, y },
  };
}
