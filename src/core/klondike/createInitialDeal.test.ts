import { describe, expect, it } from "vitest";
import { createInitialDeal } from "@/core/klondike/createInitialDeal";

describe("createInitialDeal", () => {
  it("produces different layouts for adventure restarts (no seed override)", () => {
    // Simulate restarting the same adventure node multiple times without
    // passing a seed — each attempt should get a fresh random layout.
    const deal1 = createInitialDeal("adventure", "c1n1");
    const deal2 = createInitialDeal("adventure", "c1n1");
    const deal3 = createInitialDeal("adventure", "c1n1");

    // Extract the first 7 card IDs from tableau as a layout fingerprint
    const fingerprint = (deal: ReturnType<typeof createInitialDeal>) =>
      deal.tableau.map((pile) => pile.cards.map((c) => c.id).join(",")).join("|");

    const layouts = new Set([fingerprint(deal1), fingerprint(deal2), fingerprint(deal3)]);

    // With random seeds, at least 2 of 3 should differ (astronomically
    // unlikely to collide 3 times in a row with ~100K seed space)
    expect(layouts.size).toBeGreaterThanOrEqual(2);
  });

  it("produces the same layout when seed is explicitly provided", () => {
    const deal1 = createInitialDeal("adventure", "c1n1", 42);
    const deal2 = createInitialDeal("adventure", "c1n1", 42);

    const fingerprint = (deal: ReturnType<typeof createInitialDeal>) =>
      deal.tableau.map((pile) => pile.cards.map((c) => c.id).join(",")).join("|");

    expect(fingerprint(deal1)).toBe(fingerprint(deal2));
  });

  it("daily mode uses deterministic date-based seed", () => {
    const deal1 = createInitialDeal("daily", "daily-2026-04-10");
    const deal2 = createInitialDeal("daily", "daily-2026-04-10");

    const fingerprint = (deal: ReturnType<typeof createInitialDeal>) =>
      deal.tableau.map((pile) => pile.cards.map((c) => c.id).join(",")).join("|");

    // Same date = same seed = same layout
    expect(fingerprint(deal1)).toBe(fingerprint(deal2));
  });
});
