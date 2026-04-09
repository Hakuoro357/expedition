// Records a gameplay promo video via Playwright + ffmpeg.
//
// Pre-req: dev server running at http://localhost:5173.
//
// Usage:
//   node scripts/captureVideo.mjs [--locale=ru|en|tr]
//
// Output:
//   promo/video-{locale}.mp4   — 1080x1920, ~24s, H.264, ready for Yandex.
//
// Pipeline:
//   1. Playwright records at 540x960 WebM (9:16, small).
//   2. ffmpeg upscales 2x with lanczos, re-encodes H.264 MP4.
//
// Scene timeline (~24s total):
//   0.0 – 4.0s   prologue (case file text)
//   4.0 – 7.5s   map (route overview)
//   7.5 – 16.0s  live solver-driven gameplay (cards actually move)
//  16.0 – 20.0s  reward (victory + portrait)
//  20.0 – 24.0s  diary (archive)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, renameSync, rmSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, "..");
const promoDir = path.resolve(rootDir, "promo");
const tmpDir = path.resolve(rootDir, ".video-tmp");

// 540x960 * 2x upscale = 1080x1920. Playwright ignores deviceScaleFactor
// for video output, so the upscale has to happen in ffmpeg.
const VIEWPORT = { width: 540, height: 960 };
const URL = "http://localhost:5173";

const HIDE_DEV_CSS = `
  .route-overlay__dev-tools,
  [class*="dev-btn"],
  [class*="dev-tools"] { display: none !important; }
`;

const args = process.argv.slice(2);
const localeArg = args.find((a) => a.startsWith("--locale="));
const LOCALE = localeArg ? localeArg.split("=")[1] : "ru";
if (!["ru", "en", "tr"].includes(LOCALE)) {
  console.error(`[video] invalid locale: ${LOCALE}`);
  process.exit(1);
}

const NAV_LOCALE = { ru: "ru-RU", en: "en-US", tr: "tr-TR" }[LOCALE];
const outputPath = path.join(promoDir, `video-${LOCALE}.mp4`);

// The game step has a fixed duration (holdMs) and runs the greedy solver
// in parallel. `moveDelayMs` is how fast cards fly — tuned so about
// 25-30 moves fit in the allotted window.
const TIMELINE = [
  { scene: "prologue", holdMs: 4000 },
  { scene: "map",      holdMs: 3500 },
  { scene: "game",     holdMs: 9500, autoPlay: true, moveDelayMs: 260 },
  { scene: "reward",   holdMs: 4000, data: { dealId: "c1n1", preview: true } },
  { scene: "diary",    holdMs: 4000 },
];

if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

console.log(`[video] locale=${LOCALE} → ${path.relative(rootDir, outputPath)}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  locale: NAV_LOCALE,
  recordVideo: { dir: tmpDir, size: VIEWPORT },
});
const page = await ctx.newPage();

await page.goto(URL, { waitUntil: "networkidle" });
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

await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__solitaireGame, null, { timeout: 10000 });
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
await page.waitForTimeout(500);

async function switchScene(scene, data) {
  await page.evaluate(({ sceneKey, sceneData }) => {
    const g = window.__solitaireGame;
    ["map","detail","game","reward","diary","settings","prologue","dev-preview"].forEach((k) => {
      try { g.scene.stop(k); } catch { /* noop */ }
    });
    g.scene.start(sceneKey, sceneData);
  }, { sceneKey: scene, sceneData: data ?? {} });
}

for (const step of TIMELINE) {
  await switchScene(step.scene, step.data);
  if (step.autoPlay) {
    // Give GameScene a moment to render the initial deal, then kick off
    // the solver. Solver runs async in-page; we wait out the remaining
    // hold time for the animation to finish or to cap the game segment.
    await page.waitForTimeout(700);
    page.evaluate((delay) => {
      const dbg = window.__solitaireDebug;
      if (dbg?.solveAndStep) void dbg.solveAndStep(delay);
    }, step.moveDelayMs ?? 280).catch(() => { /* fire-and-forget */ });
    await page.waitForTimeout(step.holdMs - 700);
  } else {
    await page.waitForTimeout(step.holdMs);
  }
  console.log(`  captured ${step.scene} (${step.holdMs}ms)`);
}

await page.close();
await ctx.close();
await browser.close();

// Find the generated webm and convert to mp4 with 2x lanczos upscale.
const webmFiles = readdirSync(tmpDir).filter((f) => f.endsWith(".webm"));
if (webmFiles.length === 0) {
  console.error("[video] no webm produced");
  process.exit(1);
}
const webmPath = path.join(tmpDir, webmFiles[0]);

// Trim the first TRIM_START_SEC of boot/navigation noise, then upscale
// to 1080x1920 via lanczos, re-encode H.264, strip audio.
//
// Yandex promo videos: MP4, H.264, up to 30 seconds, portrait or landscape.
// Our scene timeline is ~24s content, plus ~8s of boot/reload at the start.
const TRIM_START_SEC = 7;

console.log(`[video] encoding mp4 via ffmpeg (trim ${TRIM_START_SEC}s)...`);
await new Promise((resolve, reject) => {
  const proc = spawn(
    ffmpegPath,
    [
      "-y",
      "-ss", String(TRIM_START_SEC),
      "-i", webmPath,
      "-vf", "scale=1080:1920:flags=lanczos",
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-an",
      outputPath,
    ],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
  proc.on("error", reject);
  proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
});

rmSync(tmpDir, { recursive: true, force: true });
console.log(`[video] done: ${path.relative(rootDir, outputPath)}`);
