import type Phaser from "phaser";

import { GAME_OFFSET_X } from "@/app/config/gameConfig";
import { lockClicksFor } from "@/ui/ghostClickGuard";

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CanvasOverlayFrame = {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
};

export function computeCanvasOverlayFrame(
  canvasRect: RectLike,
  parentRect: RectLike,
  logicalWidth: number
): CanvasOverlayFrame {
  const width = canvasRect.width;
  const height = canvasRect.height;
  const left = canvasRect.left - parentRect.left;
  const top = canvasRect.top - parentRect.top;
  const scale = width / logicalWidth;

  return { left, top, width, height, scale };
}

export type CanvasOverlayHandle = {
  setHtml: (html: string) => void;
  updateLayout: () => void;
  setVisible: (visible: boolean) => void;
  getInnerElement: () => HTMLDivElement;
  getHostElement: () => HTMLDivElement;
  getScale: () => number;
  destroy: () => void;
};

type CreateCanvasOverlayParams = {
  scene: Phaser.Scene;
  html: string;
  className: string;
  logicalWidth: number;
  logicalHeight: number;
};

export function createCanvasAnchoredOverlay({
  scene,
  html,
  className,
  logicalWidth,
  logicalHeight,
}: CreateCanvasOverlayParams): CanvasOverlayHandle {
  const canvas = scene.game.canvas;
  const parent = canvas.parentElement;

  if (!parent) {
    throw new Error("Canvas parent not found for overlay");
  }

  parent.style.position = "relative";

  const host = document.createElement("div");
  host.className = "canvas-overlay-host";
  host.style.pointerEvents = "none";
  host.style.position = "absolute";
  host.style.overflow = "hidden";
  host.style.zIndex = "2";

  const inner = document.createElement("div");
  inner.className = className;
  const innerStyle = inner.style;
  innerStyle.position = "absolute";
  innerStyle.left = "0";
  innerStyle.top = "0";
  // Inner content was authored against the 390-wide "inner" area; we size
  // the overlay to that and shift it right by GAME_OFFSET_X * scale so it
  // sits centered inside the wider canvas (GAME_WIDTH).
  innerStyle.width = `${logicalWidth - GAME_OFFSET_X * 2}px`;
  innerStyle.height = `${logicalHeight}px`;
  innerStyle.transformOrigin = "top left";
  inner.innerHTML = html;

  host.appendChild(inner);
  parent.appendChild(host);

  // Глушим клики на ~300 мс после монтажа нового overlay, чтобы
  // на мобильных синтетический ghost-click от тапа в предыдущей
  // сцене не пробил кнопку, оказавшуюся под пальцем после ребилда.
  lockClicksFor(300);

  // Текущий масштаб overlay относительно logical размера. Обновляется
  // только в updateLayout и читается через getScale — никаких отдельных
  // путей подсчёта, чтобы не было гонки "размер уже сменился, а getScale
  // ещё отдаёт старое значение".
  let currentScale = 1;

  const updateLayout = (): void => {
    const frame = computeCanvasOverlayFrame(
      canvas.getBoundingClientRect(),
      parent.getBoundingClientRect(),
      logicalWidth
    );

    host.style.left = `${frame.left}px`;
    host.style.top = `${frame.top}px`;
    host.style.width = `${frame.width}px`;
    host.style.height = `${frame.height}px`;
    // transform:scale работает во всех браузерах (Firefox/Safari/Chrome),
    // в отличие от non-standard `zoom`, который раньше применялся здесь.
    // translateX shifts the inner content right by GAME_OFFSET_X logical px
    // so the 390-wide content area is centered inside the 430-wide canvas.
    innerStyle.transform = `translateX(${GAME_OFFSET_X * frame.scale}px) scale(${frame.scale})`;
    currentScale = frame.scale;
  };

  const setHtml = (nextHtml: string): void => {
    inner.innerHTML = nextHtml;
    updateLayout();
  };

  const setVisible = (visible: boolean): void => {
    host.style.display = visible ? "block" : "none";
  };

  const onResize = (): void => updateLayout();

  scene.scale.on("resize", onResize);
  window.addEventListener("resize", onResize);

  const destroy = (): void => {
    scene.scale.off("resize", onResize);
    window.removeEventListener("resize", onResize);
    host.remove();
  };

  updateLayout();

  const getInnerElement = (): HTMLDivElement => inner;
  const getHostElement = (): HTMLDivElement => host;
  const getScale = (): number => currentScale;

  return { setHtml, updateLayout, setVisible, getInnerElement, getHostElement, getScale, destroy };
}
