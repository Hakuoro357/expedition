import { createAppNavHtml, type AppNavItem } from "@/ui/appNavHtml";

export type RouteNavItem = {
  id: AppNavItem["id"];
  label: string;
  active: boolean;
};

export type RouteOverlayPoint = {
  x: number;
  y: number;
  label: string;
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
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  const pointsHtml = points
    .map((point, index) => {
      if (point.state === "future") {
        return `
          <g class="route-overlay__route-point route-overlay__route-point--future" data-route-point="${index}">
            <circle class="route-overlay__route-point-future-ring" cx="${point.x}" cy="${point.y}" r="18" />
            <circle class="route-overlay__route-point-future-dot" cx="${point.x}" cy="${point.y}" r="4" />
          </g>`;
      }

      return `
        <g class="route-overlay__route-point route-overlay__route-point--${point.state}" data-route-point="${index}">
          ${point.state === "current" ? `<circle class="route-overlay__route-point-current-halo" cx="${point.x}" cy="${point.y}" r="31" />` : ""}
          <circle class="route-overlay__route-point-main" cx="${point.x}" cy="${point.y}" r="${point.state === "current" ? 24 : 19}" />
          <text class="route-overlay__route-point-label" x="${point.x}" y="${point.y}">${escapeHtml(point.label)}</text>
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
}: RouteSceneOverlayParams): string {
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
    ? '<button class="route-overlay__pager-btn" data-page-prev type="button">‹</button>'
    : '<span class="route-overlay__pager-btn route-overlay__pager-btn--hidden">‹</span>';
  const nextArrow = canGoNext
    ? '<button class="route-overlay__pager-btn" data-page-next type="button">›</button>'
    : '<span class="route-overlay__pager-btn route-overlay__pager-btn--hidden">›</span>';

  return [
    '<div class="route-overlay">',
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
