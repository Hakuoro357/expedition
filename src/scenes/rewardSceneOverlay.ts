import { createAppNavHtml, type AppNavItem } from "@/ui/appNavHtml";
import { safeImageUrl } from "@/ui/safeUrl";

import { escapeHtml } from "@/ui/escapeHtml";

export type RewardRevealType = "entry" | "artifact";

type RewardRevealItem = {
  type: RewardRevealType;
  id: string;
  title: string;
  badgeLabel: string;
  subtitle?: string;
  mediaUrl?: string;
};

export type RewardOverlayRevealItem = RewardRevealItem;

function createMediaHtml(item: RewardRevealItem): string {
  if (!item.mediaUrl) {
    return "";
  }

  return `<img class="reward-overlay__found-card-media-image" src="${escapeHtml(safeImageUrl(item.mediaUrl))}" alt="">`;
}

type RewardOverlayParams = {
  title: string;
  coinsLabel?: string;
  chapterProgressLabel?: string;
  foundTitle?: string;
  revealItems?: RewardRevealItem[];
  rewardLines?: string[];
  adLabel?: string;
  adDisabled?: boolean;
  continueLabel?: string;
  adStatus?: string;
  navItems: AppNavItem[];
};

export function createRewardOverlayHtml({
  title,
  coinsLabel,
  chapterProgressLabel,
  foundTitle,
  revealItems,
  rewardLines,
  adLabel,
  adDisabled,
  continueLabel,
  adStatus,
  navItems,
}: RewardOverlayParams): string {
  const hasRevealItems = Boolean(revealItems?.length);

  return [
    '<div class="reward-overlay">',
    `  <div class="reward-overlay__title">${escapeHtml(title)}</div>`,
    hasRevealItems
      ? [
          '  <div class="reward-overlay__summary">',
          coinsLabel ? `    <div class="reward-overlay__coins">${escapeHtml(coinsLabel)}</div>` : "",
          chapterProgressLabel
            ? `    <div class="reward-overlay__chapter-progress">${escapeHtml(chapterProgressLabel)}</div>`
            : "",
          "  </div>",
          '  <section class="reward-overlay__found">',
          `    <div class="reward-overlay__found-title">${escapeHtml(foundTitle ?? "")}</div>`,
          '    <div class="reward-overlay__found-list">',
          ...(revealItems ?? []).map(
            (item) => `
      <article class="reward-overlay__found-card reward-overlay__found-card--${escapeHtml(item.type)}" data-reveal-id="${escapeHtml(item.id)}" data-reveal-type="${escapeHtml(item.type)}">
        <span class="reward-overlay__found-card-media">
          ${createMediaHtml(item)}
        </span>
        <span class="reward-overlay__found-card-copy">
          <span class="reward-overlay__found-card-badge">${escapeHtml(item.badgeLabel)}</span>
          <span class="reward-overlay__found-card-title">${escapeHtml(item.title)}</span>
          ${item.subtitle ? `<span class="reward-overlay__found-card-subtitle">${escapeHtml(item.subtitle)}</span>` : ""}
        </span>
      </article>`
          ),
          "    </div>",
          "  </section>",
        ].join("")
      : [
          '  <div class="reward-overlay__lines">',
          ...(rewardLines ?? []).map(
            (line) => `    <div class="reward-overlay__line">${escapeHtml(line)}</div>`
          ),
          "  </div>",
        ].join(""),
    '  <div class="reward-overlay__buttons">',
    adLabel
      ? `    <button class="modal-btn${adDisabled ? " modal-btn--disabled" : ""}" data-reward-ad type="button">${escapeHtml(adLabel)}</button>`
      : "",
    continueLabel
      ? `    <button class="modal-btn modal-btn--primary" data-reward-continue type="button">${escapeHtml(continueLabel)}</button>`
      : "",
    "  </div>",
    adStatus
      ? `  <div class="reward-overlay__ad-status">${escapeHtml(adStatus)}</div>`
      : "",
    createAppNavHtml(navItems),
    "</div>",
  ].join("");
}
