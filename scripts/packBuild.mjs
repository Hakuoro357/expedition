/**
 * Packs dist/ into builds/{target}/solitaire-expedition-v{version}.zip.
 *
 * Usage:
 *   node scripts/packBuild.mjs              # default: yandex
 *   node scripts/packBuild.mjs --target=gamepush
 *
 * Uses adm-zip because PowerShell's Compress-Archive writes backslash path
 * separators on Windows, and platform S3 extractors treat them as literal
 * filename characters — the assets/ folder never materialises and the game
 * fails to load with 404 on index-*.js and index-*.css.
 */
import AdmZip from "adm-zip";
import { readFileSync, statSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = resolve(rootDir, "dist");

const target = process.argv.find(a => a.startsWith("--target="))?.split("=")[1] ?? "yandex";
const validTargets = ["yandex", "gamepush"];
if (!validTargets.includes(target)) {
  console.error(`[pack] unknown target "${target}". Valid: ${validTargets.join(", ")}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
const version = pkg.version;
const outDir = resolve(rootDir, "builds", target);
mkdirSync(outDir, { recursive: true });
const outputPath = resolve(outDir, `solitaire-expedition-v${version}.zip`);

try {
  statSync(distDir);
} catch {
  console.error(`[pack] dist/ not found at ${distDir}. Run 'vite build' first.`);
  process.exit(1);
}

const zip = new AdmZip();
zip.addLocalFolder(distDir);
zip.writeZip(outputPath);

const sizeMb = (statSync(outputPath).size / (1024 * 1024)).toFixed(2);
console.log(`[pack] ${outputPath} (${sizeMb} MB)`);
