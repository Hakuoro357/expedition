import homeIconHtml from "../assets/ui/nav-icons/home.svg?raw";
import undoIconHtml from "../assets/ui/nav-icons/undo.svg?raw";
import rulesIconHtml from "../assets/ui/nav-icons/rules.svg?raw";
import type { Card } from "@/core/cards/types";
import { createCardFaceSvgMarkup } from "@/features/board/cardFaceMarkup";

type GameActionId = "undo" | "rules" | "home";
type GameFoundationSlot = {
  suitSymbol: string;
  active: boolean;
  hasCard: boolean;
};

export type GameOverlayCard = {
  key: string;
  left: number;
  top: number;
  card: Card;
  selected: boolean;
};

export type GameOverlayFaceDownCard = {
  key: string;
  left: number;
  top: number;
};

export type GameOverlayEmptySlot = {
  key: string;
  left: number;
  top: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getActionIconHtml(id: GameActionId): string {
  switch (id) {
    case "undo":
      return undoIconHtml;
    case "rules":
      return rulesIconHtml;
    case "home":
      return homeIconHtml;
  }
}

type GameSceneOverlayParams = {
  title: string;
  subtitle: string;
  coinsLabel: string;
  stockCountLabel: string;
  wasteHasCard: boolean;
  wasteActive: boolean;
  foundationSlots: GameFoundationSlot[];
  undoLabel: string;
  rulesLabel: string;
  homeLabel: string;
  cards: GameOverlayCard[];
  dragCards: GameOverlayCard[];
  stockCardBackSvg?: string;
  cardBackSvg?: string;
  faceDownCards?: GameOverlayFaceDownCard[];
  emptyTableauSlots?: GameOverlayEmptySlot[];
};

function createTopRowHtml(
  _stockCountLabel: string,
  wasteHasCard: boolean,
  wasteActive: boolean,
  foundationSlots: GameFoundationSlot[],
  stockCardBackSvg?: string,
): string {
  // Stock slot: use same class as tableau cards (.game-overlay__dom-card) to guarantee 44x70 size.
  // Position it manually since .game-overlay__dom-card is absolute.
  const stockLeft = 17; // Matches TABLEAU_START_X - CARD_WIDTH/2
  const stockTop = 101; // Matches TOP_ROW_Y - CARD_HEIGHT/2

  // stockCardBackSvg is already processed by fixCardBackSvgAspect
  const stockHtml = stockCardBackSvg
    ? `<div class="game-overlay__dom-card game-overlay__slot--stock" style="left:${stockLeft}px;top:${stockTop}px;"><div class="game-overlay__card-back">${stockCardBackSvg}</div></div>`
    : `<div class="game-overlay__slot game-overlay__slot--stock game-overlay__slot--empty" style="left:${stockLeft}px;top:${stockTop}px;"></div>`;

  const wasteHtml = `<div class="game-overlay__slot game-overlay__slot--waste${wasteActive ? " game-overlay__slot--active" : ""}${wasteHasCard ? " game-overlay__slot--hidden" : ""}"></div>`;

  const foundationsHtml = foundationSlots
    .map(
      (slot, index) => `
        <div class="game-overlay__slot game-overlay__slot--foundation game-overlay__slot--foundation-${index}${slot.active ? " game-overlay__slot--active" : ""}${slot.hasCard ? " game-overlay__slot--hidden" : ""}">
          <span class="game-overlay__slot-suit">${escapeHtml(slot.suitSymbol)}</span>
        </div>`,
    )
    .join("");

  return [
    '<div class="game-overlay__top-row">',
    stockHtml,
    wasteHtml,
    foundationsHtml,
    "</div>",
  ].join("");
}

function createCardsHtml(cards: GameOverlayCard[]): string {
  if (cards.length === 0) {
    return "";
  }

  return [
    '<div class="game-overlay__dom-cards">',
    ...cards.map(
      ({ key, left, top, card, selected }) => `
        <div
          class="game-overlay__dom-card${selected ? " game-overlay__dom-card--selected" : ""}"
          data-card-key="${escapeHtml(key)}"
          style="left:${left}px;top:${top}px;"
        >
          ${createCardFaceSvgMarkup(card, selected)}
        </div>`,
    ),
    "</div>",
  ].join("");
}

function createDragCardsHtml(cards: GameOverlayCard[]): string {
  if (cards.length === 0) {
    return "";
  }

  return [
    '<div class="game-overlay__dom-cards game-overlay__dom-cards--drag">',
    ...cards.map(
      ({ key, left, top, card, selected }) => `
        <div
          class="game-overlay__dom-card game-overlay__dom-card--drag${selected ? " game-overlay__dom-card--selected" : ""}"
          data-card-key="${escapeHtml(key)}"
          style="left:${left}px;top:${top}px;"
        >
          ${createCardFaceSvgMarkup(card, selected)}
        </div>`,
    ),
    "</div>",
  ].join("");
}

// Fix SVG aspect ratio to match card dimensions (44x70 ≈ 0.63).
// Original viewBox is 0 0 300 420 (≈ 0.71). Without this, SVG adds letterboxing.
export function fixCardBackSvgAspect(svg: string): string {
  // 1. Force stretch to container dimensions by disabling aspect ratio preservation.
  // 2. Force width/height to 100% to ensure it fills the container even if intrinsic size is set.
  return svg
    .replace(/preserveAspectRatio="[^"]*"/, '')
    .replace(/viewBox="[^"]*"/, '$& preserveAspectRatio="none"')
    .replace(/width="[^"]*"/, 'width="100%"')
    .replace(/height="[^"]*"/, 'height="100%"');
}

function createFaceDownCardsHtml(cards: GameOverlayFaceDownCard[], cardBackSvg?: string): string {
  if (cards.length === 0 || !cardBackSvg) {
    return "";
  }

  // cardBackSvg is already processed by fixCardBackSvgAspect
  return [
    '<div class="game-overlay__dom-cards game-overlay__dom-cards--facedown">',
    ...cards.map(
      ({ key, left, top }) => `
        <div
          class="game-overlay__dom-card game-overlay__dom-card--facedown"
          data-card-key="${escapeHtml(key)}"
          style="left:${left}px;top:${top}px;"
        >
          <div class="game-overlay__card-back">${cardBackSvg}</div>
        </div>`,
    ),
    "</div>",
  ].join("");
}

function createEmptyTableauSlotsHtml(slots: GameOverlayEmptySlot[]): string {
  if (slots.length === 0) {
    return "";
  }

  return [
    '<div class="game-overlay__empty-slots">',
    ...slots.map(
      ({ key, left, top }) => `
        <div
          class="game-overlay__empty-slot"
          data-card-key="${escapeHtml(key)}"
          style="left:${left}px;top:${top}px;"
        ></div>`,
    ),
    "</div>",
  ].join("");
}

export function createGameSceneOverlayHtml({
  title,
  subtitle,
  coinsLabel,
  stockCountLabel,
  wasteHasCard,
  wasteActive,
  foundationSlots,
  undoLabel,
  rulesLabel,
  homeLabel,
  cards,
  dragCards,
  stockCardBackSvg,
  cardBackSvg,
  faceDownCards,
  emptyTableauSlots,
}: GameSceneOverlayParams): string {
  const items: Array<{ id: GameActionId; label: string }> = [
    { id: "undo", label: undoLabel },
    { id: "rules", label: rulesLabel },
    { id: "home", label: homeLabel },
  ];

  return [
    '<div class="game-overlay">',
    `  <div class="game-overlay__coins"><span class="game-overlay__coin-dot" aria-hidden="true"></span><span class="game-overlay__coins-value">${escapeHtml(coinsLabel)}</span></div>`,
    '  <div class="game-overlay__header">',
    `    <div class="game-overlay__title">${escapeHtml(title)}</div>`,
    (subtitle ? `    <div class="game-overlay__subtitle">${escapeHtml(subtitle)}</div>` : ""),
    "  </div>",
    `  ${createTopRowHtml(stockCountLabel, wasteHasCard, wasteActive, foundationSlots, stockCardBackSvg)}`,
    `  <div class="game-overlay__status" data-game-status="true"></div>`,
    `  ${createEmptyTableauSlotsHtml(emptyTableauSlots ?? [])}`,
    `  ${createFaceDownCardsHtml(faceDownCards ?? [], cardBackSvg)}`,
    `  ${createCardsHtml(cards)}`,
    `  ${createDragCardsHtml(dragCards)}`,
    '  <div class="game-overlay__nav">',
    ...items.map(
      (item) => `    <button class="game-overlay__action game-overlay__action--${escapeHtml(item.id)}" data-game-action="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(item.label)}"><span class="game-overlay__action-icon">${getActionIconHtml(item.id)}</span><span class="game-overlay__action-label">${escapeHtml(item.label)}</span></button>`,
    ),
    "  </div>",
    "</div>",
  ].join("");
}
