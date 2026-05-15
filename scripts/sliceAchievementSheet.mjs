#!/usr/bin/env node
/**
 * Slices ChatGPT-generated 5×5 achievement icon sheet using explicit
 * row/col coordinates rather than computed division. The AI generator
 * uses non-uniform gutters between cells that don't align to a clean
 * height/N math split, so explicit boundaries work better than insets.
 *
 * Sheet layout (1254×1254 input):
 *   Rows 1-4: 5 columns × 4 rows of regular icons
 *   Row 5:    4 columns × 1 row of locked-state silhouettes
 *
 * Order (matches the master prompt):
 *   Row 1: first_win, chapter_1_complete, chapter_2_complete,
 *          chapter_3_complete, first_artifact
 *   Row 2: first_entry, all_artifacts, no_undo_win, no_hint_win,
 *          entries_voronov
 *   Row 3: entries_levin, entries_mirskaya, entries_klimova,
 *          entries_rudenko, coins_500
 *   Row 4: coins_1000, coins_2000, first_share, first_community_join,
 *          epilogue
 *   Row 5: all_artifacts_locked, no_undo_win_locked, no_hint_win_locked,
 *          epilogue_locked
 *
 * Usage:
 *   node scripts/sliceAchievementSheet.mjs [path/to/sheet.png]
 *   (default: dist/achievement-sheet.png)
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const SHEET = process.argv[2] ?? "dist/achievement-sheet.png";
const OUT_DIR = "dist/achievement-icons";

if (!existsSync(SHEET)) {
  console.error(`Missing sheet at ${SHEET}`);
  process.exit(1);
}

const TOP_ROWS = [
  ["first_win", "chapter_1_complete", "chapter_2_complete", "chapter_3_complete", "first_artifact"],
  ["first_entry", "all_artifacts", "no_undo_win", "no_hint_win", "entries_voronov"],
  ["entries_levin", "entries_mirskaya", "entries_klimova", "entries_rudenko", "coins_500"],
  ["coins_1000", "coins_2000", "first_share", "first_community_join", "epilogue"],
];

const BOTTOM_ROW = [
  "all_artifacts_locked",
  "no_undo_win_locked",
  "no_hint_win_locked",
  "epilogue_locked",
];

mkdirSync(OUT_DIR, { recursive: true });

const meta = await sharp(SHEET).metadata();
console.log(`Sheet ${meta.width}×${meta.height}`);

// Observed coordinates for the 1254×1254 ChatGPT-generated sheet. Each
// row has ~230px tall content with ~15-20px gutters between rows. Cells
// in the top 4 rows are square-ish; the bottom row uses 4 wider cells.
//
// If a different sheet size comes in, we scale these proportionally —
// the script auto-adjusts via the SCALE factor below.
const REFERENCE_WIDTH = 1254;
const SCALE = meta.width / REFERENCE_WIDTH;

// Row Y-coordinates: [start, height] for each of the 5 rows.
// Observed empirically — each row's icons extend further DOWN than the
// math midpoint would suggest (especially portraits), so subsequent row
// starts must be pushed below the bleed zone.
const ROW_Y = [
  [10, 250], // Row 1: medal/maps/journal/box
  [290, 230], // Row 2: page/shelf/arrow/compass/voronov
  [555, 245], // Row 3: 4 portraits + coins_500
  [815, 195], // Row 4: pouches/letter/fire/journal
  [1035, 215], // Row 5: locked silhouettes
].map(([y, h]) => [Math.round(y * SCALE), Math.round(h * SCALE)]);

// Column X-coordinates for top 4 rows (5 cells).
const TOP_COLS_X = [
  [10, 248],
  [258, 248],
  [506, 248],
  [754, 248],
  [1002, 244],
].map(([x, w]) => [Math.round(x * SCALE), Math.round(w * SCALE)]);

// Column X-coordinates for bottom row (4 cells). AI laid out icons in
// the LEFT portion of each ~313px cell with a brass padlock in the
// bottom-right corner. We capture the full icon+padlock span (~310px)
// — the result has the icon shifted slightly left of center with the
// padlock near the right edge, which reads naturally as "locked".
const BOT_COLS_X = [
  [10, 310],
  [320, 310],
  [625, 310],
  [935, 310],
].map(([x, w]) => [Math.round(x * SCALE), Math.round(w * SCALE)]);

async function cropCell(tag, left, top, w, h) {
  const out = path.join(OUT_DIR, `${tag}.png`);
  await sharp(SHEET)
    .extract({ left, top, width: w, height: h })
    .resize(256, 256, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${out.padEnd(48)} @ (${left},${top}) ${w}×${h}`);
}

for (let r = 0; r < TOP_ROWS.length; r++) {
  const [rowY, rowH] = ROW_Y[r];
  for (let c = 0; c < TOP_ROWS[r].length; c++) {
    const [colX, colW] = TOP_COLS_X[c];
    await cropCell(TOP_ROWS[r][c], colX, rowY, colW, rowH);
  }
}

const [bottomY, bottomH] = ROW_Y[4];
for (let c = 0; c < BOTTOM_ROW.length; c++) {
  const [colX, colW] = BOT_COLS_X[c];
  await cropCell(BOTTOM_ROW[c], colX, bottomY, colW, bottomH);
}

const total = TOP_ROWS.flat().length + BOTTOM_ROW.length;
console.log(`\nDone. ${total} icons written to ${OUT_DIR}/`);
