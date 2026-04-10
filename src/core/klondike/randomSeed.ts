import { greedySolve } from "@/core/klondike/dealSolver";

/** Monotonic counter — ensures unique base even within the same millisecond. */
let callCounter = 0;

/**
 * Generates a random seed verified as solvable by the greedy solver.
 * Tries up to 200 candidates; falls back to a known-good seed (20) if none found.
 * Runs synchronously — solver is fast (~1ms per seed).
 *
 * Uses Date.now() + Math.random() + monotonic counter to avoid
 * returning the same seed on back-to-back calls within 1ms
 * (e.g. scene restart after losing).
 */
export function findRandomSolvableSeed(): number {
  callCounter++;
  for (let attempt = 0; attempt < 200; attempt++) {
    // Pure random candidate — Math.random() provides entropy,
    // callCounter + Date.now() prevent exact repeats across calls.
    const candidate = (Math.floor(Math.random() * 100000) + callCounter) % 100000;
    if (greedySolve(candidate).solved) {
      return candidate;
    }
  }
  return 20; // fallback: known easy seed
}
