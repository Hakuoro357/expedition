import type { Card } from "@/core/cards/types";
import type { Locale } from "@/services/i18n/locales";
import { getRankLabel } from "@/assets/cards/cardFaceSvg";

const SUIT_SYMBOLS: Record<Card["suit"], string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠"
};

export function formatCard(card: Card, locale: Locale = "en"): string {
  return `${getRankLabel(card.rank, locale)}${SUIT_SYMBOLS[card.suit]}`;
}

export function formatRank(card: Card, locale: Locale = "en"): string {
  return getRankLabel(card.rank, locale);
}

export function formatSuit(card: Card): string {
  return SUIT_SYMBOLS[card.suit];
}

