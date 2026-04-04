function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type ArtifactCardOverlayParams = {
  title: string;
  description: string;
};

function estimateWrappedLines(text: string, maxCharsPerLine = 30): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  let lines = 1;
  let currentLineLength = 0;

  for (const word of words) {
    const nextLength = currentLineLength === 0
      ? word.length
      : currentLineLength + 1 + word.length;

    if (nextLength > maxCharsPerLine) {
      lines += 1;
      currentLineLength = word.length;
      continue;
    }

    currentLineLength = nextLength;
  }

  return lines;
}

export function getArtifactCardLayout(description: string): {
  closeButtonY: number;
} {
  const lineCount = estimateWrappedLines(description);

  return {
    closeButtonY: lineCount >= 3 ? 596 : 566,
  };
}

export function createArtifactCardOverlayHtml({
  title,
  description,
}: ArtifactCardOverlayParams): string {
  return [
    '<div class="artifact-card-overlay">',
    `  <div class="artifact-card-overlay__title">${escapeHtml(title)}</div>`,
    '  <div class="artifact-card-overlay__copy">',
    `    <div class="artifact-card-overlay__description">${escapeHtml(description)}</div>`,
    "  </div>",
    "</div>",
  ].join("");
}
