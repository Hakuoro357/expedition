// GAME_WIDTH is the "inner" content width all scene/layout code is
// authored against. The actual Phaser canvas (GAME_CANVAS_WIDTH) is
// wider — its aspect is chosen at startup to match the viewport so
// that Phaser's Scale.FIT does not leave letterbox bars on the sides.
// Content stays centered via GAME_OFFSET_X: Phaser scenes shift their
// cameras and DOM overlays shift their inner div, so we don't need
// to touch any layout coordinates.
export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;

// Mobile widens to 430 so phones with aspect ratio 0.46–0.51 fill
// edge-to-edge. Desktop keeps the original 390 — there the canvas
// is already height-limited by the window, and a wider canvas would
// only push the layout into letterbox bars on the sides.
const MOBILE_CANVAS_WIDTH = 430;
const DESKTOP_BREAKPOINT = 700;

function computeCanvasWidth(): number {
  if (typeof window === "undefined") return MOBILE_CANVAS_WIDTH;
  const w = window.innerWidth;
  if (!w || w >= DESKTOP_BREAKPOINT) return GAME_WIDTH;
  return MOBILE_CANVAS_WIDTH;
}

export const GAME_CANVAS_WIDTH = computeCanvasWidth();
export const GAME_OFFSET_X = (GAME_CANVAS_WIDTH - GAME_WIDTH) / 2;

export const SCENES = {
  boot: "boot",
  devPreview: "dev-preview",
  prologue: "prologue",
  map: "map",
  detail: "detail",
  game: "game",
  reward: "reward",
  diary: "diary",
  settings: "settings"
} as const;

export const SAVE_KEY = "solitaire-expedition-save-v1";
