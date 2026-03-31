import type { ChapterId } from "@/data/naming";
import type { NarrativePoint } from "@/data/narrative/types";

const CHAPTER_IDS: ChapterId[] = ["chapter_01", "chapter_02", "chapter_03"];

const REWARD_IDS: string[] = [
  "reward_diary_page_01",
  "reward_expedition_stamp_01",
  "reward_map_piece_01",
  "reward_camp_marker_01",
  "reward_stone_sign_note_01",
  "reward_unknown_item_01",
  "reward_photo_ridge_01",
  "reward_map_variant_01",
  "reward_map_piece_02",
  "reward_chapter_piece_01",
  "reward_diary_page_damaged_01",
  "reward_map_variant_02",
  "reward_levin_note_01",
  "reward_hidden_camp_marker_01",
  "reward_torn_paper_01",
  "reward_anonymous_note_01",
  "reward_false_map_piece_01",
  "reward_artifact_case_01",
  "reward_photo_key_01",
  "reward_chapter_piece_02",
  "reward_map_major_01",
  "reward_diary_page_02",
  "reward_final_camp_scheme_01",
  "reward_personal_item_01",
  "reward_artifact_case_major_01",
  "reward_group_photo_final_01",
  "reward_logistics_note_01",
  "reward_archive_note_01",
  "reward_archive_seal_01",
  "reward_finale_bundle_01",
];

export const NARRATIVE_POINTS: NarrativePoint[] = REWARD_IDS.map((rewardId, index) => {
  const chapterIndex = Math.floor(index / 10);
  const nodeIndex = (index % 10) + 1;
  const serial = String(index + 1).padStart(2, "0");

  return {
    pointId: `pt_${serial}`,
    chapterId: CHAPTER_IDS[chapterIndex] ?? "chapter_01",
    dealId: `c${chapterIndex + 1}n${nodeIndex}`,
    entryId: `entry_${serial}`,
    rewardId,
  };
});

export function getPointByDealId(dealId: string): NarrativePoint | undefined {
  return NARRATIVE_POINTS.find((point) => point.dealId === dealId);
}

export function getPointByPointId(pointId: string): NarrativePoint | undefined {
  return NARRATIVE_POINTS.find((point) => point.pointId === pointId);
}
