import { GAME_HEIGHT, GAME_WIDTH } from "@/app/config/gameConfig";

export const ROUTE_BOTTOM_NAV_HEIGHT = 78;
export const GAME_BOTTOM_NAV_HEIGHT = 62;
export const ROUTE_PAGE_TOP = 92;
export const ROUTE_SAFE_BOTTOM = GAME_HEIGHT - ROUTE_BOTTOM_NAV_HEIGHT - 220;
const ROUTE_LEFT = 62;
const ROUTE_RIGHT = GAME_WIDTH - 62;

export type RoutePoint = {
  x: number;
  y: number;
};

/**
 * Per-page curve parameters so each route sheet has a unique path shape.
 * [frequency, phase, amplitude, driftFreq, driftPhase, driftAmp]
 */
const PAGE_CURVES: Array<[number, number, number, number, number, number]> = [
  [3.4, 0.6, 0.72, 1.1, -0.4, 0.25],   // page 1 — wide S-meander
  [2.6, 1.8, 0.65, 1.6, 0.5, 0.30],     // page 2 — gentle drift right-start
  [4.0, 0.0, 0.58, 0.8, 2.2, 0.35],     // page 3 — tight zigzag
  [2.0, 2.4, 0.80, 1.4, -1.0, 0.18],    // page 4 — wide lazy curve
];

export function buildRouteSheetPoints(count: number, page = 1): RoutePoint[] {
  const centerX = Math.round((ROUTE_LEFT + ROUTE_RIGHT) / 2);
  const spanX = (ROUTE_RIGHT - ROUTE_LEFT) / 2;
  const curve = PAGE_CURVES[(page - 1) % PAGE_CURVES.length] ?? PAGE_CURVES[0];
  const [freq, phase, amp, driftFreq, driftPhase, driftAmp] = curve;

  return Array.from({ length: count }, (_, idx) => {
    const t = count === 1 ? 0.5 : idx / Math.max(count - 1, 1);

    const meander = Math.sin(t * Math.PI * freq + phase) * spanX * amp;
    const drift = Math.sin(t * Math.PI * driftFreq + driftPhase) * spanX * driftAmp;
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
