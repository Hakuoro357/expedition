import { createShuffledDeck } from "@/core/cards/deck";
import type { Card } from "@/core/cards/types";
import type { GameMode, GameState, Pile } from "@/core/game-state/types";
import { getNodeById } from "@/data/chapters";
import { getDailySeedForDate } from "@/data/dailyDeals";

function createPile(id: string, type: Pile["type"], cards: Card[] = []): Pile {
  return { id, type, cards };
}

/**
 * Resolves the seed for a given dealId:
 *  - Adventure nodes: looks up the chapter/node seed
 *  - Daily: uses date-based seed
 *  - Fallback: uses Date.now() (quick-play / sandbox)
 */
function resolveSeed(mode: GameMode, dealId: string, overrideSeed?: number): number {
  if (overrideSeed !== undefined) return overrideSeed;

  if (mode === "adventure") {
    const node = getNodeById(dealId);
    if (node) return node.seed;
  }

  if (mode === "daily") {
    return getDailySeedForDate();
  }

  return Date.now();
}

export function createInitialDeal(mode: GameMode, dealId: string, seed?: number): GameState {
  const resolvedSeed = resolveSeed(mode, dealId, seed);
  const deck = createShuffledDeck(resolvedSeed);
  const tableau: Pile[] = [];

  for (let column = 0; column < 7; column += 1) {
    const cards = deck.splice(0, column + 1).map((card, index, source) => ({
      ...card,
      faceUp: index === source.length - 1
    }));

    tableau.push(createPile(`tableau-${column + 1}`, "tableau", cards));
  }

  const stock = createPile(
    "stock",
    "stock",
    deck.map((card) => ({ ...card, faceUp: false }))
  );

  return {
    mode,
    dealId,
    seed: resolvedSeed,
    status: "in_progress",
    stock,
    waste: createPile("waste", "waste"),
    foundations: [
      createPile("foundation-1", "foundation"),
      createPile("foundation-2", "foundation"),
      createPile("foundation-3", "foundation"),
      createPile("foundation-4", "foundation")
    ],
    tableau,
    undoCount: 0
  };
}

