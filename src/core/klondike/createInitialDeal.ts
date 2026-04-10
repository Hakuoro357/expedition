import { createShuffledDeck } from "@/core/cards/deck";
import type { Card } from "@/core/cards/types";
import type { GameMode, GameState, Pile } from "@/core/game-state/types";
import { getDailySeedForDate } from "@/data/dailyDeals";
import { findRandomSolvableSeed } from "@/core/klondike/randomSeed";

function createPile(id: string, type: Pile["type"], cards: Card[] = []): Pile {
  return { id, type, cards };
}

/**
 * Resolves the seed for a given dealId:
 *  - If overrideSeed is provided, use it as-is (resume saved game)
 *  - Adventure nodes without override: random solvable seed (each
 *    attempt gets a fresh layout — no frustrating identical retries)
 *  - Daily: uses date-based seed (same deal for everyone today)
 *  - Fallback: random solvable seed (quick-play / sandbox)
 */
function resolveSeed(mode: GameMode, _dealId: string, overrideSeed?: number): number {
  if (overrideSeed !== undefined) return overrideSeed;

  if (mode === "daily") {
    return getDailySeedForDate();
  }

  // Adventure and quick-play: every new deal gets a fresh solvable seed
  return findRandomSolvableSeed();
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

