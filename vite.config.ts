import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
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
  // отладочные сообщения (включая логи save/cloud) не попадали в DevTools
  // у обычных игроков и не давали подсказок для манипуляции состоянием.
  esbuild:
    command === "build"
      ? { drop: ["console", "debugger"] }
      : undefined,
  build: {
    // Yandex Games грузит игру одним архивом — sourcemaps в проде не нужны
    // и только раздувают zip. У нас приватные стек-трейсы из save/SDK
    // вообще не должны утекать игроку.
    sourcemap: false,
    target: "es2022",
    // Phaser ~1.2 МБ минифицированного — выходит за дефолтный warn-лимит
    // 500 КБ, что засоряет лог сборки. Поднимаем порог, потому что
    // single-bundle загрузка тут осознанная (так быстрее на Yandex CDN).
    chunkSizeWarningLimit: 1500,
    // Инлайнить мелкие ассеты (≤4 КБ) в JS — экономит HTTP-роундтрипы
    // на старте, важнее всего на мобильном.
    assetsInlineLimit: 4096,
    // Минификация по умолчанию (esbuild) — быстрее terser и достаточно
    // агрессивна для нашего размера бандла.
    minify: "esbuild",
    cssMinify: true
  }
}));
