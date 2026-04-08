import { createAppNavHtml, type AppNavItem } from "@/ui/appNavHtml";
import { safeImageUrl } from "@/ui/safeUrl";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type ArchiveTabId = "entries" | "artifacts";

type ArchiveEntryItem = {
  entryId: string;
  pointId: string;
  pointLabel: string;
  author: string;
  initials: string;
  accent: string;
  portraitUrl: string | undefined;
  excerpt: string;
};

type ArchiveOverlayParams = {
  title: string;
  activeTab: ArchiveTabId;
  entriesLabel: string;
  artifactsLabel: string;
  emptyEntriesLabel: string;
  emptyArtifactsLabel: string;
  entryItems: ArchiveEntryItem[];
  artifactCount: number;
  navItems: AppNavItem[];
};

function createPortraitHtml(
  baseClass: string,
  initials: string,
  accent: string,
  portraitUrl?: string,
): string {
  return portraitUrl
    ? `<span class="${baseClass}" style="--archive-portrait-accent:${escapeHtml(accent)}"><img class="${baseClass}-image" src="${escapeHtml(safeImageUrl(portraitUrl))}" alt=""></span>`
    : `<span class="${baseClass}" style="--archive-portrait-accent:${escapeHtml(accent)}">${escapeHtml(initials)}</span>`;
}

export function createArchiveOverlayHtml({
  title,
  activeTab,
  entriesLabel,
  artifactsLabel,
  emptyEntriesLabel,
  emptyArtifactsLabel,
  entryItems,
  artifactCount,
  navItems,
}: ArchiveOverlayParams): string {
  const entriesHtml =
    activeTab === "entries"
      ? [
          '<div class="archive-overlay__entries-list">',
          ...(entryItems.length > 0
            ? entryItems.map(
                (item) => `
              <button class="archive-overlay__entry-card" data-archive-entry="${escapeHtml(item.entryId)}" type="button">
                ${createPortraitHtml("archive-overlay__entry-portrait", item.initials, item.accent, item.portraitUrl)}
                <span class="archive-overlay__entry-copy">
                  <span class="archive-overlay__entry-point">${escapeHtml(item.pointLabel)}</span>
                  <span class="archive-overlay__entry-author">${escapeHtml(item.author)}</span>
                  <span class="archive-overlay__entry-excerpt">${escapeHtml(item.excerpt)}</span>
                </span>
              </button>`,
              )
            : [`<div class="archive-overlay__empty">${escapeHtml(emptyEntriesLabel)}</div>`]),
          "</div>",
        ].join("")
      : artifactCount > 0
        ? ""
        : `<div class="archive-overlay__empty archive-overlay__empty--artifacts">${escapeHtml(emptyArtifactsLabel)}</div>`;

  return [
    '<div class="archive-overlay">',
    `  <div class="archive-overlay__title">${escapeHtml(title)}</div>`,
    '  <div class="archive-overlay__tabs">',
    `    <button class="archive-overlay__tab${activeTab === "entries" ? " archive-overlay__tab--active" : ""}" data-archive-tab="entries" type="button">${escapeHtml(entriesLabel)}</button>`,
    `    <button class="archive-overlay__tab${activeTab === "artifacts" ? " archive-overlay__tab--active" : ""}" data-archive-tab="artifacts" type="button">${escapeHtml(artifactsLabel)}</button>`,
    "  </div>",
    entriesHtml,
    createAppNavHtml(navItems),
    "</div>",
  ].join("");
}
