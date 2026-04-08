// Конвертирует портреты и крупные артефакты PNG → WebP.
// После проверки можно удалить .png-исходники руками; глобы в
// portraitAssetUrls.ts / artifactAssetUrls.ts уже ищут .webp.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

const TARGETS = [
  { dir: path.join(repoRoot, "src/assets/portraits/raw"), quality: 82 },
  { dir: path.join(repoRoot, "src/assets/artifacts/large"), quality: 82 },
];

async function convert(dir, quality) {
  const entries = await fs.readdir(dir);
  const pngs = entries.filter((name) => name.toLowerCase().endsWith(".png"));
  let totalIn = 0;
  let totalOut = 0;
  for (const name of pngs) {
    const inPath = path.join(dir, name);
    const outPath = path.join(dir, name.replace(/\.png$/i, ".webp"));
    const inStat = await fs.stat(inPath);
    await sharp(inPath).webp({ quality, effort: 6 }).toFile(outPath);
    const outStat = await fs.stat(outPath);
    totalIn += inStat.size;
    totalOut += outStat.size;
    const pct = Math.round((1 - outStat.size / inStat.size) * 100);
    console.log(
      `  ${name}: ${(inStat.size / 1024).toFixed(0)} KB → ${(outStat.size / 1024).toFixed(0)} KB (-${pct}%)`,
    );
  }
  console.log(
    `  TOTAL: ${(totalIn / 1024 / 1024).toFixed(2)} MB → ${(totalOut / 1024 / 1024).toFixed(2)} MB`,
  );
  return { totalIn, totalOut };
}

let grandIn = 0;
let grandOut = 0;
for (const { dir, quality } of TARGETS) {
  console.log(`\n[${path.relative(repoRoot, dir)}] quality=${quality}`);
  const { totalIn, totalOut } = await convert(dir, quality);
  grandIn += totalIn;
  grandOut += totalOut;
}
console.log(
  `\nGRAND TOTAL: ${(grandIn / 1024 / 1024).toFixed(2)} MB → ${(grandOut / 1024 / 1024).toFixed(2)} MB (-${Math.round((1 - grandOut / grandIn) * 100)}%)`,
);
