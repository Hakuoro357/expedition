import { describe, expect, it } from "vitest";

import { createSettingsSceneOverlayHtml } from "@/scenes/settingsSceneOverlay";

describe("settingsSceneOverlay", () => {
  it("renders sections, sliders and shared nav", () => {
    const html = createSettingsSceneOverlayHtml({
      title: "Настройки",
      languageLabel: "Язык",
      resetLabel: "Сбросить сохранение",
      ruLabel: "✓ RU",
      enLabel: "EN",
      trLabel: "TR",
      sfxLabel: "Звук",
      musicLabel: "Музыка",
      sfxVolume: 0.8,
      musicVolume: 0.6,
      navItems: [
        { id: "home", label: "Домой", active: false },
        { id: "daily", label: "Маршрут дня", active: false },
        { id: "settings", label: "Настройки", active: true },
      ],
    });

    expect(html).toContain("settings-page__title");
    expect(html).toContain('data-settings-action="locale-ru"');
    expect(html).toContain('data-settings-volume="sfx"');
    expect(html).toContain('data-settings-volume="music"');
    expect(html).toContain('data-settings-action="reset-save"');
    expect(html).toContain('data-app-nav="settings"');
    expect(html).toContain("80%");
    expect(html).toContain("60%");
  });
});
