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
      artifactItems: [],
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

  it("renders artifact list with image, title and description in artifacts tab", () => {
    const html = createArchiveOverlayHtml({
      title: "Архив",
      activeTab: "artifacts",
      entriesLabel: "Записи",
      artifactsLabel: "Артефакты",
      emptyEntriesLabel: "Пусто",
      emptyArtifactsLabel: "Артефакты пока не найдены.",
      entryItems: [],
      artifactItems: [
        {
          artifactId: "artifact_stamp",
          title: "Штамп экспедиции",
          description: "Канцелярский штамп дела «Перевал».",
          imageUrl: "/artifacts/stamp.png",
        },
      ],
      navItems: [
        { id: "home", label: "На главную", active: false },
        { id: "daily", label: "Маршрут дня", active: false },
        { id: "settings", label: "Настройки", active: false },
      ],
    });

    expect(html).toContain("archive-overlay__artifact-card");
    expect(html).toContain('data-archive-artifact="artifact_stamp"');
    expect(html).toContain("/artifacts/stamp.png");
    expect(html).toContain("Штамп экспедиции");
    expect(html).toContain("Канцелярский штамп");
    // На вкладке артефактов записи не должны рендериться.
    expect(html).not.toContain("data-archive-entry");
  });

  it("renders empty-artifacts state when artifactItems is empty", () => {
    const html = createArchiveOverlayHtml({
      title: "Архив",
      activeTab: "artifacts",
      entriesLabel: "Записи",
      artifactsLabel: "Артефакты",
      emptyEntriesLabel: "Пусто",
      emptyArtifactsLabel: "Артефакты пока не найдены.",
      entryItems: [],
      artifactItems: [],
      navItems: [
        { id: "home", label: "На главную", active: false },
        { id: "daily", label: "Маршрут дня", active: false },
        { id: "settings", label: "Настройки", active: false },
      ],
    });

    expect(html).toContain("archive-overlay__empty");
    expect(html).toContain("Артефакты пока не найдены.");
    expect(html).not.toContain("archive-overlay__artifact-card");
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
