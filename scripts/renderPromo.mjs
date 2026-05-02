// Renders promo SVGs to PNGs at the sizes Yandex Games requires.
// Reads SVGs from promo/, writes PNGs alongside.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const promoDir = path.resolve(here, "..", "promo");
const gamepushDir = path.join(promoDir, "gamepush");

const TARGETS = [
  { src: "icon-source.svg",        out: "icon-512.png",                width: 512, height: 512 },
  { src: "cover-source.svg",       out: "cover-800x470-gradient.png",  width: 800, height: 470 },
  { src: "cover-source-solid.svg", out: "cover-800x470-solid.png",     width: 800, height: 470 },
  { src: "cover-source-gold.svg",  out: "cover-800x470-gold.png",      width: 800, height: 470 },
  { src: "cover-source-route.svg", out: "cover-800x470-route.png",     width: 800, height: 470 },
  // GamePush-обложки для RU. EN/TR не трогаем (там свои cover-source-gold-{en,tr}.svg,
  // выражают «Solitaire Expedition» — ожидаемое international-название).
  // Landscape 1920x1080 — из основного landscape-SVG (viewBox 800x470 ≈ 16:9.4).
  { src: "cover-source-gold.svg",          dir: gamepushDir, out: "cover-1920x1080-ru.png", width: 1920, height: 1080 },
  // Portrait 1080x1920 — отдельный SVG с viewBox 540x960 (9:16).
  // Одним landscape-файлом портрет не сделать: либо вытянутые элементы, либо
  // обрезанный кадр. Перекомпонованы: компас сверху, заголовок по центру,
  // карты снизу, маршрут и штамп вписаны в новые пропорции.
  { src: "cover-source-gold-portrait.svg", dir: gamepushDir, out: "cover-1080x1920-ru.png", width: 1080, height: 1920 },
];

for (const target of TARGETS) {
  const { src, out, width, height } = target;
  const outDir = target.dir ?? promoDir;
  const srcPath = path.join(promoDir, src);
  const outPath = path.join(outDir, out);
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
