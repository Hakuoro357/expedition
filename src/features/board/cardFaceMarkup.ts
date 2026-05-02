import type { Card, Suit } from "@/core/cards/types";
import type { Locale } from "@/services/i18n/locales";
import { getRankLabel } from "@/assets/cards/cardFaceSvg";

function getSuitFill(suit: Suit): string {
  return suit === "diamonds" || suit === "hearts" ? "#b14955" : "#161616";
}

function getCornerSuitChar(suit: Suit): string {
  switch (suit) {
    case "spades":
      return "♠";
    case "clubs":
      return "♣";
    case "diamonds":
      return "♦";
    case "hearts":
      return "♥";
  }
}

function getCornerSuitFontSize(_suit: Suit): number {
  // 14px — совпадает с размером ранга (см. createCornerIndexMarkup),
  // чтобы «5» и «♣» в уголке смотрелись как единый блок одной высоты,
  // а не «маленький номинал + большая масть».
  return 14;
}

function getCenterSuitChar(suit: Suit): string {
  switch (suit) {
    case "spades":
      return "♠";
    case "clubs":
      return "♣";
    case "diamonds":
      return "♦";
    case "hearts":
      return "♥";
  }
}

function getCenterSuitFontSize(suit: Suit): number {
  // Уменьшено с 34/29 до 26/22 (v0.3.41) — после увеличения уголка до
  // 14px центральная масть выглядела непропорционально большой,
  // визуально «давила» уголки. Теперь центр спокойнее, уголки
  // читаются как полноценные индикаторы. diamonds чуть меньше
  // (тоньше глиф у ромба → нужен меньший кегль для оптического баланса).
  return suit === "diamonds" ? 22 : 26;
}

function getCenterSuitY(suit: Suit): number {
  // Adjusted for text baseline alignment, moved up slightly
  switch (suit) {
    case "spades":
      return 33.5;
    case "clubs":
      return 33.0;
    case "diamonds":
      return 33.5;
    case "hearts":
      return 33.5;
  }
}

function getCenterSuitMarkup(suit: Suit, color: string): string {
  const char = getCenterSuitChar(suit);
  const fontSize = getCenterSuitFontSize(suit);
  return `
    <text
      x="0"
      y="0"
      fill="${color}"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${fontSize}"
      text-anchor="middle"
      dominant-baseline="central"
      text-rendering="geometricPrecision"
    >${char}</text>
  `.trim();
}

function createCornerIndexMarkup(rankLabel: string, suit: Suit, suitFill: string): string {
  // Шрифт ранга — Georgia (серифный), 14px, bold. До v0.3.41 был
  // 'Trebuchet MS' 12px: пользователи жаловались, что русское «В»
  // (Валет) при таком размере и весе путается с «8» — у обоих
  // визуальная структура «два округлых элемента по вертикали», и
  // тонкий вертикальный штрих «В» в санс-серифе сливается с бумпами.
  // Аналогичная проблема с латинским «J» (хук снизу) и в меньшей
  // степени с турецким «V». Georgia c серифами и контрастом штрихов
  // даёт «В/J/V» силуэт, явно отличный от «8», а +2px размера
  // повышают разборчивость без поломки лейаута уголка.
  return `
    <text
      x="0"
      y="0"
      fill="${suitFill}"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="14"
      font-weight="700"
      text-rendering="geometricPrecision"
      dominant-baseline="middle"
      letter-spacing="0"
    ><tspan>${rankLabel}</tspan><tspan dx="2" font-family="Georgia, 'Times New Roman', serif" font-size="${getCornerSuitFontSize(suit)}" dominant-baseline="middle">${getCornerSuitChar(suit)}</tspan></text>
  `.trim();
}

// Кэш SVG-разметки карт. Разметка зависит только от (rank, suit, locale,
// selected) и за всю партию может повторяться сотни раз — пересоздавать
// строку каждый раз дорого, особенно при перерисовке overlay 60 fps под
// перетаскивание. Максимум 13 × 4 × 3 × 2 = 312 уникальных вариантов.
const markupCache = new Map<string, string>();

export function createCardFaceSvgMarkup(card: Card, selected = false, locale: Locale = "en"): string {
  const cacheKey = `${locale}|${card.rank}|${card.suit}|${selected ? "1" : "0"}`;
  const cached = markupCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const rankLabel = getRankLabel(card.rank, locale);
  const suitFill = getSuitFill(card.suit);
  const stroke = selected ? "#e3a34f" : "#dac9a1";
  const cornerIndexMarkup = createCornerIndexMarkup(rankLabel, card.suit, suitFill);
  const centerSuitMarkup = getCenterSuitMarkup(card.suit, suitFill);

  const markup = `
    <svg class="game-overlay__dom-card-svg" viewBox="0 0 44 70" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0.75" y="0.75" width="42.5" height="68.5" rx="4.5" fill="#f7ecd8" stroke="${stroke}" stroke-width="1.5"/>
      <g transform="translate(4.5 10.5)">
        ${cornerIndexMarkup}
      </g>
      <g transform="translate(22 ${getCenterSuitY(card.suit)})">
        ${centerSuitMarkup}
      </g>
      <g transform="translate(39.5 59.5) rotate(180)">
        ${cornerIndexMarkup}
      </g>
    </svg>
  `.trim();

  markupCache.set(cacheKey, markup);
  return markup;
}
