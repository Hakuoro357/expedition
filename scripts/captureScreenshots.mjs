// Captures 5 publication screenshots via Playwright at 9:16 (1080x1920).
// Pre-req: dev server running at http://localhost:5173.
//
// Usage:
//   node scripts/captureScreenshots.mjs [--locale=ru|en|tr]
//
// Output: promo/9x16_screenshot-{1..5}-{slug}-{locale}.png
//         (locale suffix omitted for ru to preserve existing filenames)
//
// Scenes captured:
//   1. prologue  — opening case-file text
//   2. map       — route overview
//   3. game      — solitaire gameplay
//   4. reward    — victory + portrait
//   5. diary     — archive of entries
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const promoDir = path.resolve(here, "..", "promo");

// 540x960 * DPR 2 = 1080x1920 (exact 9:16) — Yandex promo standard.
const VIEWPORT = { width: 540, height: 960 };
const DPR = 2;
const URL = process.env.SCREENSHOT_URL || "http://127.0.0.1:5173";

const HIDE_DEV_CSS = `
  .route-overlay__dev-tools,
  [class*="dev-btn"],
  [class*="dev-tools"] { display: none !important; }
`;

const args = process.argv.slice(2);
const localeArg = args.find((a) => a.startsWith("--locale="));
const LOCALE = localeArg ? localeArg.split("=")[1] : "ru";
if (!["ru", "en", "tr"].includes(LOCALE)) {
  console.error(`[capture] invalid locale: ${LOCALE}`);
  process.exit(1);
}

// Keep Russian filenames unchanged (they're already committed as
// 9x16_screenshot-N-slug.png). Other locales get a language suffix.
const suffix = LOCALE === "ru" ? "" : `-${LOCALE}`;

const SCENES = [
  { key: "prologue", file: `9x16_screenshot-1-prologue${suffix}.png`, waitMs: 700 },
  { key: "map",      file: `9x16_screenshot-2-map${suffix}.png`,      waitMs: 900 },
  { key: "game",     file: `9x16_screenshot-3-game${suffix}.png`,     waitMs: 1300 },
  { key: "reward",   file: `9x16_screenshot-4-reward${suffix}.png`,   waitMs: 1100, data: { dealId: "c1n1", preview: true } },
  { key: "diary",    file: `9x16_screenshot-5-diary${suffix}.png`,    waitMs: 700 },
];

async function switchScene(page, key, data) {
  await page.evaluate(({ sceneKey, sceneData }) => {
    const g = window.__solitaireGame;
    ["map","detail","game","reward","diary","settings","prologue","dev-preview"].forEach((k) => {
      try { g.scene.stop(k); } catch { /* scene not running */ }
    });
    g.scene.start(sceneKey, sceneData);
  }, { sceneKey: key, sceneData: data ?? {} });
}

// BootScene now always re-applies navigator.language on boot to honour
// Yandex's ?lang=... URL param in production. Map our --locale flag onto
// Playwright's context locale so the fallback (sdk unavailable → navigator.language)
// picks the right language.
const NAV_LOCALE = { ru: "ru-RU", en: "en-US", tr: "tr-TR" }[LOCALE];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: DPR,
  locale: NAV_LOCALE,
});
const page = await ctx.newPage();

// Seed localStorage BEFORE page load so BootScene picks up the requested locale.
// We navigate to the dev server first to get same-origin access to localStorage,
// then seed, then reload.
await page.goto(URL, { waitUntil: "domcontentloaded" });

await page.evaluate((locale) => {
  const SAVE_KEY = "solitaire-expedition-save-v1";
  const seeded = {
    version: 1,
    progress: {
      currentChapter: 1,
      unlockedNodes: ["c1n1", "c1n2", "c1n3", "c1n4"],
      completedNodes: ["c1n1", "c1n2", "c1n3"],
      artifacts: ["compass-fragment"],
      coins: 250,
      streakCount: 3,
      locale,
      prologueShown: true,
      dailyClaimedOn: null,
    },
    currentGame: null,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(seeded));
}, LOCALE);

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!window.__solitaireGame, null, { timeout: 10000 });
// Wait until BootScene finishes initializing AppContext and hands off to
// the next scene. Until then any manual scene.start() races with boot.
await page.waitForFunction(
  () => {
    const g = window.__solitaireGame;
    if (!g) return false;
    const active = g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key);
    return active.length > 0 && !active.includes("boot");
  },
  null,
  { timeout: 15000 }
);
await page.addStyleTag({ content: HIDE_DEV_CSS });
await page.waitForTimeout(600);

for (const { key, file, waitMs, data } of SCENES) {
  await switchScene(page, key, data);
  await page.waitForTimeout(waitMs);
  const out = path.join(promoDir, file);
  await page.screenshot({ path: out, type: "png", omitBackground: false });
  console.log(`  ${file}`);
}

await browser.close();
console.log(`done (locale=${LOCALE})`);
