import { describe, expect, it } from "vitest";

import { createArchiveEntryDetailHtml } from "@/scenes/archiveEntryDetailOverlay";
import { createArchiveOverlayHtml } from "@/scenes/archiveSceneOverlay";

describe("archiveSceneOverlay", () => {
  it("renders entry list, tabs, and portrait image", () => {
    const html = createArchiveOverlayHtml({
      title: "Архив",
      activeTab: "entries",
      entriesLabel: "Записи",
      artifactsLabel: "Артефакты",
      emptyEntriesLabel: "Записи пока не открыты.",
      emptyArtifactsLabel: "Артефакты пока не найдены.",
      entryItems: [
        {
          entryId: "entry_01",
          pointId: "point_01",
          pointLabel: "Выход в шесть двенадцать",
          author: "Алексей Воронов",
          initials: "АВ",
          accent: "#7c9f8f",
          portraitUrl: "/portraits/voronov.png",
          excerpt: "Короткий фрагмент записи.",
        },
      ],
      artifactCount: 1,
      navItems: [
        { id: "home", label: "На главную", active: false },
        { id: "daily", label: "Маршрут дня", active: false },
        { id: "settings", label: "Настройки", active: false },
      ],
    });

    expect(html).toContain("archive-overlay__title");
    expect(html).toContain("archive-overlay__entry-card");
    expect(html).toContain("archive-overlay__entry-portrait-image");
    expect(html).toContain("/portraits/voronov.png");
    expect(html).toContain("Выход в шесть двенадцать");
    expect(html).toContain("Алексей Воронов");
    expect(html).toContain('data-app-nav="home"');
  });

  it("renders entry detail portrait image", () => {
    const html = createArchiveEntryDetailHtml({
      pointLabel: "Выход в шесть двенадцать",
      author: "Алексей Воронов",
      initials: "АВ",
      accent: "#7c9f8f",
      portraitUrl: "/portraits/voronov.png",
      body: "Текст записи",
    });

    expect(html).toContain("archive-entry-detail-overlay__portrait-image");
    expect(html).toContain("/portraits/voronov.png");
    expect(html).toContain("Алексей Воронов");
  });
});
