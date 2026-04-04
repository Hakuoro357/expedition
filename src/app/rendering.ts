import type Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "@/app/config/gameConfig";

export function getGameResolution(devicePixelRatio = 1): number {
  return Math.max(1, Math.min(devicePixelRatio || 1, 2));
}

export function getTextResolution(devicePixelRatio = 1): number {
  return Math.max(1, Math.min(devicePixelRatio || 1, 3));
}

export function getScaledGameSize(devicePixelRatio = 1): {
  scale: number;
  width: number;
  height: number;
} {
  const scale = getGameResolution(devicePixelRatio);
  return {
    scale,
    width: Math.round(GAME_WIDTH * scale),
    height: Math.round(GAME_HEIGHT * scale),
  };
}

export function applyTextRenderQuality<T extends Phaser.GameObjects.Text>(text: T): T {
  text.setResolution(getTextResolution(window.devicePixelRatio || 1));
  return text;
}

export function applyCardTextRenderQuality<T extends Phaser.GameObjects.Text>(text: T): T {
  const dpr = window.devicePixelRatio || 1;
  text.setResolution(Math.max(2, Math.min(dpr || 1, 5)));
  return text;
}
