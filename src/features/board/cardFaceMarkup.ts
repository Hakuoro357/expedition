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
  return 12;
}

function getCenterSuitScale(suit: Suit): number {
  return suit === "diamonds" ? 0.65 : 0.55;
}

function getCenterSuitY(suit: Suit): number {
  switch (suit) {
    case "spades":
      return 34.5;
    case "clubs":
      return 34.0;
    case "diamonds":
      return 35.0;
    case "hearts":
      return 35.0;
  }
}

function createCornerIndexMarkup(rankLabel: string, suit: Suit, suitFill: string): string {
  return `
    <text
      x="0"
      y="0"
      fill="${suitFill}"
      font-family="'Trebuchet MS', 'Segoe UI Symbol', Verdana, sans-serif"
      font-size="12"
      font-weight="700"
      text-rendering="geometricPrecision"
      dominant-baseline="middle"
      letter-spacing="0"
    ><tspan>${rankLabel}</tspan><tspan dx="2" dy="0.5" font-size="${getCornerSuitFontSize(suit)}">${getCornerSuitChar(suit)}</tspan></text>
  `.trim();
}

function getSuitShapeMarkup(suit: Suit, color: string, scale = 1): string {
  const transform = `scale(${scale})`;
  switch (suit) {
    case "hearts":
      // Compact heart with slightly wider lobes
      return `
        <g transform="${transform}" fill="${color}">
          <path d="M 0 16 C -7 10 -14 4 -14 -3 C -14 -10 -9 -15 -5 -15 C -2 -15 0 -13 0 -11 C 0 -13 2 -15 5 -15 C 9 -15 14 -10 14 -3 C 14 4 7 10 0 16 Z"/>
        </g>`;
    case "diamonds":
      return `
        <g transform="${transform}" fill="${color}">
          <path d="M 0,-16 L 12,0 L 0,16 L -12,0 Z" />
        </g>`;
    case "clubs":
      // Compact clover with balanced lobes
      return `
        <g transform="${transform}" fill="${color}">
          <path d="M 0 -14 C -5 -14 -9 -10 -9 -5 C -14 -5 -18 -1 -18 5 C -18 11 -14 14 -8 14 C -5 14 -2 12 0 10 C 2 12 5 14 8 14 C 14 14 18 11 18 5 C 18 -1 14 -5 9 -5 C 9 -10 5 -14 0 -14 Z" />
          <path d="M -3 9 H 3 L 4 24 H -4 Z" />
          <path d="M -10 24 Q 0 18 10 24 Z" />
        </g>`;
    case "spades":
      // Compact spade with balanced proportions
      return `
        <g transform="${transform}" fill="${color}">
          <path d="M 0 -18 C -5 -11 -15 -4 -15 6 C -15 13 -10 17 -6 17 C -3 17 -1 15 0 13 C 1 15 3 17 6 17 C 10 17 15 13 15 6 C 15 -4 5 -11 0 -18 Z" />
          <path d="M -3 9 H 3 L 4 24 H -4 Z" />
          <path d="M -10 24 Q 0 18 10 24 Z" />
        </g>`;
  }
}

export function createCardFaceSvgMarkup(card: Card, selected = false): string {
  const rankLabel = getRankLabel(card.rank);
  const suitFill = getSuitFill(card.suit);
  const stroke = selected ? "#e3a34f" : "#dac9a1";
  const cornerIndexMarkup = createCornerIndexMarkup(rankLabel, card.suit, suitFill);

  return `
    <svg class="game-overlay__dom-card-svg" viewBox="0 0 44 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0.75" y="0.75" width="42.5" height="68.5" rx="4.5" fill="#f7ecd8" stroke="${stroke}" stroke-width="1.5"/>
      <g transform="translate(4.5 10.5)">
        ${cornerIndexMarkup}
      </g>
      <g transform="translate(22 ${getCenterSuitY(card.suit)})">
        ${getSuitShapeMarkup(card.suit, suitFill, getCenterSuitScale(card.suit))}
      </g>
      <g transform="translate(39.5 59.5) rotate(180)">
        ${cornerIndexMarkup}
      </g>
    </svg>
  `.trim();
}
