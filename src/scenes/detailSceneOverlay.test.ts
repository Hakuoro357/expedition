import { describe, expect, it } from "vitest";

import { createDetailSceneOverlayHtml } from "@/scenes/detailSceneOverlay";

describe("detailSceneOverlay", () => {
  it("renders entry detail with portrait, tabs, home button, and nav", () => {
    const html = createDetailSceneOverlayHtml({
      homeLabel: "Домой",
      navItems: [
        { id: "archive", label: "Архив", active: false },
        { id: "daily", label: "Маршрут дня", active: false },
        { id: "settings", label: "Настройки", active: false },
      ],
      activeTab: "entry",
      entryTabLabel: "Запись",
      artifactTabLabel: "Артефакт",
      entry: {
        pointLabel: "Выход в шесть двенадцать",
        author: "Алексей Воронов",
        initials: "АВ",
        accent: "#7c9f8f",
        portraitUrl: "/portraits/voronov.png",
        body: "Текст записи",
      },
      artifact: {
        title: "Штамп экспедиции",
        description: "Канцелярский штамп дела «Перевал».",
        imageUrl: "/artifacts/stamp.png",
      },
    });

    expect(html).toContain("detail-page__home");
    expect(html).toContain("Выход в шесть двенадцать");
    expect(html).toContain("Алексей Воронов");
    expect(html).toContain("/portraits/voronov.png");
    expect(html).toContain("detail-page__tabs");
    expect(html).toContain('data-detail-tab="artifact"');
    expect(html).toContain('data-app-nav="archive"');
  });

  it("renders artifact detail content when artifact tab is active", () => {
    const html = createDetailSceneOverlayHtml({
      homeLabel: "Домой",
      navItems: [
        { id: "archive", label: "Архив", active: false },
        { id: "daily", label: "Маршрут дня", active: false },
        { id: "settings", label: "Настройки", active: false },
      ],
      activeTab: "artifact",
      entryTabLabel: "Запись",
      artifactTabLabel: "Артефакт",
      entry: {
        pointLabel: "Выход в шесть двенадцать",
        author: "Алексей Воронов",
        initials: "АВ",
        accent: "#7c9f8f",
        portraitUrl: "/portraits/voronov.png",
        body: "Текст записи",
      },
      artifact: {
        title: "Штамп экспедиции",
        description: "Канцелярский штамп дела «Перевал».",
        imageUrl: "/artifacts/stamp.png",
      },
    });

    expect(html).toContain("detail-page__artifact-image");
    expect(html).toContain("/artifacts/stamp.png");
    expect(html).toContain("Штамп экспедиции");
    expect(html).toContain("Канцелярский штамп дела");
    expect(html).not.toContain("detail-page__entry-author\">Алексей Воронов");
  });
});
