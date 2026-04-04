type RoutePointModalTab = "entry" | "artifact";

type EntryPanel = {
  author: string;
  body: string;
  portraitUrl?: string;
};

type ArtifactPanel = {
  title: string;
  description: string;
  imageKey: string;
};

type RoutePointModalParams = {
  pointLabel: string;
  closeLabel: string;
  activeTab: RoutePointModalTab;
  entry?: EntryPanel;
  artifact?: ArtifactPanel;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createTabsHtml(activeTab: RoutePointModalTab): string {
  return [
    '<div class="route-point-modal__tabs">',
    `  <div class="route-point-modal__tab${activeTab === "entry" ? " route-point-modal__tab--active" : ""}" data-route-point-tab="entry">Запись</div>`,
    `  <div class="route-point-modal__tab${activeTab === "artifact" ? " route-point-modal__tab--active" : ""}" data-route-point-tab="artifact">Артефакт</div>`,
    "</div>",
  ].join("");
}

function createEntryPortraitHtml(portraitUrl?: string): string {
  if (!portraitUrl) {
    return "";
  }

  return `<div class="route-point-modal__entry-portrait"><img class="route-point-modal__entry-portrait-image" src="${escapeHtml(portraitUrl)}" alt=""></div>`;
}

export function createRoutePointModalHtml({
  pointLabel,
  closeLabel,
  activeTab,
  entry,
  artifact,
}: RoutePointModalParams): string {
  const hasTabs = Boolean(entry && artifact);
  const contentHtml =
    activeTab === "artifact" && artifact
      ? [
          '<div class="route-point-modal__artifact">',
          `  <img class="route-point-modal__artifact-image" src="${escapeHtml(artifact.imageKey)}" alt="">`,
          `  <div class="route-point-modal__artifact-title">${escapeHtml(artifact.title)}</div>`,
          `  <div class="route-point-modal__artifact-description">${escapeHtml(artifact.description)}</div>`,
          "</div>",
        ].join("")
      : [
          '<div class="route-point-modal__entry">',
          `  ${createEntryPortraitHtml(entry?.portraitUrl)}`,
          `  <div class="route-point-modal__entry-author">${escapeHtml(entry?.author ?? "")}</div>`,
          `  <div class="route-point-modal__entry-body">${escapeHtml(entry?.body ?? "")}</div>`,
          "</div>",
        ].join("");

  return [
    '<div class="route-point-modal">',
    `  <div class="route-point-modal__point">${escapeHtml(pointLabel)}</div>`,
    hasTabs ? createTabsHtml(activeTab) : "",
    contentHtml,
    `  <div class="route-point-modal__close">${escapeHtml(closeLabel)}</div>`,
    "</div>",
  ].join("");
}
