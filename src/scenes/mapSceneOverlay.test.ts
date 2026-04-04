import { describe, expect, it } from "vitest";
import { createMapOverlayHtml } from "@/scenes/mapSceneOverlay";

describe("mapSceneOverlay", () => {
  it("renders the expected text fields", () => {
    const html = createMapOverlayHtml({
      title: "Solitaire: Expedition",
      expeditionName: 'Экспедиция "Перевал"',
      subtitle: "Спокойное путешествие",
      chapterLabel: "Глава 1: Начало маршрута",
      coins: 50,
      progressLabel: "0 / 10",
    });

    expect(html).toContain("map-overlay__title");
    expect(html).toContain("Solitaire: Expedition");
    expect(html).toContain("Экспедиция &quot;Перевал&quot;");
    expect(html).toContain("50");
    expect(html).toContain("0 / 10");
  });

  it("escapes raw html in text values", () => {
    const html = createMapOverlayHtml({
      title: "<b>unsafe</b>",
      expeditionName: "safe",
      subtitle: "safe",
      chapterLabel: "safe",
      coins: 1,
      progressLabel: "1 / 10",
    });

    expect(html).not.toContain("<b>unsafe</b>");
    expect(html).toContain("&lt;b&gt;unsafe&lt;/b&gt;");
  });
});
