import { describe, expect, it } from "vitest";
import type { Card } from "@/core/cards/types";
import { createInitialDeal } from "@/core/klondike/createInitialDeal";
import {
  canMoveCardToFoundation,
  canMoveCardsToTableau,
  drawFromStock,
  getGameStatus,
  moveTableauToFoundation,
  moveWasteToTableau
} from "@/core/klondike/engine";

function createCard(
  suit: Card["suit"],
  rank: Card["rank"],
  faceUp = true
): Card {
  return {
    id: `${suit}-${rank}`,
    suit,
    rank,
    color: suit === "diamonds" || suit === "hearts" ? "red" : "black",
    faceUp
  };
}

describe("createInitialDeal", () => {
  it("creates 7 tableau piles and 24 stock cards", () => {
    const state = createInitialDeal("adventure", "test-deal", 123);

    expect(state.tableau).toHaveLength(7);
    expect(state.tableau.map((pile) => pile.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(state.stock.cards).toHaveLength(24);
    expect(state.tableau.every((pile) => pile.cards[pile.cards.length - 1]?.faceUp)).toBe(true);
  });
});

describe("drawFromStock", () => {
  it("moves one card from stock to waste face up", () => {
    const state = createInitialDeal("adventure", "test-deal", 123);
    const nextState = drawFromStock(state);

    expect(nextState.stock.cards).toHaveLength(23);
    expect(nextState.waste.cards).toHaveLength(1);
    expect(nextState.waste.cards[0]?.faceUp).toBe(true);
  });

  it("recycles waste back into stock when stock is empty", () => {
    const state = createInitialDeal("adventure", "test-deal", 123);
    let nextState = state;

    for (let index = 0; index < 24; index += 1) {
      nextState = drawFromStock(nextState);
    }

    expect(nextState.stock.cards).toHaveLength(0);
    expect(nextState.waste.cards).toHaveLength(24);

    nextState = drawFromStock(nextState);

    expect(nextState.stock.cards).toHaveLength(24);
    expect(nextState.stock.cards.every((card) => !card.faceUp)).toBe(true);
    expect(nextState.waste.cards).toHaveLength(0);
  });
});

describe("move validation", () => {
  it("allows descending alternating stack onto tableau", () => {
    const movingCards = [createCard("hearts", 12), createCard("clubs", 11)];
    const targetPile = {
      id: "tableau-1",
      type: "tableau" as const,
      cards: [createCard("spades", 13)]
    };

    expect(canMoveCardsToTableau(movingCards, targetPile)).toBe(true);
  });

  it("allows ace to empty foundation", () => {
    const foundationPile = {
      id: "foundation-1",
      type: "foundation" as const,
      cards: []
    };

    expect(canMoveCardToFoundation(createCard("spades", 1), foundationPile, 0)).toBe(true);
    expect(canMoveCardToFoundation(createCard("spades", 2), foundationPile, 0)).toBe(false);
    // Wrong suit for slot 0 (spades only)
    expect(canMoveCardToFoundation(createCard("hearts", 1), foundationPile, 0)).toBe(false);
  });
});

describe("moves", () => {
  it("moves waste card onto compatible tableau", () => {
    const state = createInitialDeal("adventure", "custom", 1);
    state.waste.cards = [createCard("hearts", 12)];
    state.tableau[0].cards = [createCard("clubs", 13)];

    const nextState = moveWasteToTableau(state, 0);

    expect(nextState).not.toBeNull();
    expect(nextState?.waste.cards).toHaveLength(0);
    expect(nextState?.tableau[0].cards.at(-1)?.rank).toBe(12);
  });

  it("reveals next tableau card after moving to foundation", () => {
    const state = createInitialDeal("adventure", "custom", 1);
    state.tableau[0].cards = [createCard("clubs", 5, false), createCard("spades", 1)];
    state.foundations[0].cards = [];

    const nextState = moveTableauToFoundation(state, 0, 0);

    expect(nextState).not.toBeNull();
    expect(nextState?.foundations[0].cards.at(-1)?.rank).toBe(1);
    expect(nextState?.tableau[0].cards[0]?.faceUp).toBe(true);
  });
});

describe("getGameStatus", () => {
  it("returns won when all foundation cards are placed", () => {
    const state = createInitialDeal("adventure", "done", 1);
    state.foundations = [
      { id: "f1", type: "foundation", cards: Array.from({ length: 13 }, (_, index) => createCard("clubs", (index + 1) as Card["rank"])) },
      { id: "f2", type: "foundation", cards: Array.from({ length: 13 }, (_, index) => createCard("diamonds", (index + 1) as Card["rank"])) },
      { id: "f3", type: "foundation", cards: Array.from({ length: 13 }, (_, index) => createCard("hearts", (index + 1) as Card["rank"])) },
      { id: "f4", type: "foundation", cards: Array.from({ length: 13 }, (_, index) => createCard("spades", (index + 1) as Card["rank"])) }
    ];

    expect(getGameStatus(state)).toBe("won");
  });
});
