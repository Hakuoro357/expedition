import { getNarrativeSpeakerProfile, type NarrativeSpeakerLocale } from "@/data/narrative/speakers";
import { safeImageUrl } from "@/ui/safeUrl";

import { escapeHtml } from "@/ui/escapeHtml";

type RewardDetailLocale = NarrativeSpeakerLocale;

type EntryDetailParams = {
  pointLabel: string;
  author: string;
  portraitUrl?: string;
  body: string;
};

type MapDetailParams = {
  title: string;
  caption: string;
};

export function getNarrativeSpeakerName(
  speakerEntityId: string,
  locale: RewardDetailLocale
): string {
  return getNarrativeSpeakerProfile(speakerEntityId, locale).shortName;
}

function createPortraitHtml(portraitUrl?: string): string {
  if (!portraitUrl) {
    return "";
  }

  return `  <div class="reward-detail-overlay__portrait"><img class="reward-detail-overlay__portrait-image" src="${escapeHtml(safeImageUrl(portraitUrl))}" alt=""></div>`;
}

export function createRewardEntryDetailHtml({
  pointLabel,
  author,
  portraitUrl,
  body,
}: EntryDetailParams): string {
  return [
    '<div class="reward-detail-overlay reward-detail-overlay--entry">',
    `  <div class="reward-detail-overlay__eyebrow">${escapeHtml(pointLabel)}</div>`,
    createPortraitHtml(portraitUrl),
    `  <div class="reward-detail-overlay__author">${escapeHtml(author)}</div>`,
    `  <div class="reward-detail-overlay__body">${escapeHtml(body)}</div>`,
    "</div>",
  ].join("");
}

export function createRewardMapDetailHtml({
  title,
  caption,
}: MapDetailParams): string {
  return [
    '<div class="reward-detail-overlay reward-detail-overlay--map">',
    `  <div class="reward-detail-overlay__title">${escapeHtml(title)}</div>`,
    `  <div class="reward-detail-overlay__caption">${escapeHtml(caption)}</div>`,
    "</div>",
  ].join("");
}
