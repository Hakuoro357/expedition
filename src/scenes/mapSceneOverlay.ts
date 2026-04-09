import { escapeHtml } from "@/ui/escapeHtml";
import { COIN_ICON_HTML } from "@/ui/coinIcon";

type MapOverlayParams = {
  title: string;
  expeditionName: string;
  subtitle: string;
  chapterLabel: string;
  coins: number;
  progressLabel: string;
};

export function createMapOverlayHtml({
  title,
  expeditionName,
  subtitle,
  chapterLabel,
  coins,
  progressLabel,
}: MapOverlayParams): string {
  const expeditionLine = expeditionName
    ? `  <div class="map-overlay__expedition">${escapeHtml(expeditionName)}</div>`
    : "";
  const subtitleLine = subtitle
    ? `    <div class="map-overlay__subtitle">${escapeHtml(subtitle)}</div>`
    : "";

  return [
    '<div class="map-overlay">',
    '  <div class="map-overlay__coins">',
    `    ${COIN_ICON_HTML}`,
    `    <span class="map-overlay__coin-count">${coins}</span>`,
    "  </div>",
    '  <div class="map-overlay__content">',
    `    <div class="map-overlay__title">${escapeHtml(title)}</div>`,
    expeditionLine,
    subtitleLine,
    `    <div class="map-overlay__chapter">${escapeHtml(chapterLabel)}</div>`,
    "  </div>",
    `  <div class="map-overlay__progress">${escapeHtml(progressLabel)}</div>`,
    "</div>",
  ].join("");
}
