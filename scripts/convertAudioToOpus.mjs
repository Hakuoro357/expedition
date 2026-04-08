// Конвертирует BGM mp3 → webm/opus 96k.
// Опус-в-webm понимают все современные браузеры (Chrome, FF, Safari 14.1+, Edge),
// что покрывает Yandex Games audience. Сжатие 50-60% к mp3 192k без слышимых потерь
// на эмбиент-музыке без ударных.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const ffmpeg = ffmpegInstaller.path;

const TARGETS = [
  { dir: path.join(repoRoot, "public/audio/music"), bitrate: "96k" },
];

function run(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}\n${stderr}`));
    });
  });
}

async function convert(dir, bitrate) {
  const entries = await fs.readdir(dir);
  const mp3s = entries.filter((name) => name.toLowerCase().endsWith(".mp3"));
  let totalIn = 0;
  let totalOut = 0;
  for (const name of mp3s) {
    const inPath = path.join(dir, name);
    const outPath = path.join(dir, name.replace(/\.mp3$/i, ".webm"));
    const inStat = await fs.stat(inPath);
    await run([
      "-y",
      "-i", inPath,
      "-c:a", "libopus",
      "-b:a", bitrate,
      "-vbr", "on",
      "-application", "audio",
      outPath,
    ]);
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
for (const { dir, bitrate } of TARGETS) {
  console.log(`\n[${path.relative(repoRoot, dir)}] opus ${bitrate}`);
  const { totalIn, totalOut } = await convert(dir, bitrate);
  grandIn += totalIn;
  grandOut += totalOut;
}
console.log(
  `\nGRAND TOTAL: ${(grandIn / 1024 / 1024).toFixed(2)} MB → ${(grandOut / 1024 / 1024).toFixed(2)} MB (-${Math.round((1 - grandOut / grandIn) * 100)}%)`,
);
