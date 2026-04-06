import { describe, expect, it } from "vitest";

import { hasProductiveMoves } from "@/core/klondike/engine";
import type { GameState, Pile } from "@/core/game-state/types";
import type { Card, Rank } from "@/core/cards/types";

function makeCard(
  id: string,
  rank: number,
  suit: "spades" | "clubs" | "diamonds" | "hearts",
  faceUp = true
): Card {
  const color = suit === "spades" || suit === "clubs" ? "black" : "red";
  return { id, rank: rank as Rank, suit, color, faceUp };
}

function makePile(id: string, type: Pile["type"], cards: Card[]): Pile {
  return { id, type, cards };
}

function makeState(tableauCards: Card[][]): GameState {
  return {
    dealId: "test",
    mode: "adventure",
    stock: makePile("stock", "stock", []),
    waste: makePile("waste", "waste", []),
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

describe("hasProductiveMoves", () => {
  it("detects move to foundation from tableau", () => {
    const state = makeState([[makeCard("a1", 1, "spades")]]);
    expect(hasProductiveMoves(state)).toBe(true);
  });

  it("detects move to foundation from waste", () => {
    const state = makeState([]);
    state.waste.cards = [makeCard("a1", 1, "spades")];
    expect(hasProductiveMoves(state)).toBe(true);
  });

  it("detects waste → tableau as productive", () => {
    const state = makeState([[makeCard("k1", 13, "spades")]]);
    state.waste.cards = [makeCard("q1", 12, "hearts")]; // Q♥ → K♠
    expect(hasProductiveMoves(state)).toBe(true);
  });

  it("detects tableau → tableau that reveals a face-down card", () => {
    const state = makeState([
      [
        makeCard("s9", 9, "spades", false), // face-down
        makeCard("q1", 12, "hearts", true), // face-up Q♥
      ],
      [makeCard("k1", 13, "spades")], // K♠ — Q♥ can move here
    ]);
    // Moving Q♥ onto K♠ reveals the face-down 9♠ — productive
    expect(hasProductiveMoves(state)).toBe(true);
  });

  it("king shuffle between empty columns is NOT productive", () => {
    const state = makeState([
      [makeCard("k1", 13, "spades")], // K♠ alone, no face-down cards
      [],                              // empty column
    ]);
    // K♠ can move to empty column, but no face-down card is revealed — useless
    expect(hasProductiveMoves(state)).toBe(false);
  });

  it("returns false when no productive moves exist", () => {
    const state = makeState([
      [makeCard("s2", 2, "spades")],
      [makeCard("c2", 2, "clubs")],
    ]);
    // Foundations already have 3s — 2s can't go on top of 3s
    state.foundations[0].cards = [makeCard("s3", 3, "spades")];
    state.foundations[1].cards = [makeCard("c3", 3, "clubs")];
    expect(hasProductiveMoves(state)).toBe(false);
  });

  it("stock with playable cards is productive", () => {
    const state = makeState([]);
    // Ace of spades in stock — can go to empty foundation
    state.stock.cards = [makeCard("a1", 1, "spades", false)];
    expect(hasProductiveMoves(state)).toBe(true);
  });

  it("stock with no playable cards is NOT productive", () => {
    const state = makeState([
      [makeCard("s5", 5, "spades")],
    ]);
    // 10♠ in stock — can't go to foundation (needs ace), can't go on 5♠ (needs 6, alternating)
    state.stock.cards = [makeCard("s10", 10, "spades", false)];
    // Foundations are empty (need aces), 5♠ is on tableau (10 can't stack on 5)
    // Also 5♠ can't go to foundation (needs ace first)
    expect(hasProductiveMoves(state)).toBe(false);
  });
});
