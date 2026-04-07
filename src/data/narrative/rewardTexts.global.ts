import { getNamingValue } from "@/data/naming";

const expeditionNameGlobal = getNamingValue("expedition_name", "en");
const artifactMainGlobal = getNamingValue("artifact_main", "en");

export const rewardTextsGlobal = {
  reward_diary_page_01: { title: "First Diary Page", description: "The expedition’s voice appears for the first time." },
  reward_expedition_stamp_01: { title: "Expedition Stamp", description: `Proof that the file of ${expeditionNameGlobal} is real, not a legend.` },
  reward_map_piece_01: { title: "First Map Fragment", description: "The route begins to take shape." },
  reward_camp_marker_01: { title: "Camp Marker", description: "Another fixed point on the real path." },
  reward_stone_sign_note_01: { title: "Stone Marker Note", description: "A quiet clue to the guiding system." },
  reward_unknown_item_01: { title: "Unlisted Object", description: "A find missing from the official record." },
  reward_photo_ridge_01: { title: "Ridge Approach Photo", description: "Visual evidence saved for a future reader." },
  reward_map_variant_01: { title: "Conflicting Route Scheme", description: "The first clear sign of a split route." },
  reward_map_piece_02: { title: "Additional Map Fragment", description: "The official line looks less convincing." },
  reward_chapter_piece_01: { title: "Chapter Key Fragment", description: "The hidden layer of the first chapter opens." },
  reward_diary_page_damaged_01: { title: "Damaged Diary Page", description: "The tone of the record changes." },
  reward_map_variant_02: { title: "Double-Line Map", description: "Two paths become visible at once." },
  reward_levin_note_01: { title: "Mercer’s Note", description: "The scale of the find becomes clearer." },
  reward_hidden_camp_marker_01: { title: "Hidden Camp Marker", description: "A deliberate shift in the route is confirmed." },
  reward_torn_paper_01: { title: "Torn Working Sheet", description: "The records stop behaving like a whole." },
  reward_anonymous_note_01: { title: "Unsigned Note", description: "An internal voice emerges from the archive." },
  reward_false_map_piece_01: { title: "False Map Fragment", description: "The decoy route becomes material." },
  reward_artifact_case_01: { title: "Artifact Case", description: `The main discovery starts to gain weight around the ${artifactMainGlobal}.` },
  reward_photo_key_01: { title: "Key Photograph", description: "A picture taken with future reading in mind." },
  reward_chapter_piece_02: { title: "Chapter Closing Fragment", description: "The concealment is no longer in doubt." },
  reward_map_major_01: { title: "Major Hidden Map Piece", description: "The true route starts assembling again." },
  reward_diary_page_02: { title: "Final Short Entry", description: "The diary narrows into pure precision." },
  reward_final_camp_scheme_01: { title: "Final Camp Scheme", description: "Preparation for the cache and the ending." },
  reward_personal_item_01: { title: "Personal Belonging", description: "A reminder of the people inside the choice." },
  reward_artifact_case_major_01: { title: "Disc Container", description: `The ${artifactMainGlobal} gains physical context.` },
  reward_group_photo_final_01: { title: "Final Group Photo", description: "Memory of the team, not just the result." },
  reward_logistics_note_01: { title: "Logistics Note", description: "Proof that the chosen way out was possible." },
  reward_archive_note_01: { title: "Archive Note", description: "Disappearance reveals itself as a process." },
  reward_archive_seal_01: { title: "Archive Seal", description: `The final permission to close the file of ${expeditionNameGlobal}.` },
  reward_finale_bundle_01: { title: "Completed Archive", description: `The ${artifactMainGlobal}, the full map, and the restored story.` },
} as const;
