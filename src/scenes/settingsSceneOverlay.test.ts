import { describe, expect, it } from "vitest";

import { createSettingsSceneOverlayHtml } from "@/scenes/settingsSceneOverlay";

describe("settingsSceneOverlay", () => {
  it("omits bottom-nav when navItems is undefined (first-run from title guard)", () => {
    // Регрессия v0.3.44: Settings, открытые из TitleScene до пролога,
    // не должны показывать archive/daily nav — иначе игрок может
    // обойти стартовый funnel. SettingsScene передаёт navItems:
    // undefined именно для этого случая.
    const html = createSettingsSceneOverlayHtml({
      title: "Настройки",
      languageLabel: "Язык",
      localeOptions: [{ code: "ru", label: "RU", active: true }],
      sfxLabel: "Эффекты",
      musicLabel: "Музыка",
      soundLabel: "Звук",
      muteToggleLabel: "Выключить",
      muted: false,
      sfxVolume: 0.8,
      musicVolume: 0.6,
      backLabel: "Назад",
      // navItems intentionally omitted (= undefined) → nav скрыт
    });

    // Кнопка «← Назад» и сами секции (язык, звук) должны быть.
    expect(html).toContain("data-settings-action=\"go-back\"");
    expect(html).toContain("data-settings-action=\"locale-ru\"");
    expect(html).toContain("data-settings-action=\"toggle-mute\"");
    // А вот bottom nav (archive/daily/settings active) — не должен.
    expect(html).not.toContain("data-app-nav=\"archive\"");
    expect(html).not.toContain("data-app-nav=\"daily\"");
    expect(html).not.toContain("data-app-nav=\"settings\"");
  });

  it("renders sections, sliders and shared nav", () => {
    const html = createSettingsSceneOverlayHtml({
      title: "Настройки",
      languageLabel: "Язык",
      resetLabel: "Сбросить сохранение",
      localeOptions: [
        { code: "ru", label: "RU", active: true },
        { code: "en", label: "EN", active: false },
        { code: "tr", label: "TR", active: false },
      ],
      sfxLabel: "Эффекты",
      musicLabel: "Музыка",
      soundLabel: "Звук",
      muteToggleLabel: "Выключить",
      muted: false,
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
    expect(html).toContain('data-settings-action="toggle-mute"');
    expect(html).toContain('data-settings-volume="sfx"');
    expect(html).toContain('data-settings-volume="music"');
    // «Сброс сохранения» удалён по требованию тестировщиков — его быть не должно.
    expect(html).not.toContain('data-settings-action="reset-save"');
    expect(html).toContain('data-app-nav="settings"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("80%");
    expect(html).toContain("60%");
  });
});
