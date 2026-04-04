import { describe, expect, it } from "vitest";
import { createDiaryOverlayHtml } from "@/scenes/diarySceneOverlay";

describe("diarySceneOverlay", () => {
  it("renders latest entry and chapter rows", () => {
    const html = createDiaryOverlayHtml({
      title: "Дневник",
      coinsLabel: "🪙 50",
      statsLabel: "Глава 1 • 3/30",
      entriesLabel: "Записи: 3/30",
      latestTitle: "Ложный гребень",
      latestBody: "Текст записи",
      recentEntries: [{ chapterTitle: "Начало маршрута", pointLabel: "Ложный гребень" }],
      chapterProgress: [{ leftLabel: "Глава 1: Начало маршрута", rightLabel: "3/10", y: 660, complete: false }],
    });

    expect(html).toContain("Дневник");
    expect(html).toContain("Текст записи");
    expect(html).toContain("3/10");
  });
});
