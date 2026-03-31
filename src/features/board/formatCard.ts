import type { Card } from "@/core/cards/types";

const FACE_CARDS: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K"
};

const SUIT_SYMBOLS: Record<Card["suit"], string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠"
};

export function formatCard(card: Card): string {
  const rank = FACE_CARDS[card.rank] ?? String(card.rank);
  return `${rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function formatRank(card: Card): string {
  return FACE_CARDS[card.rank] ?? String(card.rank);
}

export function formatSuit(card: Card): string {
  return SUIT_SYMBOLS[card.suit];
}

