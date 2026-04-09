/**
 * Packs dist/ into solitaire-expedition-v{version}.zip.
 *
 * Uses adm-zip because PowerShell's Compress-Archive writes backslash path
 * separators on Windows, and Yandex Games' S3 extractor treats them as
 * literal filename characters — the assets/ folder never materialises and
 * the game fails to load with 404 on index-*.js and index-*.css.
 *
 * adm-zip normalises paths to forward slashes, which is required by the
 * ZIP spec (APPNOTE 4.4.17.1) and is what every sane unzipper expects.
 */
import AdmZip from "adm-zip";
import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const distDir = resolve(rootDir, "dist");
const pkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
const version = pkg.version;
const outputPath = resolve(rootDir, `solitaire-expedition-v${version}.zip`);

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
