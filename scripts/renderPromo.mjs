// Renders promo SVGs to PNGs at the sizes Yandex Games requires.
// Reads SVGs from promo/, writes PNGs alongside.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const promoDir = path.resolve(here, "..", "promo");

const TARGETS = [
  { src: "icon-source.svg",        out: "icon-512.png",                width: 512, height: 512 },
  { src: "cover-source.svg",       out: "cover-800x470-gradient.png",  width: 800, height: 470 },
  { src: "cover-source-solid.svg", out: "cover-800x470-solid.png",     width: 800, height: 470 },
  { src: "cover-source-gold.svg",  out: "cover-800x470-gold.png",      width: 800, height: 470 },
  { src: "cover-source-route.svg", out: "cover-800x470-route.png",     width: 800, height: 470 },
];

for (const { src, out, width, height } of TARGETS) {
  const srcPath = path.join(promoDir, src);
  const outPath = path.join(promoDir, out);
  try {
    await fs.access(srcPath);
  } catch {
    console.log(`skip ${src} (not found)`);
    continue;
  }
  const buf = await sharp(srcPath, { density: 384 })
    .resize(width, height, { fit: "fill" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await fs.writeFile(outPath, buf);
  const stat = await fs.stat(outPath);
  console.log(`  ${out}: ${width}x${height}  ${(stat.size / 1024).toFixed(1)} KB`);
}
