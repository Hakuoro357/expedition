import homeIconHtml from "../assets/ui/nav-icons/home.svg?raw";
import undoIconHtml from "../assets/ui/nav-icons/undo.svg?raw";
import hintIconHtml from "../assets/ui/nav-icons/hint.svg?raw";
import helpIconHtml from "../assets/ui/nav-icons/help.svg?raw";
import type { Card } from "@/core/cards/types";
import { createCardFaceSvgMarkup } from "@/features/board/cardFaceMarkup";

type GameActionId = "undo" | "hint" | "home";
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
    case "hint":
      return hintIconHtml;
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
  hintLabel: string;
  homeLabel: string;
  rulesLabel: string;
  cards: GameOverlayCard[];
  dragCards: GameOverlayCard[];
  cardBackSvg?: string;
  faceDownCards: GameOverlayFaceDownCard[];
};

function createTopRowHtml(
  stockCountLabel: string,
  wasteHasCard: boolean,
  wasteActive: boolean,
  foundationSlots: GameFoundationSlot[],
  cardBackSvg?: string,
): string {
  const stockHtml = cardBackSvg
    ? `<div class="game-overlay__slot game-overlay__slot--stock">${cardBackSvg}<span class="game-overlay__slot-count">${escapeHtml(stockCountLabel)}</span></div>`
    : `<div class="game-overlay__slot game-overlay__slot--stock"><span class="game-overlay__slot-count">${escapeHtml(stockCountLabel)}</span></div>`;

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

function createFaceDownCardsHtml(cards: GameOverlayFaceDownCard[], cardBackSvg?: string): string {
  if (cards.length === 0 || !cardBackSvg) {
    return "";
  }

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

export function createGameSceneOverlayHtml({
  title,
  subtitle,
  coinsLabel,
  stockCountLabel,
  wasteHasCard,
  wasteActive,
  foundationSlots,
  undoLabel,
  hintLabel,
  homeLabel,
  rulesLabel,
  cards,
  dragCards,
  cardBackSvg,
  faceDownCards,
}: GameSceneOverlayParams): string {
  const items: Array<{ id: GameActionId; label: string }> = [
    { id: "undo", label: undoLabel },
    { id: "hint", label: hintLabel },
    { id: "home", label: homeLabel },
  ];

  return [
    '<div class="game-overlay">',
    `  <div class="game-overlay__coins"><span class="game-overlay__coin-dot" aria-hidden="true"></span><span class="game-overlay__coins-value">${escapeHtml(coinsLabel)}</span></div>`,
    '  <div class="game-overlay__header">',
    `    <div class="game-overlay__title">${escapeHtml(title)}</div>`,
    (subtitle ? `    <div class="game-overlay__subtitle">${escapeHtml(subtitle)}</div>` : ""),
    "  </div>",
    `  ${createTopRowHtml(stockCountLabel, wasteHasCard, wasteActive, foundationSlots, cardBackSvg)}`,
    `  ${createFaceDownCardsHtml(faceDownCards, cardBackSvg)}`,
    `  ${createCardsHtml(cards)}`,
    `  ${createDragCardsHtml(dragCards)}`,
    `  <button class="game-overlay__question route-overlay__nav-item route-overlay__nav-button" data-game-rules="true" type="button" aria-label="${escapeHtml(rulesLabel)}">`,
    `    <span class="route-overlay__nav-icon">${helpIconHtml}</span>`,
    "  </button>",
    '  <div class="route-overlay__nav game-overlay__nav">',
    ...items.map(
      (item) => `    <button class="route-overlay__nav-item route-overlay__nav-button" data-game-action="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(item.label)}"><span class="route-overlay__nav-icon">${getActionIconHtml(item.id)}</span></button>`,
    ),
    "  </div>",
    "</div>",
  ].join("");
}
