import type { Card, Rank, Suit } from "@/core/cards/types";

const FACE_CARDS: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

function getRankLabel(rank: Rank): string {
  return FACE_CARDS[rank] ?? String(rank);
}

function getSuitFill(suit: Suit): string {
  return suit === "diamonds" || suit === "hearts" ? "#b14955" : "#161616";
}

function getCornerSuitChar(suit: Suit): string {
  switch (suit) {
    case "spades":
      return "♠";
    case "clubs":
      return "♣";
    case "diamonds":
      return "♦";
    case "hearts":
      return "♥";
  }
}

function getCornerSuitFontSize(_suit: Suit): number {
  // Increased by 30% from 12px to 16px
  return 16;
}

function getCenterSuitChar(suit: Suit): string {
  switch (suit) {
    case "spades":
      return "♠";
    case "clubs":
      return "♣";
    case "diamonds":
      return "♦";
    case "hearts":
      return "♥";
  }
}

function getCenterSuitFontSize(suit: Suit): number {
  // Match the visual size of foundation suit symbols, increased by 30%
  // diamonds needs to be slightly smaller to match proportions
  return suit === "diamonds" ? 29 : 34;
}

function getCenterSuitY(suit: Suit): number {
  // Adjusted for text baseline alignment, moved up slightly
  switch (suit) {
    case "spades":
      return 33.5;
    case "clubs":
      return 33.0;
    case "diamonds":
      return 33.5;
    case "hearts":
      return 33.5;
  }
}

function getCenterSuitMarkup(suit: Suit, color: string): string {
  const char = getCenterSuitChar(suit);
  const fontSize = getCenterSuitFontSize(suit);
  return `
    <text
      x="0"
      y="0"
      fill="${color}"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${fontSize}"
      text-anchor="middle"
      dominant-baseline="central"
      text-rendering="geometricPrecision"
    >${char}</text>
  `.trim();
}

function createCornerIndexMarkup(rankLabel: string, suit: Suit, suitFill: string): string {
  return `
    <text
      x="0"
      y="0"
      fill="${suitFill}"
      font-family="'Trebuchet MS', Verdana, sans-serif"
      font-size="12"
      font-weight="700"
      text-rendering="geometricPrecision"
      dominant-baseline="middle"
      letter-spacing="0"
    ><tspan>${rankLabel}</tspan><tspan dx="1" dy="-2" font-family="Georgia, 'Times New Roman', serif" font-size="${getCornerSuitFontSize(suit)}" dominant-baseline="central">${getCornerSuitChar(suit)}</tspan></text>
  `.trim();
}

export function createCardFaceSvgMarkup(card: Card, selected = false): string {
  const rankLabel = getRankLabel(card.rank);
  const suitFill = getSuitFill(card.suit);
  const stroke = selected ? "#e3a34f" : "#dac9a1";
  const cornerIndexMarkup = createCornerIndexMarkup(rankLabel, card.suit, suitFill);
  const centerSuitMarkup = getCenterSuitMarkup(card.suit, suitFill);

  return `
    <svg class="game-overlay__dom-card-svg" viewBox="0 0 44 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0.75" y="0.75" width="42.5" height="68.5" rx="4.5" fill="#f7ecd8" stroke="${stroke}" stroke-width="1.5"/>
      <g transform="translate(4.5 10.5)">
        ${cornerIndexMarkup}
      </g>
      <g transform="translate(22 ${getCenterSuitY(card.suit)})">
        ${centerSuitMarkup}
      </g>
      <g transform="translate(39.5 59.5) rotate(180)">
        ${cornerIndexMarkup}
      </g>
    </svg>
  `.trim();
}
