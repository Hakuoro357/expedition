/**
 * UI metadata for achievements — display-only.
 *
 * Separated from `ACHIEVEMENTS` (compute meta in `src/data/achievements.ts`)
 * so the runtime compute pipeline stays pure and overlay rendering reads
 * only display fields. Per v0.3.58 plan R1-C2 + R4 codex-M3.
 *
 * Icon filename is **always derived from `tag`** — no `iconKey` field
 * (one source of truth). Hidden achievements use shared `locked-generic.png`
 * when locked; non-hidden locked use `<tag>.png` with CSS opacity 0.5.
 *
 * Group ordering and per-group `order` field drives the AchievementsScene
 * layout. `titleKey` / `descriptionKey` are looked up in `i18n.t(key)`.
 */

export type GroupTag =
  | "path"
  | "archive"
  | "voices"
  | "mastery"
  | "equipment"
  | "community";

export type AchievementUiMeta = {
  /** Stable id — matches `ACHIEVEMENTS[i].tag` 1:1 (enforced by parity test). */
  tag: string;
  groupTag: GroupTag;
  /** Sort order within the group (1-based). */
  order: number;
  titleKey: string;
  descriptionKey: string;
};

/** Group ordering for AchievementsScene rendering. */
export const ACHIEVEMENT_GROUPS: Array<{ tag: GroupTag; titleKey: string }> = [
  { tag: "path", titleKey: "ach_group_path" },
  { tag: "archive", titleKey: "ach_group_archive" },
  { tag: "voices", titleKey: "ach_group_voices" },
  { tag: "mastery", titleKey: "ach_group_mastery" },
  { tag: "equipment", titleKey: "ach_group_equipment" },
  { tag: "community", titleKey: "ach_group_community" },
];

export const ACHIEVEMENT_UI_META: AchievementUiMeta[] = [
  // Path (5)
  { tag: "first_win", groupTag: "path", order: 1, titleKey: "ach_first_win_title", descriptionKey: "ach_first_win_description" },
  { tag: "chapter_1_complete", groupTag: "path", order: 2, titleKey: "ach_chapter_1_complete_title", descriptionKey: "ach_chapter_1_complete_description" },
  { tag: "chapter_2_complete", groupTag: "path", order: 3, titleKey: "ach_chapter_2_complete_title", descriptionKey: "ach_chapter_2_complete_description" },
  { tag: "chapter_3_complete", groupTag: "path", order: 4, titleKey: "ach_chapter_3_complete_title", descriptionKey: "ach_chapter_3_complete_description" },
  { tag: "epilogue", groupTag: "path", order: 5, titleKey: "ach_epilogue_title", descriptionKey: "ach_epilogue_description" },

  // Archive (3)
  { tag: "first_artifact", groupTag: "archive", order: 1, titleKey: "ach_first_artifact_title", descriptionKey: "ach_first_artifact_description" },
  { tag: "first_entry", groupTag: "archive", order: 2, titleKey: "ach_first_entry_title", descriptionKey: "ach_first_entry_description" },
  { tag: "all_artifacts", groupTag: "archive", order: 3, titleKey: "ach_all_artifacts_title", descriptionKey: "ach_all_artifacts_description" },

  // Voices (5)
  { tag: "entries_voronov", groupTag: "voices", order: 1, titleKey: "ach_entries_voronov_title", descriptionKey: "ach_entries_voronov_description" },
  { tag: "entries_levin", groupTag: "voices", order: 2, titleKey: "ach_entries_levin_title", descriptionKey: "ach_entries_levin_description" },
  { tag: "entries_mirskaya", groupTag: "voices", order: 3, titleKey: "ach_entries_mirskaya_title", descriptionKey: "ach_entries_mirskaya_description" },
  { tag: "entries_klimova", groupTag: "voices", order: 4, titleKey: "ach_entries_klimova_title", descriptionKey: "ach_entries_klimova_description" },
  { tag: "entries_rudenko", groupTag: "voices", order: 5, titleKey: "ach_entries_rudenko_title", descriptionKey: "ach_entries_rudenko_description" },

  // Mastery (2)
  { tag: "no_undo_win", groupTag: "mastery", order: 1, titleKey: "ach_no_undo_win_title", descriptionKey: "ach_no_undo_win_description" },
  { tag: "no_hint_win", groupTag: "mastery", order: 2, titleKey: "ach_no_hint_win_title", descriptionKey: "ach_no_hint_win_description" },

  // Equipment (3)
  { tag: "coins_500", groupTag: "equipment", order: 1, titleKey: "ach_coins_500_title", descriptionKey: "ach_coins_500_description" },
  { tag: "coins_1000", groupTag: "equipment", order: 2, titleKey: "ach_coins_1000_title", descriptionKey: "ach_coins_1000_description" },
  { tag: "coins_2000", groupTag: "equipment", order: 3, titleKey: "ach_coins_2000_title", descriptionKey: "ach_coins_2000_description" },

  // Community (3)
  { tag: "first_share", groupTag: "community", order: 1, titleKey: "ach_first_share_title", descriptionKey: "ach_first_share_description" },
  { tag: "first_community_join", groupTag: "community", order: 2, titleKey: "ach_first_community_join_title", descriptionKey: "ach_first_community_join_description" },
  { tag: "patron", groupTag: "community", order: 3, titleKey: "ach_patron_title", descriptionKey: "ach_patron_description" },
];
