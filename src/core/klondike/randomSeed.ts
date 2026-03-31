import { greedySolve } from "@/core/klondike/dealSolver";

/**
 * Generates a random seed verified as solvable by the greedy solver.
 * Tries up to 200 candidates; falls back to a known-good seed (20) if none found.
 * Runs synchronously — solver is fast (~1ms per seed).
 */
export function findRandomSolvableSeed(): number {
  const base = Date.now();
  for (let attempt = 0; attempt < 200; attempt++) {
    // Derive candidates using a simple hash of base + attempt
    const candidate = ((base * 2654435761 + attempt * 40503) >>> 0) % 100000;
    if (greedySolve(candidate).solved) {
      return candidate;
    }
  }
  return 20; // fallback: known easy seed
}
