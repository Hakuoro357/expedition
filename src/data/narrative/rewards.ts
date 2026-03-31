import { rewardTextsGlobal } from "@/data/narrative/rewardTexts.global";
import { rewardTextsRu } from "@/data/narrative/rewardTexts.ru";

export type NarrativeRewardType =
  | "diary_page"
  | "map_piece"
  | "map_variant"
  | "map_marker"
  | "photo"
  | "photo_major"
  | "clue_note"
  | "lore_note"
  | "anonymous_note"
  | "paper_fragment"
  | "archive_note"
  | "archive_seal"
  | "artifact_fragment"
  | "artifact_case"
  | "artifact_case_major"
  | "personal_item"
  | "logistics_note"
  | "chapter_piece"
  | "finale_reward"
  | "stamp";

export type NarrativeReward = {
  rewardId: string;
  rewardType: NarrativeRewardType;
  collectibleArtifactId?: string;
};

const REWARDS: NarrativeReward[] = [
  { rewardId: "reward_diary_page_01", rewardType: "diary_page" },
  { rewardId: "reward_expedition_stamp_01", rewardType: "stamp", collectibleArtifactId: "compass" },
  { rewardId: "reward_map_piece_01", rewardType: "map_piece", collectibleArtifactId: "old-map" },
  { rewardId: "reward_camp_marker_01", rewardType: "map_marker" },
  { rewardId: "reward_stone_sign_note_01", rewardType: "clue_note" },
  { rewardId: "reward_unknown_item_01", rewardType: "artifact_fragment", collectibleArtifactId: "explorer-badge" },
  { rewardId: "reward_photo_ridge_01", rewardType: "photo" },
  { rewardId: "reward_map_variant_01", rewardType: "map_variant" },
  { rewardId: "reward_map_piece_02", rewardType: "map_piece" },
  { rewardId: "reward_chapter_piece_01", rewardType: "chapter_piece" },
  { rewardId: "reward_diary_page_damaged_01", rewardType: "diary_page" },
  { rewardId: "reward_map_variant_02", rewardType: "map_variant" },
  { rewardId: "reward_levin_note_01", rewardType: "lore_note", collectibleArtifactId: "pickaxe" },
  { rewardId: "reward_hidden_camp_marker_01", rewardType: "map_marker" },
  { rewardId: "reward_torn_paper_01", rewardType: "paper_fragment" },
  { rewardId: "reward_anonymous_note_01", rewardType: "anonymous_note", collectibleArtifactId: "field-journal" },
  { rewardId: "reward_false_map_piece_01", rewardType: "map_piece" },
  { rewardId: "reward_artifact_case_01", rewardType: "artifact_case", collectibleArtifactId: "lantern" },
  { rewardId: "reward_photo_key_01", rewardType: "photo" },
  { rewardId: "reward_chapter_piece_02", rewardType: "chapter_piece" },
  { rewardId: "reward_map_major_01", rewardType: "map_piece", collectibleArtifactId: "canoe-paddle" },
  { rewardId: "reward_diary_page_02", rewardType: "diary_page" },
  { rewardId: "reward_final_camp_scheme_01", rewardType: "map_piece" },
  { rewardId: "reward_personal_item_01", rewardType: "personal_item" },
  { rewardId: "reward_artifact_case_major_01", rewardType: "artifact_case_major", collectibleArtifactId: "fishing-rod" },
  { rewardId: "reward_group_photo_final_01", rewardType: "photo_major" },
  { rewardId: "reward_logistics_note_01", rewardType: "logistics_note" },
  { rewardId: "reward_archive_note_01", rewardType: "archive_note" },
  { rewardId: "reward_archive_seal_01", rewardType: "archive_seal", collectibleArtifactId: "camp-kettle" },
  { rewardId: "reward_finale_bundle_01", rewardType: "finale_reward" },
];

export function getRewardById(rewardId: string): NarrativeReward | undefined {
  return REWARDS.find((reward) => reward.rewardId === rewardId);
}

export function getRewardDisplayText(rewardId: string, locale: "ru" | "global") {
  return locale === "ru"
    ? rewardTextsRu[rewardId as keyof typeof rewardTextsRu]
    : rewardTextsGlobal[rewardId as keyof typeof rewardTextsGlobal];
}
