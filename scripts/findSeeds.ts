/**
 * Scan seeds and categorize by difficulty.
 * Run: npx tsx scripts/findSeeds.ts
 */
import { greedySolve } from "../src/core/klondike/dealSolver";

// First: discover the actual step distribution
const stepCounts: number[] = [];
const MAX_SCAN = 5000;

for (let seed = 1; seed <= MAX_SCAN; seed++) {
  const result = greedySolve(seed);
  if (result.solved) {
    stepCounts.push(result.steps);
  }
}

stepCounts.sort((a, b) => a - b);
const total = stepCounts.length;
console.log(`Solvable: ${total} / ${MAX_SCAN} (${(100 * total / MAX_SCAN).toFixed(1)}%)`);
console.log(`Min steps: ${stepCounts[0]}, Max steps: ${stepCounts[total - 1]}`);
console.log(`Median: ${stepCounts[Math.floor(total / 2)]}`);
console.log(`25th pct: ${stepCounts[Math.floor(total * 0.25)]}`);
console.log(`75th pct: ${stepCounts[Math.floor(total * 0.75)]}`);

// Histogram
const buckets = [0, 90, 110, 130, 150, 170, 200, 300, 2001];
for (let i = 0; i < buckets.length - 1; i++) {
  const count = stepCounts.filter((s) => s >= buckets[i] && s < buckets[i + 1]).length;
  console.log(`  ${buckets[i]}-${buckets[i + 1] - 1}: ${count}`);
}

// Now find seeds by tier using data-driven thresholds:
// Easy: bottom 33%, Medium: middle 33%, Hard: top 33%
const easyMax = stepCounts[Math.floor(total * 0.33)];
const hardMin = stepCounts[Math.floor(total * 0.67)];
console.log(`\nDerived thresholds: easy < ${easyMax}, medium ${easyMax}-${hardMin - 1}, hard >= ${hardMin}`);

// Find 15 seeds per category
const easy: number[] = [];
const medium: number[] = [];
const hard: number[] = [];

for (let seed = 1; seed <= MAX_SCAN; seed++) {
  const result = greedySolve(seed);
  if (!result.solved) continue;
  if (result.steps < easyMax && easy.length < 15) easy.push(seed);
  else if (result.steps >= easyMax && result.steps < hardMin && medium.length < 15) medium.push(seed);
  else if (result.steps >= hardMin && hard.length < 15) hard.push(seed);
  if (easy.length >= 15 && medium.length >= 15 && hard.length >= 15) break;
}

console.log(`\n=== EASY (steps < ${easyMax}) ===`);
console.log(`  [${easy.join(", ")}]`);
console.log(`\n=== MEDIUM (steps ${easyMax}-${hardMin - 1}) ===`);
console.log(`  [${medium.join(", ")}]`);
console.log(`\n=== HARD (steps >= ${hardMin}) ===`);
console.log(`  [${hard.join(", ")}]`);
