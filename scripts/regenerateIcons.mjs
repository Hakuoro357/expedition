#!/usr/bin/env node
/**
 * Regenerate game icons from a master image (dist/compass-master.png).
 *
 * Square targets: simple resize (cover).
 * Non-square targets (GP store letterbox sizes): the master is resized
 * to the shorter side, then composited centered on a solid dark-teal
 * canvas — matches the in-game RewardScene background tint so it stitches
 * cleanly with the rest of the publication artifacts.
 *
 * Usage:
 *   node scripts/regenerateIcons.mjs
 */
import sharp from "sharp";
import { existsSync } from "node:fs";

const MASTER = "dist/compass-master.png";
if (!existsSync(MASTER)) {
  console.error(`Missing master at ${MASTER}`);
  process.exit(1);
}

// Dark teal background that matches in-game palette (see settingsSceneOverlay
// / RewardScene tint). Solid is fine — radial gradient в самой картинке
// уже даёт глубину.
const TEAL_BG = { r: 0x1a, g: 0x3a, b: 0x36, alpha: 1 };

async function squareResize(target, size) {
  await sharp(MASTER)
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(target);
  console.log(`  ✓ ${target.padEnd(48)} ${size}×${size}`);
}

async function letterboxResize(target, width, height) {
  const square = Math.min(width, height);
  const resized = await sharp(MASTER)
    .resize(square, square, { fit: "cover" })
    .toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: TEAL_BG },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(target);
  console.log(`  ✓ ${target.padEnd(48)} ${width}×${height}`);
}

console.log("Regenerating icons from", MASTER);
await squareResize("public/assets/icon-loading.png", 256);
await squareResize("promo/gamepush/icon-1024x1024.png", 1024);
await squareResize("promo/icon-512.png", 512);
await squareResize("public/favicon-32.png", 32);
await squareResize("public/favicon-192.png", 192);
await letterboxResize("promo/gamepush/icon-512x384.png", 512, 384);
await letterboxResize("promo/gamepush/icon-800x1200.png", 800, 1200);
console.log("Done.");
