import { describe, expect, it } from "vitest";

import { createSettingsSceneOverlayHtml } from "@/scenes/settingsSceneOverlay";

describe("settingsSceneOverlay", () => {
  it("renders sections and shared nav", () => {
    const html = createSettingsSceneOverlayHtml({
      title: "Настройки",
      languageLabel: "Язык",
      soundLabel: "Звук",
      resetLabel: "Сбросить сохранение",
      ruLabel: "✓ RU",
      enLabel: "EN",
      soundToggleLabel: "Звук: ON",
      navItems: [
        { id: "home", label: "Домой", active: false },
        { id: "daily", label: "Маршрут дня", active: false },
        { id: "settings", label: "Настройки", active: true },
      ],
    });

    expect(html).toContain("settings-page__title");
    expect(html).toContain('data-settings-action="locale-ru"');
    expect(html).toContain('data-settings-action="toggle-sound"');
    expect(html).toContain('data-settings-action="reset-save"');
    expect(html).toContain('data-app-nav="settings"');
  });
});
