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
 * Returns true if there is at least one "productive" move — one that
 * actually advances the game.  Non-productive moves (e.g. shuffling a
 * king between two empty columns, cycling stock with no playable cards)
 * do NOT count.
 *
 * Productive moves:
 *  1. Tableau top → Foundation  (always)
 *  2. Waste top  → Foundation / Tableau  (always)
 *  3. Tableau → Tableau  — ONLY if moving the full face-up run starting
 *     at firstFaceUpIdx AND there is at least one face-down card beneath
 *     (i.e. the move reveals a hidden card)
 *  4. Stock draw — only if ANY card currently in stock+waste could be
 *     played to foundation or tableau.  If none can, cycling is useless.
 */
export function hasProductiveMoves(state: GameState): boolean {
  // 1. Tableau top → Foundation
  for (const pile of state.tableau) {
    const top = pile.cards[pile.cards.length - 1];
    if (!top?.faceUp) continue;
    for (let fi = 0; fi < state.foundations.length; fi++) {
      if (canMoveCardToFoundation(top, state.foundations[fi], fi)) return true;
    }
  }

  // 2. Waste top → Foundation / Tableau
  const wasteTop = state.waste.cards[state.waste.cards.length - 1];
  if (wasteTop) {
    for (let fi = 0; fi < state.foundations.length; fi++) {
      if (canMoveCardToFoundation(wasteTop, state.foundations[fi], fi)) return true;
    }
    for (const pile of state.tableau) {
      if (canMoveCardsToTableau([wasteTop], pile)) return true;
    }
  }

  // 3. Tableau → Tableau (only if it reveals a face-down card)
  for (let si = 0; si < state.tableau.length; si++) {
    const sourcePile = state.tableau[si];
    const firstFaceUpIdx = sourcePile.cards.findIndex((c) => c.faceUp);
    if (firstFaceUpIdx === -1) continue;

    // Only moving the full face-up run is productive (reveals a hidden card)
    if (firstFaceUpIdx === 0) continue; // no face-down cards beneath — no reveal

    const movingCards = sourcePile.cards.slice(firstFaceUpIdx);
    for (let ti = 0; ti < state.tableau.length; ti++) {
      if (si === ti) continue;
      if (canMoveCardsToTableau(movingCards, state.tableau[ti])) return true;
    }
  }

  // 4. Stock draw — check if ANY card in stock+waste is playable
  if (state.stock.cards.length > 0) {
    const allDrawCards = [...state.stock.cards, ...state.waste.cards];
    for (const card of allDrawCards) {
      const faceUpCard = { ...card, faceUp: true };
      for (let fi = 0; fi < state.foundations.length; fi++) {
        if (canMoveCardToFoundation(faceUpCard, state.foundations[fi], fi)) return true;
      }
      for (const pile of state.tableau) {
        if (canMoveCardsToTableau([faceUpCard], pile)) return true;
      }
    }
  }

  return false;
}

export type HintZone = "stock" | "waste" | "tableau" | "foundation";

export type HintResult = {
  from: { zone: HintZone; pileIndex: number; cardIndex: number };
  to: { zone: HintZone; pileIndex: number };
};

export function getHint(state: GameState): HintResult | null {
  const wasteTop = state.waste.cards[state.waste.cards.length - 1];

  // Waste → Foundation (highest priority)
  if (wasteTop) {
    for (let fi = 0; fi < state.foundations.length; fi++) {
      if (canMoveCardToFoundation(wasteTop, state.foundations[fi], fi)) {
        return {
          from: { zone: "waste", pileIndex: 0, cardIndex: state.waste.cards.length - 1 },
          to: { zone: "foundation", pileIndex: fi },
        };
      }
    }
  }

  // Tableau top → Foundation
  for (let ti = 0; ti < state.tableau.length; ti++) {
    const pile = state.tableau[ti];
    const top = pile.cards[pile.cards.length - 1];
    if (!top?.faceUp) continue;
    for (let fi = 0; fi < state.foundations.length; fi++) {
      if (canMoveCardToFoundation(top, state.foundations[fi], fi)) {
        return {
          from: { zone: "tableau", pileIndex: ti, cardIndex: pile.cards.length - 1 },
          to: { zone: "foundation", pileIndex: fi },
        };
      }
    }
  }

  // Waste → Tableau
  if (wasteTop) {
    for (let ti = 0; ti < state.tableau.length; ti++) {
      if (canMoveCardsToTableau([wasteTop], state.tableau[ti])) {
        return {
          from: { zone: "waste", pileIndex: 0, cardIndex: state.waste.cards.length - 1 },
          to: { zone: "tableau", pileIndex: ti },
        };
      }
    }
  }

  // Tableau → Tableau (prioritize moves that reveal face-down cards)
  for (let si = 0; si < state.tableau.length; si++) {
    const pile = state.tableau[si];
    const firstFaceUpIdx = pile.cards.findIndex((c) => c.faceUp);
    if (firstFaceUpIdx === -1) continue;

    for (let startIdx = firstFaceUpIdx; startIdx < pile.cards.length; startIdx++) {
      const movingCards = pile.cards.slice(startIdx);
      if (!isDescendingAlternating(movingCards)) continue;

      for (let ti = 0; ti < state.tableau.length; ti++) {
        if (si === ti) continue;
        if (canMoveCardsToTableau(movingCards, state.tableau[ti])) {
          return {
            from: { zone: "tableau", pileIndex: si, cardIndex: startIdx },
            to: { zone: "tableau", pileIndex: ti },
          };
        }
      }
    }
  }

  // Draw from stock
  if (state.stock.cards.length > 0) {
    return {
      from: { zone: "stock", pileIndex: 0, cardIndex: 0 },
      to: { zone: "waste", pileIndex: 0 },
    };
  }

  return null;
}
