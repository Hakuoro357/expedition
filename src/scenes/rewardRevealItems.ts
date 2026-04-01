import { getArtifactById } from "@/data/artifacts";
import { getNodeById } from "@/data/chapters";
import { getNarrativeEntry } from "@/data/narrative/entries";
import {
  getRewardById,
  getRewardDisplayText,
  type NarrativeRewardType,
} from "@/data/narrative/rewards";

export type RewardRevealType = "entry" | "artifact" | "map";

export type RewardRevealItem = {
  type: RewardRevealType;
  id: string;
  title: string;
  badgeLabel: string;
  subtitle?: string;
  description?: string;
};

export type BuildRewardRevealItemsParams = {
  dealId: string;
  rewardId: string;
  artifactAwarded: string | null;
  locale: "ru" | "global";
};

const MAP_REWARD_TYPES = [
  "map_piece",
  "map_variant",
  "map_marker",
  "chapter_piece",
] as const;

type MapRewardType = (typeof MAP_REWARD_TYPES)[number];

function isMapRewardType(rewardType: NarrativeRewardType): rewardType is MapRewardType {
  return MAP_REWARD_TYPES.includes(rewardType as MapRewardType);
}

function getPointLabel(pointId: string, locale: "ru" | "global"): string {
  const pointNumber = pointId.replace("pt_", "");
  return locale === "ru" ? `Точка ${pointNumber}` : `Point ${pointNumber}`;
}

export function buildRewardRevealItems({
  dealId,
  rewardId,
  artifactAwarded,
  locale,
}: BuildRewardRevealItemsParams): RewardRevealItem[] {
  const items: RewardRevealItem[] = [];
  const narrativeLocale = locale === "ru" ? "ru" : "global";
  const isRu = locale === "ru";
  const node = getNodeById(dealId);
  const validatedReward = node?.rewardId === rewardId ? getRewardById(rewardId) : undefined;
  const validatedMapReward =
    validatedReward && isMapRewardType(validatedReward.rewardType) ? validatedReward : undefined;
  const expectedArtifactId = validatedReward?.collectibleArtifactId ?? node?.artifactId ?? null;
  const suppressArtifactForMapReward = Boolean(validatedMapReward?.collectibleArtifactId);

  if (node?.entryId) {
    const entry = getNarrativeEntry(node.entryId, narrativeLocale);

    if (entry) {
      items.push({
        type: "entry",
        id: node.entryId,
        title: getPointLabel(node.pointId, locale),
        badgeLabel: isRu ? "Запись" : "Entry",
        subtitle: entry.body,
      });
    }
  }

  if (
    artifactAwarded != null &&
    expectedArtifactId != null &&
    artifactAwarded === expectedArtifactId &&
    !suppressArtifactForMapReward
  ) {
    const artifact = getArtifactById(artifactAwarded);

    if (artifact) {
      items.push({
        type: "artifact",
        id: artifact.id,
        title: isRu ? artifact.titleRu : artifact.titleEn,
        badgeLabel: isRu ? "Артефакт" : "Artifact",
        subtitle: isRu ? artifact.descriptionRu : artifact.descriptionEn,
      });
    }
  }

  if (validatedMapReward) {
    const rewardText = getRewardDisplayText(rewardId, narrativeLocale);

    if (rewardText) {
      items.push({
        type: "map",
        id: validatedMapReward.rewardId,
        title: rewardText.title,
        badgeLabel: isRu ? "Карта" : "Map",
        subtitle: rewardText.description,
      });
    }
  }

  return items;
}
