import { createAppNavHtml, type AppNavItem } from "@/ui/appNavHtml";

import { escapeHtml } from "@/ui/escapeHtml";

export type RouteNavItem = {
  id: AppNavItem["id"];
  label: string;
  active: boolean;
};

export type RouteOverlayPoint = {
  x: number;
  y: number;
  label: string;
  title?: string;
  state: "current" | "passed" | "future";
};

export type RouteOverlaySegment = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  visible: boolean;
};

type RouteSceneOverlayParams = {
  pageLabel: string;
  activePointTitle: string;
  activePointDescription: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  routePoints: RouteOverlayPoint[];
  routeSegments: RouteOverlaySegment[];
  navItems: RouteNavItem[];
  showDevTools?: boolean;
  /** GP docs: видимая кнопка управления звуком прямо на главной сцене. */
  muted?: boolean;
  muteAriaLabel?: string;
};

/** Viewport width used for label placement clamping */
const SVG_WIDTH = 390;

const EDGE_PADDING = 8;
const POINT_RADIUS = 19;
const CURRENT_RADIUS = 24;
const LABEL_GAP = 8;

type TitlePlacement = { side: "left" | "right"; maxWidth: number };

/**
 * Decide whether the title goes left or right of the point.
 *
 * Primary rule: pick the side with more available space so the text fits.
 * Tie-breaker (when both sides are roughly equal): place opposite to the
 * direction the route segments pull, so the label doesn't overlap the line.
 */
function computeTitlePlacement(
  pointIndex: number,
  points: RouteOverlayPoint[],
  segments: RouteOverlaySegment[],
): TitlePlacement {
  const point = points[pointIndex]!;
  const radius = point.state === "current" ? CURRENT_RADIUS : POINT_RADIUS;
  const labelStart = radius + LABEL_GAP;

  const spaceRight = SVG_WIDTH - point.x - labelStart - EDGE_PADDING;
  const spaceLeft = point.x - labelStart - EDGE_PADDING;

  // Segment pull direction — used as tie-breaker only
  let pullX = 0;
  const segBelow = segments[pointIndex - 1];
  if (segBelow) {
    const otherX = segBelow.fromX === point.x && segBelow.fromY === point.y
      ? segBelow.toX : segBelow.fromX;
    pullX += otherX - point.x;
  }
  const segAbove = segments[pointIndex];
  if (segAbove) {
    const otherX = segAbove.fromX === point.x && segAbove.fromY === point.y
      ? segAbove.toX : segAbove.fromX;
    pullX += otherX - point.x;
  }

  let side: "left" | "right";
  const spaceDiff = spaceRight - spaceLeft;

  if (Math.abs(spaceDiff) > 30) {
    // One side clearly has more room — use it
    side = spaceDiff > 0 ? "right" : "left";
  } else {
    // Roughly equal — place opposite to segment pull direction
    side = pullX > 0 ? "left" : "right";
    if (Math.abs(pullX) < 5) {
      side = point.x > SVG_WIDTH / 2 ? "left" : "right";
    }
  }

  const maxWidth = Math.max(40, side === "right" ? spaceRight : spaceLeft);
  return { side, maxWidth };
}

function buildRouteGraphicsHtml(points: RouteOverlayPoint[], segments: RouteOverlaySegment[]): string {
  const segmentsHtml = segments
    .map((segment) => {
      const midY = (segment.fromY + segment.toY) / 2;
      const d = `M${segment.fromX},${segment.fromY} C${segment.fromX},${midY} ${segment.toX},${midY} ${segment.toX},${segment.toY}`;
      return `
        <path
          class="route-overlay__route-segment${segment.visible ? " route-overlay__route-segment--visible" : ""}"
          d="${d}"
          fill="none"
        />`;
    })
    .join("");

  const TITLE_HEIGHT = 18;

  const pointsHtml = points
    .map((point, index) => {
      if (point.state === "future") {
        return `
          <g class="route-overlay__route-point route-overlay__route-point--future" data-route-point="${index}">
            <circle class="route-overlay__route-point-future-ring" cx="${point.x}" cy="${point.y}" r="18" />
            <circle class="route-overlay__route-point-future-dot" cx="${point.x}" cy="${point.y}" r="4" />
          </g>`;
      }

      const radius = point.state === "current" ? CURRENT_RADIUS : POINT_RADIUS;

      let titleHtml = "";
      if (point.title) {
        const { side, maxWidth } = computeTitlePlacement(index, points, segments);
        const foX = side === "right"
          ? point.x + radius + LABEL_GAP
          : point.x - radius - LABEL_GAP - maxWidth;
        const foY = point.y - TITLE_HEIGHT / 2;
        titleHtml = `<foreignObject x="${foX}" y="${foY}" width="${maxWidth}" height="${TITLE_HEIGHT}">
            <div xmlns="http://www.w3.org/1999/xhtml"
              class="route-overlay__route-point-title"
              style="text-align:${side === "right" ? "left" : "right"}"
            >${escapeHtml(point.title)}</div>
          </foreignObject>`;
      }

      return `
        <g class="route-overlay__route-point route-overlay__route-point--${point.state}" data-route-point="${index}">
          ${point.state === "current" ? `<circle class="route-overlay__route-point-current-halo" cx="${point.x}" cy="${point.y}" r="31" />` : ""}
          <circle class="route-overlay__route-point-main" cx="${point.x}" cy="${point.y}" r="${radius}" />
          <text class="route-overlay__route-point-label" x="${point.x}" y="${point.y}">${escapeHtml(point.label)}</text>
          ${titleHtml}
        </g>`;
    })
    .join("");

  return `
    <svg class="route-overlay__route-svg" viewBox="0 0 390 844" aria-hidden="true">
      ${segmentsHtml}
      ${pointsHtml}
    </svg>`;
}

export function createRouteSceneOverlayHtml({
  pageLabel,
  activePointTitle,
  activePointDescription,
  canGoPrev,
  canGoNext,
  routePoints,
  routeSegments,
  navItems,
  showDevTools,
  muted = false,
  muteAriaLabel = "Toggle sound",
}: RouteSceneOverlayParams): string {
  const soundIcon = muted
    ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
    : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  const muteBtnClass = muted
    ? "route-overlay__mute route-overlay__mute--muted"
    : "route-overlay__mute";
  const muteBtnHtml = `<button class="${muteBtnClass}" type="button" data-route-action="toggle-mute" aria-label="${escapeHtml(muteAriaLabel)}" aria-pressed="${muted ? "true" : "false"}">${soundIcon}</button>`;

  const activePointHtml =
    activePointTitle || activePointDescription
      ? [
          '  <div class="route-overlay__current-panel">',
          `    <div class="route-overlay__active-point-title">${escapeHtml(activePointTitle)}</div>`,
          `    <div class="route-overlay__active-point-description">${escapeHtml(activePointDescription)}</div>`,
          "  </div>",
        ].join("")
      : "";
  const prevArrow = canGoPrev
    ? '<button class="route-overlay__pager-btn" data-page-prev type="button">◂</button>'
    : '<span class="route-overlay__pager-btn route-overlay__pager-btn--hidden">◂</span>';
  const nextArrow = canGoNext
    ? '<button class="route-overlay__pager-btn" data-page-next type="button">▸</button>'
    : '<span class="route-overlay__pager-btn route-overlay__pager-btn--hidden">▸</span>';

  const devToolsHtml = showDevTools
    ? [
        '<div class="route-overlay__dev-tools">',
        '  <button class="route-overlay__dev-btn" data-dev-back type="button">◀ Back</button>',
        '  <button class="route-overlay__dev-btn" data-dev-skip type="button">Skip ▶</button>',
        "</div>",
      ].join("")
    : "";

  return [
    '<div class="route-overlay">',
    `  ${muteBtnHtml}`,
    devToolsHtml,
    `  ${buildRouteGraphicsHtml(routePoints, routeSegments)}`,
    activePointHtml,
    '  <div class="route-overlay__paginator">',
    `    ${prevArrow}`,
    `    <span class="route-overlay__paginator-label">${escapeHtml(pageLabel)}</span>`,
    `    ${nextArrow}`,
    "  </div>",
    createAppNavHtml(navItems),
    "</div>",
  ].join("");
}
