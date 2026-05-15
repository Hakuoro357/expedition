#!/usr/bin/env node
/**
 * Downloads achievement icons from GP CDN into public/assets/achievements/.
 *
 * Source of URLs: GP admin GraphQL API — we previously uploaded the
 * icons via uploadAchievements.mjs which returned CDN URLs. Now we
 * re-query them and save locally for `public/assets/achievements/` —
 * the canonical source-of-truth for in-game UI.
 *
 * Usage:
 *   GP_API_SECRET=xxx node scripts/downloadAchievementIcons.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const API_URL = "https://api.gamepush.com/gs/api/graphql";
const PROJECT_ID = 27547;
const API_SECRET = process.env.GP_API_SECRET;
const OUT_DIR = "public/assets/achievements";

if (!API_SECRET) {
  console.error("Missing GP_API_SECRET");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

async function gql(query, variables = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Secret": API_SECRET,
      "X-Project-ID": String(PROJECT_ID),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function downloadAndSaveAsPng(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const webpBuf = Buffer.from(await res.arrayBuffer());
  // GP CDN serves WebP source — keep as compact palette PNG for the
  // plan's `<tag>.png` filename contract. `palette: true` quantizes
  // to 256 colors which is plenty for our brass-on-teal icons and
  // saves ~70% vs raw PNG.
  const pngBuf = await sharp(webpBuf)
    .png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 })
    .toBuffer();
  writeFileSync(filepath, pngBuf);
}

console.log("Fetching achievements list from GP...");
const data = await gql(
  `query Ach($projectId: Int!) {
    FetchAchievements(input: { projectId: $projectId }) {
      ... on AchievementsList {
        items { tag icon lockedIcon }
      }
    }
  }`,
  { projectId: PROJECT_ID },
);

const items = data.FetchAchievements?.items ?? [];
console.log(`Found ${items.length} achievements.`);

for (const a of items) {
  if (!a.tag || !a.icon) {
    console.warn(`  skip: missing tag/icon for ${JSON.stringify(a)}`);
    continue;
  }
  const out = path.join(OUT_DIR, `${a.tag}.png`);
  // GP CDN returns .webp — convert filename to .png? Actually we want
  // the file to be readable as PNG. The URLs are `.webp` from GP CDN
  // (URL like /6a06d6d6...-256x256.webp). Save as .png expecting
  // browser/sharp will handle webp content? Or we should keep as .webp.
  // Game references `./assets/achievements/<tag>.png` per plan, so save as PNG.
  // GP icons are actually PNG that got `-256x256.webp` slug — let's verify.
  console.log(`  ↓ ${a.tag} ← ${a.icon}`);
  await downloadAndSaveAsPng(a.icon, out);
}

// ---- locked-generic.png — generate programmatically ----
console.log("\nGenerating locked-generic.png...");
const W = 256;
const lockSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#1a3a36"/>
      <stop offset="100%" stop-color="#0f2422"/>
    </radialGradient>
    <linearGradient id="brass" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#d8a04a"/>
      <stop offset="100%" stop-color="#7a5a2a"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" fill="url(#bg)"/>
  <!-- padlock: shackle (arch) -->
  <path d="M 96 130 V 100 a 32 32 0 0 1 64 0 V 130"
        stroke="url(#brass)" stroke-width="14" fill="none" stroke-linecap="round"/>
  <!-- padlock body -->
  <rect x="80" y="124" width="96" height="86" rx="10"
        fill="url(#brass)" stroke="#5a3e18" stroke-width="2"/>
  <!-- keyhole -->
  <circle cx="128" cy="158" r="9" fill="#3a2a1a"/>
  <rect x="124" y="158" width="8" height="20" rx="2" fill="#3a2a1a"/>
</svg>`);
const lockedPng = await sharp(lockSvg).png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 }).toBuffer();
writeFileSync(path.join(OUT_DIR, "locked-generic.png"), lockedPng);
console.log("  ✓ locked-generic.png written");

console.log(`\nDone. ${items.length + 1} files in ${OUT_DIR}/`);

console.log(`Done. ${items.length} files in ${OUT_DIR}/`);
