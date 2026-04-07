import { describe, expect, it } from "vitest";

import {
  createRewardEntryDetailHtml,
  createRewardMapDetailHtml,
  getNarrativeSpeakerName,
} from "@/scenes/rewardSceneDetailOverlay";

describe("rewardSceneDetailOverlay", () => {
  it("renders entry detail with portrait, point, author, and body", () => {
    const html = createRewardEntryDetailHtml({
      pointLabel: "Решение вслух",
      author: "Климова",
      portraitUrl: "/portraits/klimova.png",
      body: "Ни имени, ни даты.",
    });

    expect(html).toContain("Решение вслух");
    expect(html).toContain("Климова");
    expect(html).toContain("Ни имени, ни даты.");
    expect(html).toContain("reward-detail-overlay__portrait-image");
    expect(html).toContain("/portraits/klimova.png");
  });

  it("renders map detail with updated-map title and caption", () => {
    const html = createRewardMapDetailHtml({
      title: "Карта обновлена",
      caption: "Добавлен новый участок маршрута",
    });

    expect(html).toContain("Карта обновлена");
    expect(html).toContain("Добавлен новый участок маршрута");
  });

  it("returns localized speaker names", () => {
    expect(getNarrativeSpeakerName("photographer_archivist", "ru")).toBe("Климова");
    expect(getNarrativeSpeakerName("photographer_archivist", "global")).toBe("Reed");
  });
});
