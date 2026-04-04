import { describe, expect, it } from "vitest";

import { createRoutePointModalHtml } from "@/scenes/routePointModalOverlay";

describe("routePointModalOverlay", () => {
  it("renders entry-only modal with portrait and without tabs", () => {
    const html = createRoutePointModalHtml({
      pointLabel: "Выход в шесть двенадцать",
      closeLabel: "Закрыть",
      activeTab: "entry",
      entry: {
        author: "Воронов",
        portraitUrl: "/portraits/voronov.png",
        body: "Выход в шесть двенадцать, при ровной облачности без просветов и без ветра.",
      },
    });

    expect(html).toContain("route-point-modal__point");
    expect(html).toContain("Выход в шесть двенадцать");
    expect(html).toContain("Воронов");
    expect(html).toContain("route-point-modal__entry-portrait-image");
    expect(html).toContain("/portraits/voronov.png");
    expect(html).not.toContain("route-point-modal__tabs");
  });

  it("renders tabs when both entry and artifact are available", () => {
    const html = createRoutePointModalHtml({
      pointLabel: "Знак на повторе",
      closeLabel: "Закрыть",
      activeTab: "entry",
      entry: {
        author: "Левин",
        portraitUrl: "/portraits/levin.png",
        body: "Текст записи.",
      },
      artifact: {
        title: "Штамп экспедиции",
        description: "Канцелярский штамп дела «Перевал».",
        imageKey: "artifact_stamp_large",
      },
    });

    expect(html).toContain("route-point-modal__tabs");
    expect(html).toContain("Запись");
    expect(html).toContain("Артефакт");
    expect(html).toContain("route-point-modal__tab route-point-modal__tab--active");
  });

  it("renders artifact panel when artifact tab is active", () => {
    const html = createRoutePointModalHtml({
      pointLabel: "Знак на повторе",
      closeLabel: "Закрыть",
      activeTab: "artifact",
      entry: {
        author: "Левин",
        portraitUrl: "/portraits/levin.png",
        body: "Текст записи.",
      },
      artifact: {
        title: "Штамп экспедиции",
        description: "Канцелярский штамп дела «Перевал».",
        imageKey: "artifact_stamp_large",
      },
    });

    expect(html).toContain("route-point-modal__artifact-title");
    expect(html).toContain("Штамп экспедиции");
    expect(html).toContain("artifact_stamp_large");
    expect(html).not.toContain("route-point-modal__entry-author\">Левин");
  });
});
