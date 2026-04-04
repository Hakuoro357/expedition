import type { CardColor, Rank, Suit } from "@/core/cards/types";
import { SUITS } from "@/core/cards/types";

const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

const FACE_CARDS: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

const CARD_RED = "#a93f48";
const CARD_BLACK = "#1b1b1b";

export const CARD_FACE_ASSET_WIDTH = 176;
export const CARD_FACE_ASSET_HEIGHT = 280;

function getRankLabel(rank: Rank): string {
  return FACE_CARDS[rank] ?? String(rank);
}

function getSuitShapeMarkup(suit: Suit, color: string, scale = 1): string {
  const transform = `scale(${scale})`;
  switch (suit) {
    case "hearts":
      return `
        <g transform="${transform}" fill="${color}">
          <circle cx="-8" cy="-5" r="8" />
          <circle cx="8" cy="-5" r="8" />
          <path d="M -16,-2 L 0,18 L 16,-2 Z" />
        </g>`;
    case "diamonds":
      return `
        <g transform="${transform}" fill="${color}">
          <path d="M 0,-18 L 14,0 L 0,18 L -14,0 Z" />
        </g>`;
    case "clubs":
      return `
        <g transform="${transform}" fill="${color}">
          <circle cx="0" cy="-9" r="8" />
          <circle cx="-8" cy="2" r="8" />
          <circle cx="8" cy="2" r="8" />
          <rect x="-3.5" y="6" width="7" height="14" rx="2.5" />
          <path d="M -8,18 Q 0,10 8,18 Z" />
        </g>`;
    case "spades":
      return `
        <g transform="${transform}" fill="${color}">
          <circle cx="-8" cy="2" r="8" />
          <circle cx="8" cy="2" r="8" />
          <path d="M -16,5 L 0,-18 L 16,5 Z" />
          <rect x="-3.5" y="8" width="7" height="14" rx="2.5" />
          <path d="M -8,20 Q 0,12 8,20 Z" />
        </g>`;
  }
}

function getColorBySuit(suit: Suit): CardColor {
  return suit === "diamonds" || suit === "hearts" ? "red" : "black";
}

export function getCardFaceTextureKey(rank: Rank, suit: Suit): string {
  return `card-face-svg-${rank}-${suit}`;
}

export function getCardFaceSvgDataUri(rank: Rank, suit: Suit): string {
  const textColor = getColorBySuit(suit) === "red" ? CARD_RED : CARD_BLACK;
  const rankLabel = getRankLabel(rank);
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 176 280">
  <rect width="176" height="280" rx="12" fill="#f7ecd8"/>
  <rect x="3" y="3" width="170" height="274" rx="10" fill="none" stroke="#dac9a1" stroke-width="6"/>
  <g transform="translate(20 22)">
    <text x="0" y="0" fill="${textColor}" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700">${rankLabel}</text>
    <g transform="translate(12 26)">
      ${getSuitShapeMarkup(suit, textColor, 0.56)}
    </g>
  </g>
  <g transform="translate(88 140)">
    ${getSuitShapeMarkup(suit, textColor, 1.6)}
  </g>
  <g transform="translate(156 258) rotate(180)">
    <text x="0" y="0" text-anchor="end" fill="${textColor}" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="700">${rankLabel}</text>
    <g transform="translate(-12 -26)">
      ${getSuitShapeMarkup(suit, textColor, 0.56)}
    </g>
  </g>
</svg>`.trim();
  const encoded = window.btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
}

export function getAllCardFaceDefinitions(): Array<{ key: string; uri: string }> {
  const faces: Array<{ key: string; uri: string }> = [];

  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      faces.push({
        key: getCardFaceTextureKey(rank, suit),
        uri: getCardFaceSvgDataUri(rank, suit),
      });
    });
  });

  return faces;
}
