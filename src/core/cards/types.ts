export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;

export type Suit = (typeof SUITS)[number];

export type CardColor = "red" | "black";

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  color: CardColor;
  faceUp: boolean;
};

