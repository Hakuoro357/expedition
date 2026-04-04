import type { ChapterId } from "@/data/naming";

export type PointId = string;
export type EntryId = string;
export type RewardId = string;

export type NarrativePoint = {
  pointId: PointId;
  chapterId: ChapterId;
  dealId: string;
  entryId: EntryId;
  rewardId: RewardId;
  titleRu: string;
  titleEn: string;
};
