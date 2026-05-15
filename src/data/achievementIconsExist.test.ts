import { describe, expect, it } from "vitest";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { ACHIEVEMENTS } from "@/data/achievements";
import { ACHIEVEMENT_UI_META } from "@/data/achievementUiMeta";

/**
 * Filesystem regression test (v0.3.58 plan R3 codex-M6):
 * every achievement icon file referenced by UI must physically exist
 * in `public/assets/achievements/`. Without this, a tag typo or a
 * missed icon copy ships a broken `<img>` to production.
 *
 * Tag is the single source of truth (R4 codex-M3): filename = `<tag>.png`.
 * Hidden+locked achievements use shared `locked-generic.png` instead of
 * per-tag locked variants.
 */
const ICONS_DIR = path.join(process.cwd(), "public", "assets", "achievements");

describe("achievement icons on disk", () => {
  it("locked-generic.png exists (shared hidden-mask icon)", () => {
    const file = path.join(ICONS_DIR, "locked-generic.png");
    expect(existsSync(file)).toBe(true);
    const stat = statSync(file);
    expect(stat.size).toBeGreaterThan(0);
  });

  it("every achievement tag has a corresponding <tag>.png file", () => {
    const missing: string[] = [];
    for (const meta of ACHIEVEMENTS) {
      const file = path.join(ICONS_DIR, `${meta.tag}.png`);
      if (!existsSync(file)) missing.push(`${meta.tag}.png`);
    }
    expect(missing).toEqual([]);
  });

  it("every ACHIEVEMENT_UI_META tag has a non-empty PNG file", () => {
    for (const ui of ACHIEVEMENT_UI_META) {
      const file = path.join(ICONS_DIR, `${ui.tag}.png`);
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeGreaterThan(0);
    }
  });
});
