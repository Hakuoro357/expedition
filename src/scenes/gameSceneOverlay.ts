import homeIconHtml from "../assets/ui/nav-icons/home.svg?raw";
import undoIconHtml from "../assets/ui/nav-icons/undo.svg?raw";
import hintIconHtml from "../assets/ui/nav-icons/hint.svg?raw";
import settingsIconHtml from "../assets/ui/nav-icons/settings.svg?raw";
import type { Card } from "@/core/cards/types";
import type { Locale } from "@/services/i18n/locales";
import { createCardFaceSvgMarkup } from "@/features/board/cardFaceMarkup";

import { escapeHtml } from "@/ui/escapeHtml";
import { COIN_ICON_HTML, COIN_TOKEN, expandCoinTokens } from "@/ui/coinIcon";

type GameActionId = "undo" | "hint" | "settings" | "home";
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

function getActionIconHtml(id: GameActionId): string {
  switch (id) {
    case "undo":
      return undoIconHtml;
    case "hint":
      return hintIconHtml;
    case "settings":
      return settingsIconHtml;
    case "home":
      return homeIconHtml;
  }
}

/**
 * Круглая кнопка-вопросик в правом верхнем углу — открывает правила.
 * Inline SVG: круг + «?» с currentColor, легко перекрашивается через CSS.
 */
const RULES_QUESTION_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

type GameSceneOverlayParams = {
  title: string;
  subtitle: string;
  coinsLabel: string;
  wasteHasCard: boolean;
  wasteActive: boolean;
  foundationSlots: GameFoundationSlot[];
  undoLabel: string;
  hintLabel: string;
  /**
   * Visually and functionally disable the hint button. Set when a hint
   * highlight is currently showing — prevents the tester from clicking
   * several times in a row and paying `cost` twice per hint.
   */
  hintDisabled?: boolean;
  /** Текст aria-label для `?`-кнопки в правом верхнем углу (Правила). */
  rulesLabel: string;
  /** Label кнопки настроек, заменившей правила в нижнем баре. */
  settingsLabel?: string;
  homeLabel: string;
  cards: GameOverlayCard[];
  dragCards: GameOverlayCard[];
  stockCardBackSvg?: string;
  cardBackSvg?: string;
  faceDownCards?: GameOverlayFaceDownCard[];
  emptyTableauSlots?: GameOverlayEmptySlot[];
  locale?: Locale;
};

function createTopRowHtml(
  wasteHasCard: boolean,
  wasteActive: boolean,
  foundationSlots: GameFoundationSlot[],
  stockCardBackSvg?: string,
): string {
  // Stock slot: use same class as tableau cards (.game-overlay__dom-card) to guarantee 48x76 size.
  // Position it manually since .game-overlay__dom-card is absolute.
  const stockLeft = 15; // Matches TABLEAU_START_X - CARD_WIDTH/2
  const stockTop = 100; // Matches TOP_ROW_Y - CARD_HEIGHT/2

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

function createCardsHtml(cards: GameOverlayCard[], locale: Locale): string {
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
          ${createCardFaceSvgMarkup(card, selected, locale)}
        </div>`,
    ),
    "</div>",
  ].join("");
}

function createDragCardsHtml(cards: GameOverlayCard[], locale: Locale): string {
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
          ${createCardFaceSvgMarkup(card, selected, locale)}
        </div>`,
    ),
    "</div>",
  ].join("");
}

// Fix SVG aspect ratio to match card dimensions (48x76 ≈ 0.63).
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
  wasteHasCard,
  wasteActive,
  foundationSlots,
  undoLabel,
  hintLabel,
  hintDisabled,
  rulesLabel,
  settingsLabel = "Settings",
  homeLabel,
  cards,
  dragCards,
  stockCardBackSvg,
  cardBackSvg,
  faceDownCards,
  emptyTableauSlots,
  locale = "en",
}: GameSceneOverlayParams): string {
  // Порядок [undo, hint, home, settings] — «Меню» (ex-«Настройки»)
  // находится в правом нижнем углу, thumb-zone. Единая позиция на всех
  // сценах: MapScene/DiaryScene/SettingsScene bottom-nav тоже имеют
  // «Меню» третьим (правым) элементом.
  const items: Array<{ id: GameActionId; label: string; disabled?: boolean }> = [
    { id: "undo", label: undoLabel },
    { id: "hint", label: hintLabel, disabled: hintDisabled },
    { id: "home", label: homeLabel },
    { id: "settings", label: settingsLabel },
  ];

  const html = [
    '<div class="game-overlay">',
    `  <div class="game-overlay__coins">${COIN_ICON_HTML}<span class="game-overlay__coins-value">${escapeHtml(coinsLabel)}</span></div>`,
    // Круглая «?» кнопка в правом верхнем углу — открывает правила игры.
    // Перенесена из нижнего action-bar'а, чтобы освободить слот под
    // Settings (пожелание тестировщиков — управлять звуком во время
    // партии, не покидая сцену).
    `  <button class="game-overlay__rules-btn" type="button" data-game-action="rules" aria-label="${escapeHtml(rulesLabel)}">${RULES_QUESTION_ICON}</button>`,
    '  <div class="game-overlay__header">',
    `    <div class="game-overlay__title">${escapeHtml(title)}</div>`,
    (subtitle ? `    <div class="game-overlay__subtitle">${escapeHtml(subtitle)}</div>` : ""),
    "  </div>",
    `  ${createTopRowHtml(wasteHasCard, wasteActive, foundationSlots, stockCardBackSvg)}`,
    `  <div class="game-overlay__status" data-game-status="true"></div>`,
    `  ${createEmptyTableauSlotsHtml(emptyTableauSlots ?? [])}`,
    `  ${createFaceDownCardsHtml(faceDownCards ?? [], cardBackSvg)}`,
    `  ${createCardsHtml(cards, locale)}`,
    `  ${createDragCardsHtml(dragCards, locale)}`,
    '  <div class="game-overlay__nav">',
    ...items.map((item) => {
      // COIN_TOKEN внутри aria-label раскроется в <span class="coin-icon">
      // с кавычками — это сломает атрибут. В aria оставляем только текст,
      // а видимый лейбл раскрывается через expandCoinTokens ниже.
      const ariaLabel = item.label.split(COIN_TOKEN).join("").replace(/\s+/g, " ").trim();
      const disabledAttr = item.disabled ? ' disabled aria-disabled="true"' : "";
      const disabledClass = item.disabled ? " game-overlay__action--disabled" : "";
      return `    <button class="game-overlay__action game-overlay__action--${escapeHtml(item.id)}${disabledClass}" data-game-action="${escapeHtml(item.id)}" type="button" aria-label="${escapeHtml(ariaLabel)}"${disabledAttr}><span class="game-overlay__action-icon">${getActionIconHtml(item.id)}</span><span class="game-overlay__action-label">${escapeHtml(item.label)}</span></button>`;
    }),
    "  </div>",
    "</div>",
  ].join("");
  return expandCoinTokens(html);
}
