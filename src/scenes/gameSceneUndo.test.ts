import { describe, expect, it } from "vitest";

import { cloneGameState, moveTableauToFoundation, moveWasteToFoundation } from "@/core/klondike/engine";
import type { GameState, Pile } from "@/core/game-state/types";
import type { Card } from "@/core/cards/types";

function makeCard(
  id: string,
  rank: number,
  suit: "spades" | "clubs" | "diamonds" | "hearts",
  faceUp = true
): Card {
  const color = suit === "spades" || suit === "clubs" ? "black" : "red";
  return { id, rank: rank as any, suit, color, faceUp };
}

function makePile(id: string, type: Pile["type"], cards: Card[]): Pile {
  return { id, type, cards };
}

function makeState(tableauCards: Card[][], wasteCards: Card[] = []): GameState {
  return {
    dealId: "test",
    mode: "adventure",
    stock: makePile("stock", "stock", []),
    waste: makePile("waste", "waste", wasteCards),
    foundations: [
      makePile("f0", "foundation", []),
      makePile("f1", "foundation", []),
      makePile("f2", "foundation", []),
      makePile("f3", "foundation", []),
    ],
    tableau: tableauCards.map((cards, index) => makePile(`t${index}`, "tableau", cards)),
    status: "in_progress",
    undoCount: 0,
  };
}

describe("undo logic", () => {
  it("moveTableauToFoundation returns correct state", () => {
    const state = makeState([[makeCard("s1", 1, "spades")]]);
    const nextState = moveTableauToFoundation(state, 0, 0);
    expect(nextState).not.toBeNull();
    expect(nextState!.foundations[0].cards.length).toBe(1);
    expect(nextState!.tableau[0].cards.length).toBe(0);
  });

  it("moveWasteToFoundation returns correct state", () => {
    const state = makeState([], [makeCard("s1", 1, "spades")]);
    const nextState = moveWasteToFoundation(state, 0);
    expect(nextState).not.toBeNull();
    expect(nextState!.foundations[0].cards.length).toBe(1);
    expect(nextState!.waste.cards.length).toBe(0);
  });

  it("cloneGameState creates independent copy", () => {
    const state = makeState([[makeCard("s1", 1, "spades")]]);
    const cloned = cloneGameState(state);
    expect(cloned).not.toBe(state);
    expect(cloned.tableau[0]).not.toBe(state.tableau[0]);
  });
});
