import { createAppNavHtml, type AppNavItem } from "@/ui/appNavHtml";
import { safeImageUrl } from "@/ui/safeUrl";

import { escapeHtml } from "@/ui/escapeHtml";

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

/** Один артефакт в HTML-листе вкладки «Артефакты». Структура зеркалит
 *  ArchiveEntryItem — на UI это карточка того же макета: квадратная
 *  картинка слева, заголовок и короткое описание справа. До v0.3.48
 *  артефакты рендерились Phaser-сеткой 3×3 без описаний; на коллаже
 *  плитки выглядели «голо», а в записях рядом был полный контекст —
 *  пользователь попросил привести к одному виду. */
type ArchiveArtifactItem = {
  artifactId: string;
  title: string;
  description: string;
  imageUrl: string | undefined;
};

type ArchiveOverlayParams = {
  title: string;
  activeTab: ArchiveTabId;
  entriesLabel: string;
  artifactsLabel: string;
  emptyEntriesLabel: string;
  emptyArtifactsLabel: string;
  entryItems: ArchiveEntryItem[];
  artifactItems: ArchiveArtifactItem[];
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
  artifactItems,
  navItems,
}: ArchiveOverlayParams): string {
  const tabHtml =
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
      : [
          '<div class="archive-overlay__entries-list">',
          ...(artifactItems.length > 0
            ? artifactItems.map(
                (item) => `
              <button class="archive-overlay__entry-card archive-overlay__artifact-card" data-archive-artifact="${escapeHtml(item.artifactId)}" type="button">
                <span class="archive-overlay__artifact-image-wrap">${item.imageUrl ? `<img class="archive-overlay__artifact-image" src="${escapeHtml(safeImageUrl(item.imageUrl))}" alt="">` : ""}</span>
                <span class="archive-overlay__entry-copy">
                  <span class="archive-overlay__entry-point">${escapeHtml(item.title)}</span>
                  <span class="archive-overlay__entry-excerpt">${escapeHtml(item.description)}</span>
                </span>
              </button>`,
              )
            : [`<div class="archive-overlay__empty">${escapeHtml(emptyArtifactsLabel)}</div>`]),
          "</div>",
        ].join("");

  return [
    '<div class="archive-overlay">',
    `  <div class="archive-overlay__title">${escapeHtml(title)}</div>`,
    '  <div class="archive-overlay__tabs">',
    `    <button class="archive-overlay__tab${activeTab === "entries" ? " archive-overlay__tab--active" : ""}" data-archive-tab="entries" type="button">${escapeHtml(entriesLabel)}</button>`,
    `    <button class="archive-overlay__tab${activeTab === "artifacts" ? " archive-overlay__tab--active" : ""}" data-archive-tab="artifacts" type="button">${escapeHtml(artifactsLabel)}</button>`,
    "  </div>",
    tabHtml,
    createAppNavHtml(navItems),
    "</div>",
  ].join("");
}
