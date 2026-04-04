import { describe, expect, it } from "vitest";
import { createRewardOverlayHtml } from "@/scenes/rewardSceneOverlay";

describe("rewardSceneOverlay", () => {
  it("renders reward summary, found items, media, nav, and chapter progress", () => {
    const html = createRewardOverlayHtml({
      title: "Победа!",
      coinsLabel: "+50 монет",
      chapterProgressLabel: "Глава 1 • 2/10",
      foundTitle: "Вы нашли",
      revealItems: [
        {
          type: "entry",
          id: "entry-1",
          title: "Точка 2",
          badgeLabel: "Запись",
          subtitle: "Короткий фрагмент записи.",
          mediaUrl: "/portraits/voronov.png",
        },
      ],
      adStatus: "+25 монет!",
      navItems: [
        { id: "archive", label: "Архив", active: false },
        { id: "daily", label: "Маршрут дня", active: false },
        { id: "settings", label: "Настройки", active: false },
      ],
    });

    expect(html).toContain("reward-overlay__coins");
    expect(html).toContain("reward-overlay__chapter-progress");
    expect(html).toContain("Вы нашли");
    expect(html).toContain("reward-overlay__found-card");
    expect(html).toContain("reward-overlay__found-card-badge");
    expect(html).toContain("reward-overlay__found-card-title");
    expect(html).toContain("reward-overlay__found-card-subtitle");
    expect(html).toContain("reward-overlay__found-card-media-image");
    expect(html).toContain("/portraits/voronov.png");
    expect(html).toContain('data-app-nav="archive"');
    expect(html).toContain("Победа!");
    expect(html).toContain("+25 монет!");
  });
});
