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
      : undefined
}));

