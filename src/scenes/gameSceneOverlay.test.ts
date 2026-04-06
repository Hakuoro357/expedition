import { describe, expect, it } from "vitest";

import { createGameSceneOverlayHtml } from "@/scenes/gameSceneOverlay";

describe("gameSceneOverlay", () => {
  it("renders shared nav buttons with rules in footer", () => {
    const html = createGameSceneOverlayHtml({
      title: "Смещённые отметки",
      subtitle: "Глава 1 • 2/10",
      coinsLabel: "100",
      stockCountLabel: "24",
      wasteHasCard: false,
      wasteActive: false,
      foundationSlots: [
        { suitSymbol: "♠", active: false, hasCard: false },
        { suitSymbol: "♣", active: false, hasCard: false },
        { suitSymbol: "♦", active: false, hasCard: false },
        { suitSymbol: "♥", active: false, hasCard: false },
      ],
      undoLabel: "Отмена",
      hintLabel: "Подсказка",
      rulesLabel: "Правила",
      homeLabel: "Домой",
      cards: [],
      dragCards: [],
      faceDownCards: [],
    });

    expect(html).toContain('data-game-action="undo"');
    expect(html).toContain('data-game-action="rules"');
    expect(html).toContain('data-game-action="home"');
    expect(html).toContain("game-overlay__title");
    expect(html).toContain("game-overlay__coins");
    expect(html).toContain("game-overlay__slot--stock");
    // Slot count is removed per new design requirements
    expect(html).not.toContain("game-overlay__slot-count");
    expect(html).toContain("game-overlay__slot--foundation-3");
    // No more question button in top-right corner
    expect(html).not.toContain("game-overlay__question");
    expect(html).not.toContain("data-game-rules");
    // Nav labels should be present
    expect(html).toContain("game-overlay__action-label");
  });

  it("renders DOM face-up cards", () => {
    const html = createGameSceneOverlayHtml({
      title: "Смещённые отметки",
      subtitle: "Глава 1 • 2/10",
      coinsLabel: "100",
      stockCountLabel: "22",
      wasteHasCard: true,
      wasteActive: false,
      foundationSlots: [
        { suitSymbol: "♠", active: false, hasCard: false },
        { suitSymbol: "♣", active: false, hasCard: false },
        { suitSymbol: "♦", active: false, hasCard: true },
        { suitSymbol: "♥", active: false, hasCard: false },
      ],
      undoLabel: "Отмена",
      hintLabel: "Подсказка",
      rulesLabel: "Правила",
      homeLabel: "Домой",
      cards: [
        {
          key: "tableau-c1",
          left: 17,
          top: 191,
          card: { id: "c1", rank: 9, suit: "hearts", color: "red", faceUp: true },
          selected: false,
        },
      ],
      dragCards: [],
      faceDownCards: [],
    });

    expect(html).toContain("game-overlay__dom-cards");
    expect(html).toContain('data-card-key="tableau-c1"');
    expect(html).toContain("game-overlay__dom-card-svg");
  });

  it("renders face-down tableau cards with card back", () => {
    const cardBackSvg = `<svg viewBox="0 0 300 420"><rect fill="#C4985A"/></svg>`;
    const html = createGameSceneOverlayHtml({
      title: "Тест",
      subtitle: "",
      coinsLabel: "0",
      stockCountLabel: "0",
      wasteHasCard: false,
      wasteActive: false,
      foundationSlots: [],
      undoLabel: "Отмена",
      hintLabel: "Подсказка",
      rulesLabel: "Правила",
      homeLabel: "Домой",
      cards: [],
      dragCards: [],
      cardBackSvg: cardBackSvg,
      faceDownCards: [
        { key: "tableau-facedown-x1", left: 17, top: 191 },
        { key: "tableau-facedown-x2", left: 17, top: 209 },
      ],
    });

    expect(html).toContain("game-overlay__dom-cards--facedown");
    expect(html).toContain("game-overlay__dom-card--facedown");
    expect(html).toContain("game-overlay__card-back");
    expect(html).toContain('data-card-key="tableau-facedown-x1"');
    expect(html).toContain('data-card-key="tableau-facedown-x2"');
    expect(html).toContain("left:17px");
    expect(html).toContain("top:191px");
  });

  it("renders face-down cards at correct tableau positions without duplicating face-up cards", () => {
    // Simulates a tableau pile: 2 face-down + 2 face-up cards
    // Face-down: x1 (top=226), x2 (top=244)
    // Face-up: c3 (top=262), c4 (top=280)
    const cardBackSvg = `<svg viewBox="0 0 300 420"><rect fill="#C4985A"/></svg>`;
    const html = createGameSceneOverlayHtml({
      title: "Tableau pile test",
      subtitle: "",
      coinsLabel: "50",
      stockCountLabel: "20",
      wasteHasCard: false,
      wasteActive: false,
      foundationSlots: [],
      undoLabel: "Undo",
      hintLabel: "Hint",
      rulesLabel: "Rules",
      homeLabel: "Home",
      cards: [
        {
          key: "tableau-c3",
          left: 39,
          top: 262,
          card: { id: "c3", rank: 5, suit: "hearts", color: "red", faceUp: true },
          selected: false,
        },
        {
          key: "tableau-c4",
          left: 39,
          top: 280,
          card: { id: "c4", rank: 4, suit: "spades", color: "black", faceUp: true },
          selected: false,
        },
      ],
      dragCards: [],
      cardBackSvg,
      faceDownCards: [
        { key: "tableau-facedown-x1", left: 39, top: 226 },
        { key: "tableau-facedown-x2", left: 39, top: 244 },
      ],
    });

    // Face-down cards should be rendered with card backs at correct positions
    expect(html).toContain('data-card-key="tableau-facedown-x1"');
    expect(html).toContain('data-card-key="tableau-facedown-x2"');
    expect(html).toContain("left:39px");
    expect(html).toContain("top:226px");
    expect(html).toContain("top:244px");

    // Face-up cards should NOT appear in the face-down section
    const faceDownSection = html.match(
      /game-overlay__dom-cards--facedown[\s\S]*?<\/div>\s*<\/div>/,
    )?.[0] ?? "";
    expect(faceDownSection).not.toContain("tableau-c3");
    expect(faceDownSection).not.toContain("tableau-c4");

    // Face-up cards should appear in the regular cards section
    expect(html).toContain('data-card-key="tableau-c3"');
    expect(html).toContain('data-card-key="tableau-c4"');
  });

  it("does not render face-down cards when list is empty", () => {
    const cardBackSvg = `<svg viewBox="0 0 300 420"><rect fill="#C4985A"/></svg>`;
    const html = createGameSceneOverlayHtml({
      title: "No face-down",
      subtitle: "",
      coinsLabel: "0",
      stockCountLabel: "0",
      wasteHasCard: false,
      wasteActive: false,
      foundationSlots: [],
      undoLabel: "Undo",
      hintLabel: "Hint",
      rulesLabel: "Rules",
      homeLabel: "Home",
      cards: [],
      dragCards: [],
      cardBackSvg,
      faceDownCards: [],
    });

    // No face-down container should be rendered
    expect(html).not.toContain("game-overlay__dom-cards--facedown");
  });
});
