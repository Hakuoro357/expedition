import { describe, expect, it } from "vitest";

import { createTitleSceneOverlayHtml } from "@/scenes/titleSceneOverlay";

describe("titleSceneOverlay", () => {
  it("renders title, subtitle and three buttons with continue enabled", () => {
    const html = createTitleSceneOverlayHtml({
      title: "Solitaire: Expedition",
      subtitle: "An expedition off the official map",
      newGameLabel: "New Game",
      continueLabel: "Continue",
      continueEnabled: true,
      settingsLabel: "Settings",
    });

    expect(html).toContain("title-scene");
    expect(html).toContain("Solitaire: Expedition");
    expect(html).toContain("An expedition off the official map");
    expect(html).toContain('data-title-action="new-game"');
    expect(html).toContain('data-title-action="continue"');
    expect(html).toContain('data-title-action="settings"');
    // continueEnabled=true → primary стиль на «Continue», у «New Game» — вторичный
    expect(html).toContain("title-scene__button--primary");
    // disabled-классу здесь не место
    expect(html).not.toContain("title-scene__button--disabled");
    expect(html).not.toContain("disabled aria-disabled");
  });

  it("disables continue and shifts primary to new-game on first launch", () => {
    const html = createTitleSceneOverlayHtml({
      title: "Solitaire: Expedition",
      subtitle: "Sub",
      newGameLabel: "Начать",
      continueLabel: "Продолжить",
      continueEnabled: false,
      settingsLabel: "Настройки",
    });

    // disabled-классу место — на кнопке «Продолжить»
    expect(html).toContain("title-scene__button--disabled");
    expect(html).toContain('disabled aria-disabled="true"');
    // primary должен быть на «New Game», а не на «Continue»
    const newGameMatch = html.match(
      /<button class="([^"]*)" data-title-action="new-game"/,
    );
    expect(newGameMatch).not.toBeNull();
    expect(newGameMatch![1]).toContain("title-scene__button--primary");
    const continueMatch = html.match(
      /<button class="([^"]*)" data-title-action="continue"/,
    );
    expect(continueMatch).not.toBeNull();
    expect(continueMatch![1]).not.toContain("title-scene__button--primary");
  });

  it("escapes HTML in user-provided labels", () => {
    const html = createTitleSceneOverlayHtml({
      title: "<script>x</script>",
      subtitle: '"quoted"',
      newGameLabel: "&amp;",
      continueLabel: "Continue",
      continueEnabled: true,
      settingsLabel: "Settings",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;quoted&quot;");
    expect(html).toContain("&amp;amp;");
  });
});
