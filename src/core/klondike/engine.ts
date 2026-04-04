import type { Card, Suit } from "@/core/cards/types";
import type { GameState, Pile } from "@/core/game-state/types";

/** Фиксированный порядок мастей по foundation-слотам: пики, трефы, бубны, червы */
export const FOUNDATION_SUITS: Suit[] = ["spades", "clubs", "diamonds", "hearts"];

export type TableauSelection = {
  kind: "tableau";
  pileIndex: number;
  cardIndex: number;
};

export type WasteSelection = {
  kind: "waste";
};

export type FoundationSelection = {
  kind: "foundation";
  pileIndex: number;
};

export type Selection = TableauSelection | WasteSelection | FoundationSelection;

function cloneCards(cards: Card[]): Card[] {
  return cards.map((card) => ({ ...card }));
}

function clonePile(pile: Pile): Pile {
  return {
    ...pile,
    cards: cloneCards(pile.cards)
  };
}

export function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    stock: clonePile(state.stock),
    waste: clonePile(state.waste),
    foundations: state.foundations.map(clonePile),
    tableau: state.tableau.map(clonePile)
  };
}

function revealTopTableauCard(pile: Pile): void {
  const topCard = pile.cards[pile.cards.length - 1];

  if (topCard && !topCard.faceUp) {
    topCard.faceUp = true;
  }
}

function isDescendingAlternating(cards: Card[]): boolean {
  for (let index = 0; index < cards.length - 1; index += 1) {
    const current = cards[index];
    const next = cards[index + 1];

    if (current.color === next.color || current.rank !== next.rank + 1) {
      return false;
    }
  }

  return true;
}

export function canMoveCardsToTableau(cards: Card[], targetPile: Pile): boolean {
  if (cards.length === 0) {
    return false;
  }

  if (!cards.every((card) => card.faceUp) || !isDescendingAlternating(cards)) {
    return false;
  }

  const firstCard = cards[0];
  const targetTopCard = targetPile.cards[targetPile.cards.length - 1];

  if (!targetTopCard) {
    return firstCard.rank === 13;
  }

  return targetTopCard.faceUp && targetTopCard.color !== firstCard.color && targetTopCard.rank === firstCard.rank + 1;
}

export function canMoveCardToFoundation(card: Card, targetPile: Pile, foundationIndex: number): boolean {
  // Масть фиксирована за слотом
  if (card.suit !== FOUNDATION_SUITS[foundationIndex]) {
    return false;
  }

  const targetTopCard = targetPile.cards[targetPile.cards.length - 1];

  if (!targetTopCard) {
    return card.rank === 1;
  }

  return targetTopCard.suit === card.suit && targetTopCard.rank + 1 === card.rank;
}

export function drawFromStock(state: GameState): GameState {
  const nextState = cloneGameState(state);

  if (nextState.stock.cards.length > 0) {
    const nextCard = nextState.stock.cards.pop();

    if (!nextCard) {
      return nextState;
    }

    nextCard.faceUp = true;
    nextState.waste.cards.push(nextCard);
    return nextState;
  }

  if (nextState.waste.cards.length === 0) {
    return nextState;
  }

  nextState.stock.cards = nextState.waste.cards.reverse().map((card) => ({
    ...card,
    faceUp: false
  }));
  nextState.waste.cards = [];

  return nextState;
}

export function moveWasteToTableau(
  state: GameState,
  tableauIndex: number
): GameState | null {
  const wasteTop = state.waste.cards[state.waste.cards.length - 1];
  const targetPile = state.tableau[tableauIndex];

  if (!wasteTop || !targetPile || !canMoveCardsToTableau([wasteTop], targetPile)) {
    return null;
  }

  const nextState = cloneGameState(state);
  const card = nextState.waste.cards.pop();

  if (!card) {
    return null;
  }

  nextState.tableau[tableauIndex].cards.push(card);
  return nextState;
}

export function moveWasteToFoundation(
  state: GameState,
  foundationIndex: number
): GameState | null {
  const wasteTop = state.waste.cards[state.waste.cards.length - 1];
  const targetPile = state.foundations[foundationIndex];

  if (!wasteTop || !targetPile || !canMoveCardToFoundation(wasteTop, targetPile, foundationIndex)) {
    return null;
  }

  const nextState = cloneGameState(state);
  const card = nextState.waste.cards.pop();

  if (!card) {
    return null;
  }

  nextState.foundations[foundationIndex].cards.push(card);
  nextState.status = getGameStatus(nextState);
  return nextState;
}

export function moveTableauToTableau(
  state: GameState,
  sourceIndex: number,
  cardIndex: number,
  targetIndex: number
): GameState | null {
  if (sourceIndex === targetIndex) {
    return null;
  }

  const sourcePile = state.tableau[sourceIndex];
  const targetPile = state.tableau[targetIndex];

  if (!sourcePile || !targetPile || cardIndex < 0 || cardIndex >= sourcePile.cards.length) {
    return null;
  }

  const movingCards = sourcePile.cards.slice(cardIndex);

  if (!canMoveCardsToTableau(movingCards, targetPile)) {
    return null;
  }

  const nextState = cloneGameState(state);
  const nextSource = nextState.tableau[sourceIndex];
  const nextTarget = nextState.tableau[targetIndex];
  const movedCards = nextSource.cards.splice(cardIndex);

  nextTarget.cards.push(...movedCards);
  revealTopTableauCard(nextSource);

  return nextState;
}

export function moveTableauToFoundation(
  state: GameState,
  tableauIndex: number,
  foundationIndex: number
): GameState | null {
  const sourcePile = state.tableau[tableauIndex];
  const targetPile = state.foundations[foundationIndex];
  const sourceCard = sourcePile?.cards[sourcePile.cards.length - 1];

  if (
    !sourcePile ||
    !targetPile ||
    !sourceCard ||
    !sourceCard.faceUp ||
    !canMoveCardToFoundation(sourceCard, targetPile, foundationIndex)
  ) {
    return null;
  }

  const nextState = cloneGameState(state);
  const nextSource = nextState.tableau[tableauIndex];
  const card = nextSource.cards.pop();

  if (!card) {
    return null;
  }

  nextState.foundations[foundationIndex].cards.push(card);
  revealTopTableauCard(nextSource);
  nextState.status = getGameStatus(nextState);

  return nextState;
}

export function moveFoundationToTableau(
  state: GameState,
  foundationIndex: number,
  tableauIndex: number
): GameState | null {
  const sourcePile = state.foundations[foundationIndex];
  const targetPile = state.tableau[tableauIndex];
  const card = sourcePile?.cards[sourcePile.cards.length - 1];

  if (!sourcePile || !targetPile || !card || !canMoveCardsToTableau([card], targetPile)) {
    return null;
  }

  const nextState = cloneGameState(state);
  const nextCard = nextState.foundations[foundationIndex].cards.pop();

  if (!nextCard) {
    return null;
  }

  nextState.tableau[tableauIndex].cards.push(nextCard);
  nextState.status = getGameStatus(nextState);
  return nextState;
}

export function tryAutoMoveToFoundation(
  state: GameState,
  selection: Selection
): GameState | null {
  if (selection.kind === "waste") {
    for (let index = 0; index < state.foundations.length; index += 1) {
      const nextState = moveWasteToFoundation(state, index);

      if (nextState) {
        return nextState;
      }
    }

    return null;
  }

  if (selection.kind === "tableau") {
    for (let index = 0; index < state.foundations.length; index += 1) {
      const nextState = moveTableauToFoundation(state, selection.pileIndex, index);

      if (nextState) {
        return nextState;
      }
    }
  }

  return null;
}

export function getGameStatus(state: GameState): GameState["status"] {
  const foundationCards = state.foundations.reduce((total, pile) => total + pile.cards.length, 0);
  return foundationCards === 52 ? "won" : "in_progress";
}

/**
 * Returns true when auto-complete is available:
 * all tableau cards are face-up (regardless of stock/waste).
 */
export function canAutoComplete(state: GameState): boolean {
  return state.tableau.every((pile) => pile.cards.every((card) => card.faceUp));
}

export type AutoCompleteSource = "tableau" | "waste";

/**
 * Performs one step of auto-complete.
 * First drains stock→waste if needed, then finds the lowest-rank card
 * that can move to foundation from either tableau or waste.
 */
export function autoCompleteStep(
  state: GameState
): { state: GameState; source: AutoCompleteSource; fromPile: number; toPile: number; target: "foundation" | "tableau" } | null {
  // First: if stock has cards, drain them all to waste so they're accessible
  let current = state;
  while (current.stock.cards.length > 0) {
    current = drawFromStock(current);
  }

  let bestRank = 14;
  let bestSource: AutoCompleteSource = "tableau";
  let bestFromPile = -1;
  let bestFi = -1;

  // Check tableau top cards
  for (let ti = 0; ti < current.tableau.length; ti++) {
    const pile = current.tableau[ti];
    const topCard = pile.cards[pile.cards.length - 1];
    if (!topCard?.faceUp) continue;
    for (let fi = 0; fi < current.foundations.length; fi++) {
      if (canMoveCardToFoundation(topCard, current.foundations[fi], fi) && topCard.rank < bestRank) {
        bestRank = topCard.rank;
        bestSource = "tableau";
        bestFromPile = ti;
        bestFi = fi;
      }
    }
  }

  // Check waste top card
  const wasteTop = current.waste.cards[current.waste.cards.length - 1];
  if (wasteTop) {
    for (let fi = 0; fi < current.foundations.length; fi++) {
      if (canMoveCardToFoundation(wasteTop, current.foundations[fi], fi) && wasteTop.rank < bestRank) {
        bestRank = wasteTop.rank;
        bestSource = "waste";
        bestFromPile = -1;
        bestFi = fi;
      }
    }
  }

  if (bestFi !== -1) {
    let nextState: GameState | null;
    if (bestSource === "tableau") {
      nextState = moveTableauToFoundation(current, bestFromPile, bestFi);
    } else {
      nextState = moveWasteToFoundation(current, bestFi);
    }
    if (nextState) {
      return { state: nextState, source: bestSource, fromPile: bestFromPile, toPile: bestFi, target: "foundation" };
    }
  }

  // Fallback: move waste top to tableau (to unbury deeper waste cards)
  const wasteTop2 = current.waste.cards[current.waste.cards.length - 1];
  if (wasteTop2) {
    for (let ti = 0; ti < current.tableau.length; ti++) {
      const moved = moveWasteToTableau(current, ti);
      if (moved) {
        return { state: moved, source: "waste", fromPile: -1, toPile: ti, target: "tableau" };
      }
    }
  }

  return null;
}

/**
 * Returns true if there are no valid moves remaining:
 *  - stock and waste are both empty
 *  - no tableau card can move to foundation
 *  - no tableau stack can move to another tableau pile
 *  - waste top (if any) cannot move anywhere
 */
export function hasAnyMoves(state: GameState): boolean {
  // Check tableau → foundation
  for (const pile of state.tableau) {
    const top = pile.cards[pile.cards.length - 1];
    if (!top?.faceUp) continue;
    for (let fi = 0; fi < state.foundations.length; fi++) {
      if (canMoveCardToFoundation(top, state.foundations[fi], fi)) return true;
    }
  }

  // Check tableau → tableau (check ALL useful sub-sequences)
  for (let si = 0; si < state.tableau.length; si++) {
    const sourcePile = state.tableau[si];
    const firstFaceUpIdx = sourcePile.cards.findIndex((c) => c.faceUp);
    if (firstFaceUpIdx === -1) continue;

    // Check every sub-sequence starting from any face-up card
    for (let startIdx = firstFaceUpIdx; startIdx < sourcePile.cards.length; startIdx++) {
      const movingCards = sourcePile.cards.slice(startIdx);
      
      // A move is useful if it reveals a face-down card OR if the sub-sequence itself is valid
      // (Actually, for detecting "any moves", we just need to find ONE valid destination)
      // Optimization: only check moving the full open stack if we want to reveal,
      // but strictly speaking, moving a sub-part (like just the King) is also a move.
      // Let's check if this sub-sequence can move anywhere.
      
      // 1. Can it move to another tableau?
      for (let ti = 0; ti < state.tableau.length; ti++) {
        if (si === ti) continue;
        if (canMoveCardsToTableau(movingCards, state.tableau[ti])) return true;
      }

      // 2. Can the BOTTOM card of this sub-sequence move to foundation?
      // We can only move a card to foundation if it's the bottom-most open card.
      if (startIdx === sourcePile.cards.length - 1) {
         const card = movingCards[0]; // Only one card in this slice
         for (let fi = 0; fi < state.foundations.length; fi++) {
           if (canMoveCardToFoundation(card, state.foundations[fi], fi)) return true;
         }
      }
    }
  }

  // Stock is never empty if there are cards to draw (clicking stock is a move).
  if (state.stock.cards.length > 0) return true;

  // Check ALL cards in waste (if stock is empty, we might recycle).
  // If none can be played anywhere, cycling the draw pile won't help — game is stuck.
  for (const card of state.waste.cards) {
    const faceUpCard = { ...card, faceUp: true };
    // Can it go to foundation?
    for (let fi = 0; fi < state.foundations.length; fi++) {
      if (canMoveCardToFoundation(faceUpCard, state.foundations[fi], fi)) return true;
    }
    // Can it go to tableau?
    for (const pile of state.tableau) {
      if (canMoveCardsToTableau([faceUpCard], pile)) return true;
    }
  }

  return false;
}

export function getHint(state: GameState): string | null {
  const wasteTop = state.waste.cards[state.waste.cards.length - 1];

  if (wasteTop) {
    for (let index = 0; index < state.foundations.length; index += 1) {
      if (canMoveCardToFoundation(wasteTop, state.foundations[index], index)) {
        return "Move waste to foundation";
      }
    }

    for (let index = 0; index < state.tableau.length; index += 1) {
      if (canMoveCardsToTableau([wasteTop], state.tableau[index])) {
        return "Move waste to tableau";
      }
    }
  }

  for (let sourceIndex = 0; sourceIndex < state.tableau.length; sourceIndex += 1) {
    const pile = state.tableau[sourceIndex];

    for (let cardIndex = 0; cardIndex < pile.cards.length; cardIndex += 1) {
      const movingCards = pile.cards.slice(cardIndex);

      if (!movingCards[0]?.faceUp || !isDescendingAlternating(movingCards)) {
        continue;
      }

      for (let targetIndex = 0; targetIndex < state.tableau.length; targetIndex += 1) {
        if (sourceIndex !== targetIndex && canMoveCardsToTableau(movingCards, state.tableau[targetIndex])) {
          return "Move tableau stack";
        }
      }
    }
  }

  if (state.stock.cards.length > 0 || state.waste.cards.length > 0) {
    return "Draw from stock";
  }

  return null;
}
