import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8")) as {
  version: string;
};
const BUILD_TIME = new Date().toISOString();

// В dev GamePush CDN-скрипт может быть недоступен (оффлайн, VPN, etc.).
// Плагин отдаёт минимальный mock, который регистрирует window.__gp с
// no-op методами и вызывает callback onGPInit. В production скрипт
// грузится с gamepush.com — mock не нужен.
const gamePushDevStub = {
  name: "gamepush-dev-stub",
  configureServer(server: { middlewares: { use: (path: string, handler: (req: unknown, res: { setHeader: (k: string, v: string) => void; end: (body: string) => void }) => void) => void } }) {
    server.middlewares.use("/sdk-stub.js", (_req, res) => {
      res.setHeader("Content-Type", "application/javascript");
      res.end(`
/* GamePush dev stub — no-op SDK for offline development */
(function() {
  var noop = function() {};
  var resolved = Promise.resolve();
  var gp = {
    ads: {
      showRewardedVideo: function() { return Promise.resolve(false); },
      showFullscreen: function() { return resolved; },
      showPreloader: function() { return resolved; },
      showSticky: noop, closeSticky: noop, refreshSticky: noop,
      isFullscreenAvailable: false, isRewardedAvailable: false, isStickyAvailable: false,
      on: noop
    },
    player: {
      ready: resolved,
      get: function() { return undefined; },
      set: noop, add: noop, sync: noop, load: noop,
      login: function() { return Promise.resolve(false); },
      logout: noop, isLoggedIn: false,
      on: noop
    },
    platform: { type: "dev", id: "dev" },
    language: navigator.language.slice(0, 2) || "en",
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
    isPortrait: window.innerHeight > window.innerWidth,
    isDev: true,
    serverTime: new Date().toISOString(),
    isPaused: false,
    isMuted: false,
    sounds: {
      isMuted: false, isSFXMuted: false, isMusicMuted: false,
      on: noop,
      mute: noop, unmute: noop,
      muteSFX: noop, unmuteSFX: noop,
      muteMusic: noop, unmuteMusic: noop
    },
    changeLanguage: noop,
    gameStart: noop, gameStop: noop,
    gameplayStart: noop, gameplayStop: noop,
    pause: noop, resume: noop,
    on: noop
  };
  window.__gp = gp;
  if (typeof window.onGPInit === "function") window.onGPInit(gp);
})();
`);
    });
  }
};

export default defineConfig(({ command }) => ({
  // Платформы хостят бандл по подпути — абсолютные пути ломают загрузку.
  base: "./",
  plugins: [gamePushDevStub],
  server: {
    host: "0.0.0.0",
    port: 5173
  },
  resolve: {
    alias: {
      "@": "/src"
    }
  },
  // Версия и время билда — вшиваются в бандл через define, доступны
  // как __APP_VERSION__ / __BUILD_TIME__ в рантайме. Нужны для показа
  // в Settings, чтобы тестировщики GP могли однозначно видеть, какой
  // билд запущен в песочнице.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  // В production оставляем console.info/warn/error для диагностики
  // (нужно для GP-тестеров — логи [mute]/[gp.sync]/[save.persist]).
  // Вырезаем только debug/log/trace — то что точно не полезно.
  esbuild:
    command === "build"
      ? { drop: ["debugger"], pure: ["console.log", "console.debug", "console.trace"] }
      : undefined,
  build: {
    sourcemap: false,
    target: "es2022",
    // Phaser ~1.2 МБ — выходит за дефолтный warn-лимит 500 КБ.
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 4096,
    minify: "esbuild",
    cssMinify: true
  }
}));
