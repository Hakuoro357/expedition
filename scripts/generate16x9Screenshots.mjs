// Build 16:9 (1920x1080) desktop screenshots from the existing 9:16 portraits.
//
// Composition: the portrait shot is centered at full 1080 height (608x1080).
// Behind it is a blurred, darkened, zoomed copy of the same shot that fills
// the 1920x1080 canvas — the Netflix/Spotify "ambient background" technique.
// Result looks significantly more professional than flat-color padding for
// desktop promo screenshots of a portrait-first game.
//
// Yandex Games publishing form requires separate screenshots for desktop
// (landscape 16:9) and mobile (portrait 9:16) platforms. The game itself is
// portrait-first, so rather than rendering the canvas in a stretched desktop
// viewport (which letterboxes badly), we frame the portrait shot on a clean
// dark canvas — matches the way most Yandex card/puzzle games present their
// desktop promo material.
//
// Input:  promo/9x16_screenshot-{1..5}[-suffix].png  (1080x1920)
// Output: promo/16x9_screenshot-{1..5}[-suffix].png  (1920x1080)
//
// Usage:
//   node scripts/generate16x9Screenshots.mjs

import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const promoDir = path.resolve(here, "..", "promo");

const OUTPUT_WIDTH = 1920;
const OUTPUT_HEIGHT = 1080;

// Foreground portrait height (full canvas height)
const FG_HEIGHT = 1080;

// Blur radius and darken overlay for the ambient background
const BG_BLUR_SIGMA = 40;
const BG_DARKEN = 0.55; // 0 = black, 1 = original brightness

const SLUGS = ["1-prologue", "2-map", "3-game", "4-reward", "5-diary"];
const LOCALES = [
  { suffix: "",    label: "ru" },
  { suffix: "-en", label: "en" },
];

for (const locale of LOCALES) {
  for (const slug of SLUGS) {
    const input = path.join(promoDir, `9x16_screenshot-${slug}${locale.suffix}.png`);
    const output = path.join(promoDir, `16x9_screenshot-${slug}${locale.suffix}.png`);

    if (!existsSync(input)) {
      console.warn(`  SKIP ${slug} (${locale.label}): source missing ${path.basename(input)}`);
      continue;
    }

    // Foreground: portrait scaled to full 1080 height (~608x1080)
    const foreground = await sharp(input)
      .resize({ height: FG_HEIGHT, fit: "contain" })
      .toBuffer();
    const fgMeta = await sharp(foreground).metadata();
    const fgWidth = fgMeta.width ?? FG_HEIGHT;
    const fgLeft = Math.round((OUTPUT_WIDTH - fgWidth) / 2);

    // Background: same portrait zoomed to COVER 1920x1080, then blurred and
    // darkened. "cover" crops the portrait vertically since we need width.
    // Without "cover" we'd get letterbox; with cover we fill the frame.
    const background = await sharp(input)
      .resize({
        width: OUTPUT_WIDTH,
        height: OUTPUT_HEIGHT,
        fit: "cover",
        position: "center",
      })
      .blur(BG_BLUR_SIGMA)
      // Darken by multiplying RGB against a black rectangle with alpha
      .composite([
        {
          input: {
            create: {
              width: OUTPUT_WIDTH,
              height: OUTPUT_HEIGHT,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 1 - BG_DARKEN },
            },
          },
          blend: "over",
        },
      ])
      .toBuffer();

    await sharp(background)
      .composite([{ input: foreground, left: fgLeft, top: 0 }])
      .png()
      .toFile(output);

    console.log(`  ${path.basename(output)}`);
  }
}

console.log("done");
