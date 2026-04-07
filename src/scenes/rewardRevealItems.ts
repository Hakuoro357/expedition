import { getArtifactById } from "@/data/artifacts";
import { resolveArtifactGridUrl } from "@/data/artifactAssetUrls";
import { getNodeById } from "@/data/chapters";
import { getNarrativeEntry, getNarrativeEntryExcerpt } from "@/data/narrative/entries";
import { getPointTitleByPointId } from "@/data/narrative/points";
import { getNarrativeSpeakerProfile } from "@/data/narrative/speakers";
import { resolvePortraitUrl } from "@/data/portraitAssetUrls";
import {
  getRewardById,
} from "@/data/narrative/rewards";

export type RewardRevealType = "entry" | "artifact";

export type RewardRevealItem = {
  type: RewardRevealType;
  id: string;
  title: string;
  badgeLabel: string;
  subtitle?: string;
  description?: string;
  mediaUrl?: string;
};

export type BuildRewardRevealItemsParams = {
  dealId: string;
  rewardId: string;
  artifactAwarded: string | null;
  locale: "ru" | "global" | "tr";
};

export function buildRewardRevealItems({
  dealId,
  rewardId,
  artifactAwarded,
  locale,
}: BuildRewardRevealItemsParams): RewardRevealItem[] {
  const items: RewardRevealItem[] = [];
  const narrativeLocale = locale;
  const isRu = locale === "ru";
  const isTr = locale === "tr";
  const node = getNodeById(dealId);
  const validatedReward = node?.rewardId === rewardId ? getRewardById(rewardId) : undefined;
  const expectedArtifactId = validatedReward?.collectibleArtifactId ?? node?.artifactId ?? null;

  if (node?.entryId) {
    const entry = getNarrativeEntry(node.entryId, narrativeLocale);

    if (entry) {
      const speaker = getNarrativeSpeakerProfile(entry.speakerEntityId, narrativeLocale);
      items.push({
        type: "entry",
        id: node.entryId,
        title: getPointTitleByPointId(node.pointId, locale) ?? node.pointId,
        badgeLabel: isRu ? "Запись" : isTr ? "Kayıt" : "Entry",
        subtitle: getNarrativeEntryExcerpt(node.entryId, narrativeLocale) ?? entry.body,
        mediaUrl: resolvePortraitUrl(speaker.portraitKey),
      });
    }
  }

  if (
    artifactAwarded != null &&
    expectedArtifactId != null &&
    artifactAwarded === expectedArtifactId
  ) {
    const artifact = getArtifactById(artifactAwarded);

    if (artifact) {
      items.push({
        type: "artifact",
        id: artifact.id,
        title: isRu ? artifact.titleRu : isTr ? (artifact.titleTr ?? artifact.titleEn) : artifact.titleEn,
        badgeLabel: isRu ? "Артефакт" : isTr ? "Eser" : "Artifact",
        subtitle: isRu ? artifact.descriptionRu : isTr ? (artifact.descriptionTr ?? artifact.descriptionEn) : artifact.descriptionEn,
        mediaUrl: resolveArtifactGridUrl(artifact.imageKey),
      });
    }
  }

  return items;
}
