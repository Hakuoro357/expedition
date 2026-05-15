#!/usr/bin/env node
/**
 * Slices a 5×4 visible-state achievement icon sheet (1254×1043).
 *
 * Different from sliceAchievementSheet.mjs (which handled the 5×5 sheet
 * with a bottom locked row) — this one is 5 cols × 4 rows of regular
 * icons only. Use this for re-cropping the visible (non-locked) set
 * without touching the existing `*_locked.png` files.
 *
 * Order matches the master prompt:
 *   Row 1: first_win, chapter_1_complete, chapter_2_complete,
 *          chapter_3_complete, first_artifact
 *   Row 2: first_entry, all_artifacts, no_undo_win, no_hint_win,
 *          entries_voronov
 *   Row 3: entries_levin, entries_mirskaya, entries_klimova,
 *          entries_rudenko, coins_500
 *   Row 4: coins_1000, coins_2000, first_share, first_community_join,
 *          epilogue
 *
 * Applies a slight brightness boost (~15%) to compensate for the
 * AI-generator's tendency to render dark teal backgrounds too muted
 * in the resized output.
 *
 * Usage:
 *   node scripts/sliceAchievementSheetVis.mjs [path/to/sheet.png]
 *   (default: dist/achievement-sheet-vis.png)
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const SHEET = process.argv[2] ?? "dist/achievement-sheet-vis.png";
const OUT_DIR = "dist/achievement-icons";

if (!existsSync(SHEET)) {
  console.error(`Missing sheet at ${SHEET}`);
  process.exit(1);
}

const ROWS = [
  ["first_win", "chapter_1_complete", "chapter_2_complete", "chapter_3_complete", "first_artifact"],
  ["first_entry", "all_artifacts", "no_undo_win", "no_hint_win", "entries_voronov"],
  ["entries_levin", "entries_mirskaya", "entries_klimova", "entries_rudenko", "coins_500"],
  ["coins_1000", "coins_2000", "first_share", "first_community_join", "epilogue"],
];

mkdirSync(OUT_DIR, { recursive: true });

const meta = await sharp(SHEET).metadata();
console.log(`Sheet ${meta.width}×${meta.height}`);

// Reference layout: observed for 1254×1043 sheet. Each row's icon content
// extends slightly DOWN past the math midpoint (portraits in row 3 are
// the worst offender), so subsequent rows start below where height/4
// would suggest. Y coords scale proportionally for differently-sized sheets.
const REFERENCE_WIDTH = 1254;
const REFERENCE_HEIGHT = 1043;
const SCALE_X = meta.width / REFERENCE_WIDTH;
const SCALE_Y = meta.height / REFERENCE_HEIGHT;

const ROW_Y = [
  [8, 240], // Row 1: medal/maps/journal/box (no row above, clean)
  [280, 225], // Row 2: page/shelf/arrow/compass/voronov (clear row 1 box bleed)
  [540, 240], // Row 3: 4 portraits + coins_500 (clear row 2 page bleed)
  [820, 215], // Row 4: pouches/letter/fire/journal (clear row 3 portrait bleed)
].map(([y, h]) => [Math.round(y * SCALE_Y), Math.round(h * SCALE_Y)]);

const COLS_X = [
  [10, 240],
  [256, 240],
  [502, 240],
  [748, 240],
  [994, 250],
].map(([x, w]) => [Math.round(x * SCALE_X), Math.round(w * SCALE_X)]);

// Brightness boost: modulate({brightness: 1.15}) lifts midtones ~15%
// without crushing highlights. Compensates for the dark teal background
// looking too muddy after resize.
const BRIGHTNESS = 1.15;

async function cropCell(tag, left, top, w, h) {
  const out = path.join(OUT_DIR, `${tag}.png`);
  await sharp(SHEET)
    .extract({ left, top, width: w, height: h })
    .modulate({ brightness: BRIGHTNESS })
    .resize(256, 256, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${out.padEnd(48)} @ (${left},${top}) ${w}×${h}`);
}

for (let r = 0; r < ROWS.length; r++) {
  const [rowY, rowH] = ROW_Y[r];
  for (let c = 0; c < ROWS[r].length; c++) {
    const [colX, colW] = COLS_X[c];
    await cropCell(ROWS[r][c], colX, rowY, colW, rowH);
  }
}

console.log(`\nDone. 20 visible icons written to ${OUT_DIR}/`);
console.log(`Locked silhouettes (*_locked.png) untouched — still from previous sheet.`);
