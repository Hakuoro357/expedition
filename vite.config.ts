import { defineConfig } from "vite";

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
  // В production-сборке вырезаем console.* и debugger, чтобы внутренние
  // отладочные сообщения не попадали в DevTools у обычных игроков.
  esbuild:
    command === "build"
      ? { drop: ["console", "debugger"] }
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
