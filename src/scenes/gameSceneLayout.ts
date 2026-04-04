export const GAME_CARD_WIDTH = 44;
export const GAME_CARD_HEIGHT = 70;
export const GAME_TABLEAU_START_X = 39;
export const GAME_TABLEAU_GAP_X = 52;
export const GAME_TABLEAU_START_Y = 226;
export const GAME_FACE_UP_GAP_Y = 18;
export const GAME_FACE_DOWN_GAP_Y = 18;
export const GAME_FOUNDATION_START_X = 195;
export const GAME_FOUNDATION_GAP_X = 52;
export const GAME_TOP_ROW_Y = 136;

export function getGameTableauX(pileIndex: number): number {
  return GAME_TABLEAU_START_X + pileIndex * GAME_TABLEAU_GAP_X;
}

export function getGameFoundationX(foundationIndex: number): number {
  return GAME_FOUNDATION_START_X + foundationIndex * GAME_FOUNDATION_GAP_X;
}

export function getGameCardLeft(centerX: number): number {
  return Math.round(centerX - GAME_CARD_WIDTH / 2);
}

export function getGameCardTop(centerY: number): number {
  return Math.round(centerY - GAME_CARD_HEIGHT / 2);
}
