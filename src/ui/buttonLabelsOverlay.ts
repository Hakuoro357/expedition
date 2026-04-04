export type ButtonLabelOverlayItem = {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createButtonLabelsOverlayHtml(labels: ButtonLabelOverlayItem[]): string {
  return [
    '<div class="button-labels-overlay">',
    ...labels.map(({ label, x, y, width, height }) => [
      `<div class="button-labels-overlay__label" style="left:${x - width / 2}px;top:${y - height / 2}px;width:${width}px;height:${height}px;">`,
      `  <span>${escapeHtml(label)}</span>`,
      "</div>",
    ].join("")),
    "</div>",
  ].join("");
}

