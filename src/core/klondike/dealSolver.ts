/**
 * Lightweight greedy solver for Klondike (draw-1).
 *
 * Strategy (applied in priority order each step):
 *  1. Move any card to foundation if valid
 *  2. Move tableau card that reveals a face-down card (prefer)
 *  3. Move waste top card to tableau if valid
 *  4. Draw from stock
 *  5. If stock is exhausted and waste is empty → stuck
 *
 * Not a complete solver — it won't find all solvable deals.
 * But deals it CAN solve are comfortably playable for casual players.
 */

import { createInitialDeal } from "@/core/klondike/createInitialDeal";
import {
  drawFromStock,
  moveTableauToFoundation,
  moveWasteToFoundation,
  moveWasteToTableau,
  moveTableauToTableau,
  canMoveCardToFoundation,
  canMoveCardsToTableau,
} from "@/core/klondike/engine";
import type { GameState } from "@/core/game-state/types";

const MAX_STEPS = 2000;

export type Difficulty = "easy" | "medium" | "hard";

export type SolveResult = {
  solved: boolean;
  steps: number;
  difficulty: Difficulty;
};

function getDifficulty(steps: number): Difficulty {
  if (steps < 116) return "easy";
  if (steps < 123) return "medium";
  return "hard";
}

function tryFoundationMoves(state: GameState): GameState | null {
  // Waste → foundation
  const wasteTop = state.waste.cards[state.waste.cards.length - 1];
  if (wasteTop) {
    for (let fi = 0; fi < state.foundations.length; fi++) {
      if (canMoveCardToFoundation(wasteTop, state.foundations[fi], fi)) {
        return moveWasteToFoundation(state, fi);
      }
    }
  }

  // Tableau → foundation
  for (let ti = 0; ti < state.tableau.length; ti++) {
    const pile = state.tableau[ti];
    const topCard = pile.cards[pile.cards.length - 1];
    if (!topCard?.faceUp) continue;
    for (let fi = 0; fi < state.foundations.length; fi++) {
      const next = moveTableauToFoundation(state, ti, fi);
      if (next) return next;
    }
  }

  return null;
}

function tryRevealMoves(state: GameState): GameState | null {
  // Prefer moves that uncover a face-down card
  for (let si = 0; si < state.tableau.length; si++) {
    const sourcePile = state.tableau[si];
    if (sourcePile.cards.length === 0) continue;

    // Only consider moving the top face-up card (or stack starting from first face-up)
    const firstFaceUpIdx = sourcePile.cards.findIndex((c) => c.faceUp);
    if (firstFaceUpIdx <= 0) continue; // nothing beneath, or pile has face-down cards only at start

    // Moving from firstFaceUpIdx would reveal a face-down card
    const movingCards = sourcePile.cards.slice(firstFaceUpIdx);
    for (let ti = 0; ti < state.tableau.length; ti++) {
      if (si === ti) continue;
      if (canMoveCardsToTableau(movingCards, state.tableau[ti])) {
        const next = moveTableauToTableau(state, si, firstFaceUpIdx, ti);
        if (next) return next;
      }
    }
  }
  return null;
}

function tryWasteToTableau(state: GameState): GameState | null {
  const wasteTop = state.waste.cards[state.waste.cards.length - 1];
  if (!wasteTop) return null;
  for (let ti = 0; ti < state.tableau.length; ti++) {
    const next = moveWasteToTableau(state, ti);
    if (next) return next;
  }
  return null;
}

function isWon(state: GameState): boolean {
  return state.foundations.reduce((sum, p) => sum + p.cards.length, 0) === 52;
}

/**
 * Solve a deal and return the result with difficulty rating.
 * Steps < 80 = easy, 80-199 = medium, 200+ = hard
 */
export function greedySolve(seed: number): SolveResult {
  let state = createInitialDeal("adventure", `solver-${seed}`, seed);
  let stockCycles = 0;
  let prevStockSize = -1;

  for (let step = 0; step < MAX_STEPS; step++) {
    if (isWon(state)) {
      return { solved: true, steps: step, difficulty: getDifficulty(step) };
    }

    // 1. Foundation moves always first
    const foundationMove = tryFoundationMoves(state);
    if (foundationMove) {
      state = foundationMove;
      continue;
    }

    // 2. Reveal face-down cards
    const revealMove = tryRevealMoves(state);
    if (revealMove) {
      state = revealMove;
      continue;
    }

    // 3. Waste to tableau
    const wasteMove = tryWasteToTableau(state);
    if (wasteMove) {
      state = wasteMove;
      continue;
    }

    // 4. Draw from stock
    const hasStock = state.stock.cards.length > 0 || state.waste.cards.length > 0;
    if (!hasStock) break; // totally stuck

    const currentStockSize = state.stock.cards.length;
    if (currentStockSize === 0) {
      // About to cycle waste → stock
      stockCycles++;
      if (stockCycles > 5) break; // cycling without progress → stuck
    }

    if (currentStockSize === prevStockSize && state.waste.cards.length === 0) {
      break; // made no progress
    }

    prevStockSize = currentStockSize;
    state = drawFromStock(state);
  }

  const won = isWon(state);
  const steps = MAX_STEPS;
  return { solved: won, steps, difficulty: getDifficulty(steps) };
}

/**
 * Checks a range of seeds and returns those that pass the greedy solver.
 * Optionally filter by difficulty tier.
 */
export function findSolvableSeeds(
  start: number,
  count: number,
  needed: number,
  difficulty?: Difficulty
): number[] {
  const result: number[] = [];
  let seed = start;

  while (result.length < needed && seed < start + count) {
    const solve = greedySolve(seed);
    if (solve.solved && (!difficulty || solve.difficulty === difficulty)) {
      result.push(seed);
    }
    seed++;
  }

  return result;
}
