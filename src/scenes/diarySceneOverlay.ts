function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type DiaryRecentEntry = {
  chapterTitle: string;
  pointLabel: string;
};

type DiaryChapterProgress = {
  leftLabel: string;
  rightLabel: string;
  y: number;
  complete: boolean;
};

type DiaryOverlayParams = {
  title: string;
  coinsLabel: string;
  statsLabel: string;
  entriesLabel: string;
  latestTitle: string;
  latestBody: string;
  recentEntries: DiaryRecentEntry[];
  chapterProgress: DiaryChapterProgress[];
};

export function createDiaryOverlayHtml({
  title,
  coinsLabel,
  statsLabel,
  entriesLabel,
  latestTitle,
  latestBody,
  recentEntries,
  chapterProgress,
}: DiaryOverlayParams): string {
  return [
    '<div class="diary-overlay">',
    `  <div class="diary-overlay__title">${escapeHtml(title)}</div>`,
    `  <div class="diary-overlay__coins">${escapeHtml(coinsLabel)}</div>`,
    `  <div class="diary-overlay__stats">${escapeHtml(statsLabel)}</div>`,
    `  <div class="diary-overlay__entries-label">${escapeHtml(entriesLabel)}</div>`,
    `  <div class="diary-overlay__latest-title">${escapeHtml(latestTitle)}</div>`,
    `  <div class="diary-overlay__latest-body">${escapeHtml(latestBody)}</div>`,
    ...recentEntries.map((item, idx) =>
      `<div class="diary-overlay__recent-entry" style="top:${228 + idx * 16}px;">• ${escapeHtml(item.chapterTitle)} — ${escapeHtml(item.pointLabel)}</div>`
    ),
    ...chapterProgress.map((item) => [
      `<div class="diary-overlay__chapter-row" style="top:${item.y - 10}px;">`,
      `  <span class="diary-overlay__chapter-left">${escapeHtml(item.leftLabel)}</span>`,
      `  <span class="diary-overlay__chapter-right${item.complete ? " diary-overlay__chapter-right--complete" : ""}">${escapeHtml(item.rightLabel)}</span>`,
      "</div>",
    ].join("")),
    "</div>",
  ].join("");
}
