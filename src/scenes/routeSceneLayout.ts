import { GAME_HEIGHT, GAME_WIDTH } from "@/app/config/gameConfig";

export const ROUTE_BOTTOM_NAV_HEIGHT = 78;
export const ROUTE_PAGE_TOP = 92;
export const ROUTE_SAFE_BOTTOM = GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT - 148;
const ROUTE_LEFT = 68;
const ROUTE_RIGHT = GAME_WIDTH - 68;
const ROUTE_WAVE_AMPLITUDE = 34;

export type RoutePoint = {
  x: number;
  y: number;
};

export function buildRouteSheetPoints(count: number): RoutePoint[] {
  const centerX = Math.round((ROUTE_LEFT + ROUTE_RIGHT) / 2);
  const spanX = (ROUTE_RIGHT - ROUTE_LEFT) / 2;

  return Array.from({ length: count }, (_, idx) => {
    const t = count === 1 ? 0.5 : idx / Math.max(count - 1, 1);
    const mainBend = Math.sin((1 - t) * Math.PI * 1.35 - 0.9) * spanX * 0.62;
    const secondaryBend = Math.sin((1 - t) * Math.PI * 3.2 + 0.35) * spanX * 0.16;
    const rawX = centerX + mainBend + secondaryBend;
    const wave = Math.sin(t * Math.PI * 1.75) * ROUTE_WAVE_AMPLITUDE;
    const rawY = ROUTE_SAFE_BOTTOM - (ROUTE_SAFE_BOTTOM - ROUTE_PAGE_TOP) * t + wave;
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
