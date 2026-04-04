import { describe, expect, it } from "vitest";

import { hasAnyMoves } from "@/core/klondike/engine";
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
    hintCount: 0,
  };
}

describe("hasAnyMoves", () => {
  it("detects move to foundation from tableau", () => {
    const state = makeState([[makeCard("a1", 1, "spades")]]);
    // Foundation 0 is Spades (empty). Ace can move.
    expect(hasAnyMoves(state)).toBe(true);
  });

  it("detects move to foundation from waste", () => {
    const state = makeState([]);
    state.waste.cards = [makeCard("a1", 1, "spades")];
    expect(hasAnyMoves(state)).toBe(true);
  });

  it("detects move between tableau piles", () => {
    const state = makeState([
      [makeCard("k1", 13, "spades")], // King
      [makeCard("q1", 12, "hearts")], // Queen
    ]);
    // K can move on Q
    expect(hasAnyMoves(state)).toBe(true);
  });

  it("detects move of sub-sequence in tableau", () => {
    // Bug fix: hasAnyMoves must check all open sub-sequences, not just the bottom-most open card.
    const state = makeState([
      [
        makeCard("s9", 9, "spades", false),
        makeCard("d8", 8, "diamonds", true),
        makeCard("c7", 7, "clubs", true),
      ],
      [makeCard("h7", 7, "hearts")],
      [makeCard("h8", 8, "hearts")],
    ]);
    // 8D cannot move onto 7H (Tableau 1), but 7C CAN move onto 8H (Tableau 2).
    // Old logic would fail. New logic should pass.
    expect(hasAnyMoves(state)).toBe(true);
  });

  it("returns false when no moves are possible", () => {
    const state = makeState([
      [makeCard("s2", 2, "spades")],
      [makeCard("c2", 2, "clubs")],
    ]);
    // Foundations: Spades has 3S, Clubs has 3C
    state.foundations[0].cards = [makeCard("s3", 3, "spades")];
    state.foundations[1].cards = [makeCard("c3", 3, "clubs")];
    // No waste, no stock. 2S cannot go on 3S. 2C cannot go on 3C.
    expect(hasAnyMoves(state)).toBe(false);
  });

  it("handles recycling stock as a move", () => {
    const state = makeState([]);
    state.stock.cards = [makeCard("x", 10, "spades", false)];
    expect(hasAnyMoves(state)).toBe(true);
  });
});
