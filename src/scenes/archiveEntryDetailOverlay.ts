function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type ArchiveEntryDetailParams = {
  pointLabel: string;
  author: string;
  initials: string;
  accent: string;
  portraitUrl?: string;
  body: string;
};

function createPortraitHtml(
  initials: string,
  accent: string,
  portraitUrl?: string,
): string {
  return portraitUrl
    ? `<div class="archive-entry-detail-overlay__portrait" style="--archive-portrait-accent:${escapeHtml(accent)}"><img class="archive-entry-detail-overlay__portrait-image" src="${escapeHtml(portraitUrl)}" alt=""></div>`
    : `<div class="archive-entry-detail-overlay__portrait" style="--archive-portrait-accent:${escapeHtml(accent)}">${escapeHtml(initials)}</div>`;
}

export function createArchiveEntryDetailHtml({
  pointLabel,
  author,
  initials,
  accent,
  portraitUrl,
  body,
}: ArchiveEntryDetailParams): string {
  return [
    '<div class="archive-entry-detail-overlay">',
    `  <div class="archive-entry-detail-overlay__eyebrow">${escapeHtml(pointLabel)}</div>`,
    `  ${createPortraitHtml(initials, accent, portraitUrl)}`,
    `  <div class="archive-entry-detail-overlay__author">${escapeHtml(author)}</div>`,
    `  <div class="archive-entry-detail-overlay__body">${escapeHtml(body)}</div>`,
    "</div>",
  ].join("");
}
