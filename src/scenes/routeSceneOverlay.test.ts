import { describe, expect, it } from "vitest";

import { createRouteSceneOverlayHtml } from "@/scenes/routeSceneOverlay";

describe("routeSceneOverlay", () => {
  it("renders bottom navigation, page label, and active point caption", () => {
    const html = createRouteSceneOverlayHtml({
      pageLabel: "Лист 1 / 4",
      activePointTitle: "Точка 3",
      activePointDescription: "Отсюда маршрут впервые начинает собираться заново.",
      canGoPrev: false,
      canGoNext: true,
      routePoints: [
        { x: 80, y: 700, label: "1", state: "passed" },
        { x: 120, y: 620, label: "2", state: "current" },
        { x: 160, y: 520, label: "3", state: "future" },
      ],
      routeSegments: [
        { fromX: 80, fromY: 700, toX: 120, toY: 620, visible: true },
        { fromX: 120, fromY: 620, toX: 160, toY: 520, visible: false },
      ],
      navItems: [
        { id: "archive", label: "Архив", active: false },
        { id: "daily", label: "Маршрут дня", active: false },
        { id: "settings", label: "Настройки", active: false },
      ],
    });

    expect(html).toContain("route-overlay__paginator");
    expect(html).toContain("route-overlay__paginator-label");
    expect(html).toContain("Лист 1 / 4");
    expect(html).toContain("route-overlay__active-point-title");
    expect(html).toContain("Точка 3");
    expect(html).toContain("Маршрут дня");
    expect(html).toContain("app-nav");
    expect(html).toContain("data-page-next");
    expect(html).toContain("route-overlay__pager-btn");
    expect(html).not.toContain("data-page-prev");
    expect(html).toContain("route-overlay__pager-btn--hidden");
    expect(html).toContain("route-overlay__current-panel");
    expect(html).toContain("route-overlay__route-svg");
    expect(html).toContain("route-overlay__route-point--current");
  });

  it("escapes raw html in overlay text", () => {
    const html = createRouteSceneOverlayHtml({
      pageLabel: "<b>unsafe</b>",
      activePointTitle: "safe",
      activePointDescription: "safe",
      canGoPrev: false,
      canGoNext: false,
      routePoints: [{ x: 80, y: 700, label: "<unsafe>", state: "passed" }],
      routeSegments: [],
      navItems: [{ id: "archive", label: "Архив", active: true }],
    });

    expect(html).not.toContain("<b>unsafe</b>");
    expect(html).toContain("&lt;b&gt;unsafe&lt;/b&gt;");
    expect(html).toContain("&lt;unsafe&gt;");
  });
});
