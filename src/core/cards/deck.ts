import type { Card, CardColor, Rank, Suit } from "@/core/cards/types";
import { SUITS } from "@/core/cards/types";

const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

function getCardColor(suit: Suit): CardColor {
  return suit === "diamonds" || suit === "hearts" ? "red" : "black";
}

export function createOrderedDeck(): Card[] {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      id: `${suit}-${rank}`,
      suit,
      rank,
      color: getCardColor(suit),
      faceUp: false
    }))
  );
}

export function createShuffledDeck(seed = Date.now()): Card[] {
  const deck = [...createOrderedDeck()];
  let randomSeed = seed;

  for (let index = deck.length - 1; index > 0; index -= 1) {
    randomSeed = (randomSeed * 1664525 + 1013904223) % 4294967296;
    const swapIndex = randomSeed % (index + 1);
    const temp = deck[index];
    deck[index] = deck[swapIndex];
    deck[swapIndex] = temp;
  }

  return deck;
}

