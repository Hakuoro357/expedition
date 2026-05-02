import { createAppNavHtml, type AppNavItem } from "@/ui/appNavHtml";
import { safeImageUrl } from "@/ui/safeUrl";

import { escapeHtml } from "@/ui/escapeHtml";

export type DetailSceneTabId = "entry" | "artifact";

type DetailEntryContent = {
  pointLabel: string;
  author: string;
  initials: string;
  accent: string;
  portraitUrl?: string;
  body: string;
};

type DetailArtifactContent = {
  title: string;
  description: string;
  imageUrl?: string;
};

type DetailSceneOverlayParams = {
  homeLabel: string;
  navItems: AppNavItem[];
  activeTab: DetailSceneTabId;
  entryTabLabel: string;
  artifactTabLabel: string;
  entry?: DetailEntryContent;
  artifact?: DetailArtifactContent;
};

function createPortraitHtml(initials: string, accent: string, portraitUrl?: string): string {
  return portraitUrl
    ? `<div class="detail-page__portrait" style="--archive-portrait-accent:${escapeHtml(accent)}"><img class="detail-page__portrait-image" src="${escapeHtml(safeImageUrl(portraitUrl))}" alt=""></div>`
    : `<div class="detail-page__portrait" style="--archive-portrait-accent:${escapeHtml(accent)}">${escapeHtml(initials)}</div>`;
}

export function createDetailSceneOverlayHtml({
  homeLabel,
  navItems,
  activeTab,
  entryTabLabel,
  artifactTabLabel,
  entry,
  artifact,
}: DetailSceneOverlayParams): string {
  const hasTabs = Boolean(entry && artifact);
  const tabsHtml = hasTabs
    ? [
        '<div class="detail-page__tabs">',
        `  <button class="detail-page__tab${activeTab === "entry" ? " detail-page__tab--active" : ""}" data-detail-tab="entry" type="button">${escapeHtml(entryTabLabel)}</button>`,
        `  <button class="detail-page__tab${activeTab === "artifact" ? " detail-page__tab--active" : ""}" data-detail-tab="artifact" type="button">${escapeHtml(artifactTabLabel)}</button>`,
        "</div>",
      ].join("")
    : "";

  // Структура: .detail-page__panel обёртывает весь контент — заголовок+табы+
  // scroll-body + sticky-кнопка. Scroll происходит только внутри __scroll-body,
  // а кнопка «Назад» всегда видна снизу, не уезжает под фолд при длинном тексте.
  // Паттерн заимствован из PrologueScene (v0.3.26): flex column + min-height:0
  // на скролл-контейнере, flex-shrink:0 на кнопке. Fade-маска у scroll-body
  // снимается через .is-at-bottom когда пользователь доскроллил до конца.
  const entryBodyHtml =
    entry && activeTab === "entry"
      ? [
          `  <div class="detail-page__eyebrow">${escapeHtml(entry.pointLabel)}</div>`,
          `  ${createPortraitHtml(entry.initials, entry.accent, entry.portraitUrl)}`,
          `  <div class="detail-page__entry-author">${escapeHtml(entry.author)}</div>`,
          `  <div class="detail-page__entry-body">${escapeHtml(entry.body)}</div>`,
        ].join("")
      : "";

  const artifactBodyHtml =
    artifact && activeTab === "artifact"
      ? [
          `  <div class="detail-page__eyebrow">${escapeHtml(artifact.title)}</div>`,
          artifact.imageUrl
            ? `  <img class="detail-page__artifact-image" src="${escapeHtml(safeImageUrl(artifact.imageUrl))}" alt="">`
            : "",
          `  <div class="detail-page__artifact-description">${escapeHtml(artifact.description)}</div>`,
        ].join("")
      : "";

  const bodyContentHtml = entryBodyHtml || artifactBodyHtml;

  const rootClassName = [
    "detail-page",
    hasTabs ? "detail-page--with-tabs" : "",
    activeTab === "artifact" ? "detail-page--artifact" : "detail-page--entry",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    `<div class="${rootClassName}">`,
    '  <div class="detail-page__panel">',
    tabsHtml,
    `    <div class="detail-page__scroll-body" data-detail-scroll>${bodyContentHtml}</div>`,
    `    <button class="detail-page__home modal-btn modal-btn--primary" data-detail-home="true" type="button">${escapeHtml(homeLabel)}</button>`,
    "  </div>",
    createAppNavHtml(navItems),
    "</div>",
  ].join("");
}
