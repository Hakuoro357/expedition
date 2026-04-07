import type Phaser from "phaser";
import type { Card } from "@/core/cards/types";
import { formatRank, formatSuit } from "@/features/board/formatCard";
import type { Locale } from "@/services/i18n/locales";

const CARD_TEXTURE_SCALE = 4;
const CARD_BACKGROUND = "#f7ecd8";
const CARD_BORDER = "#dac9a1";
const CARD_SELECTED_BORDER = "#e3a34f";
const CARD_RED = "#a93f48";
const CARD_BLACK = "#1b1b1b";

function getCardFaceTextureKey(card: Card, isSelected: boolean, locale: Locale): string {
  return `card-face-${locale}-${card.rank}-${card.suit}-${isSelected ? "selected" : "default"}`;
}

export function ensureCardFaceTexture(
  scene: Phaser.Scene,
  card: Card,
  width: number,
  height: number,
  isSelected = false,
  locale: Locale = "en",
): string {
  const key = getCardFaceTextureKey(card, isSelected, locale);
  if (scene.textures.exists(key)) {
    return key;
  }

  const texture = scene.textures.createCanvas(key, width * CARD_TEXTURE_SCALE, height * CARD_TEXTURE_SCALE);
  if (!texture) {
    return key;
  }
  const ctx = texture.context;
  const scaledWidth = width * CARD_TEXTURE_SCALE;
  const scaledHeight = height * CARD_TEXTURE_SCALE;
  const label = `${formatRank(card, locale)}${formatSuit(card)}`;
  const textColor = card.color === "red" ? CARD_RED : CARD_BLACK;

  ctx.save();
  ctx.clearRect(0, 0, scaledWidth, scaledHeight);
  ctx.scale(CARD_TEXTURE_SCALE, CARD_TEXTURE_SCALE);
  ctx.fillStyle = CARD_BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = isSelected ? CARD_SELECTED_BORDER : CARD_BORDER;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = textColor;
  ctx.textBaseline = "top";
  ctx.font = "bold 14px Georgia";
  ctx.fillText(label, 4, 4);

  ctx.save();
  ctx.translate(width - 4, height - 4);
  ctx.rotate(Math.PI);
  ctx.fillText(label, 0, 0);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "24px Georgia";
  ctx.fillText(formatSuit(card), width / 2, height / 2 + 1);
  ctx.restore();

  texture.refresh();
  return key;
}
