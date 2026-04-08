// Captures 5 publication screenshots via Playwright.
// Pre-req: dev server running at http://localhost:5173.
//
// Output: promo/screenshot-{1..5}.png at 591x1280 (matches game canvas).
//
// Scenes captured:
//   1. prologue       — opening case-file text
//   2. map            — route overview
//   3. game           — solitaire gameplay
//   4. reward         — victory + portrait
//   5. diary          — archive of entries
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const promoDir = path.resolve(here, "..", "promo");

const VIEWPORT = { width: 591, height: 1280 };
const URL = "http://localhost:5173";

const HIDE_DEV_CSS = `
  .route-overlay__dev-tools,
  [class*="dev-btn"],
  [class*="dev-tools"] { display: none !important; }
`;

const SCENES = [
  { key: "prologue", file: "screenshot-1-prologue.png", waitMs: 600 },
  { key: "map",      file: "screenshot-2-map.png",      waitMs: 800 },
  { key: "game",     file: "screenshot-3-game.png",     waitMs: 1200 },
  { key: "reward",   file: "screenshot-4-reward.png",   waitMs: 1000, data: { dealId: "c1n1", preview: true } },
  { key: "diary",    file: "screenshot-5-diary.png",    waitMs: 600 },
];

async function switchScene(page, key, data) {
  await page.evaluate(({ sceneKey, sceneData }) => {
    const g = window.__solitaireGame;
    ['map','detail','game','reward','diary','settings','prologue','dev-preview'].forEach(k => {
      try { g.scene.stop(k); } catch {}
    });
    g.scene.start(sceneKey, sceneData);
  }, { sceneKey: key, sceneData: data ?? {} });
}

// Bump progress so the diary has unlocked entries.
async function seedProgress(page) {
  await page.evaluate(() => {
    const g = window.__solitaireGame;
    // Find any scene to access AppContext via its registry
    const scene = g.scene.scenes.find(s => s.scene.isActive()) || g.scene.scenes[0];
    // The save service is on scene.registry under appContext or accessible via getAppContext
    // We poke localStorage directly using the same key the SaveService uses.
    // Read existing → mutate → write.
    const KEY = 'solitaire-expedition:save:v1';
    let raw;
    for (const k of Object.keys(localStorage)) {
      if (k.includes('save')) { raw = localStorage.getItem(k); break; }
    }
    return { keys: Object.keys(localStorage), sample: raw?.slice(0, 200) };
  });
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__solitaireGame, null, { timeout: 10000 });
await page.addStyleTag({ content: HIDE_DEV_CSS });
await page.waitForTimeout(500);

// Seed save with a few completed nodes so the diary has unlocked entries.
await page.evaluate(() => {
  const SAVE_KEY = 'solitaire-expedition-save-v1';
  const seeded = {
    version: 1,
    progress: {
      currentChapter: 1,
      unlockedNodes: ['c1n1', 'c1n2', 'c1n3', 'c1n4'],
      completedNodes: ['c1n1', 'c1n2', 'c1n3'],
      artifacts: ['compass-fragment'],
      coins: 250,
      streakCount: 3,
      locale: 'ru',
      prologueShown: true,
      dailyClaimedOn: null,
    },
    currentGame: null,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(seeded));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__solitaireGame, null, { timeout: 10000 });
await page.addStyleTag({ content: HIDE_DEV_CSS });
await page.waitForTimeout(500);

for (const { key, file, waitMs, data } of SCENES) {
  await switchScene(page, key, data);
  await page.waitForTimeout(waitMs);
  if (key === "reward") {
    const dump = await page.evaluate(() => {
      const hosts = document.querySelectorAll('.canvas-overlay-host');
      const rewardItems = document.querySelectorAll('[class*="reward"][class*="reveal"], [class*="reveal-item"], [class*="reward-overlay"]');
      const allClasses = new Set();
      hosts.forEach(h => h.querySelectorAll('*').forEach(el => {
        el.className && typeof el.className === 'string' && el.className.split(' ').forEach(c => allClasses.add(c));
      }));
      return {
        hostCount: hosts.length,
        rewardItemCount: rewardItems.length,
        sampleClasses: Array.from(allClasses).filter(c => c.includes('reward') || c.includes('reveal')).slice(0, 10),
        firstHostHtml: hosts[0]?.innerHTML.slice(0, 600),
      };
    });
    console.log('  [debug reward]', JSON.stringify(dump, null, 2));
  }
  const out = path.join(promoDir, file);
  await page.screenshot({ path: out, type: "png", omitBackground: false });
  console.log(`  ${file}`);
}

await browser.close();
console.log("done");
