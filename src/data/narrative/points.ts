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

const POINT_TITLES = [
  { ru: "Карта пока не врёт", en: "The Map Isn't Lying Yet" },
  { ru: "Ящик без описи", en: "Crate Without Inventory" },
  { ru: "Линия по хребту", en: "Line Along the Ridge" },
  { ru: "Стоянка в сумерках", en: "Camp at Dusk" },
  { ru: "Второй кадр", en: "Second Frame" },
  { ru: "Чужая точность", en: "Foreign Precision" },
  { ru: "Отдельно от архива", en: "Separate from the Archive" },
  { ru: "Цифры не сошлись", en: "The Numbers Don't Match" },
  { ru: "Странный знак", en: "Strange Marker" },
  { ru: "Два маршрута", en: "Two Routes" },
  { ru: "Другой дневник", en: "A Different Diary" },
  { ru: "Полсантиметра южнее", en: "Half a Centimeter South" },
  { ru: "Последовательность", en: "The Sequence" },
  { ru: "Восемьсот метров", en: "Eight Hundred Meters" },
  { ru: "Решение без слов", en: "Decision Without Words" },
  { ru: "Между страницами", en: "Between the Pages" },
  { ru: "Ложная линия", en: "False Line" },
  { ru: "Вслух", en: "Out Loud" },
  { ru: "Послание", en: "The Message" },
  { ru: "Не могу назвать правильным", en: "Can't Call It Right" },
  { ru: "Единодушие маршрута", en: "Unanimous Route" },
  { ru: "Слишком точная запись", en: "Too Precise an Entry" },
  { ru: "Место для тайника", en: "A Place for the Cache" },
  { ru: "Других не осталось", en: "No Others Left" },
  { ru: "Графы не предусмотрено", en: "No Column for That" },
  { ru: "Групповой снимок", en: "Group Photograph" },
  { ru: "Цифры сошлись", en: "The Numbers Add Up" },
  { ru: "Шаг за шагом", en: "Step by Step" },
  { ru: "По линиям смысла", en: "Along the Lines of Meaning" },
  { ru: "Единственный ключ", en: "The Only Key" },
] as const;

export const NARRATIVE_POINTS: NarrativePoint[] = REWARD_IDS.map((rewardId, index) => {
  const chapterIndex = Math.floor(index / 10);
  const nodeIndex = (index % 10) + 1;
  const serial = String(index + 1).padStart(2, "0");
  const title = POINT_TITLES[index];

  return {
    pointId: `pt_${serial}`,
    chapterId: CHAPTER_IDS[chapterIndex] ?? "chapter_01",
    dealId: `c${chapterIndex + 1}n${nodeIndex}`,
    entryId: `entry_${serial}`,
    rewardId,
    titleRu: title?.ru ?? `Точка ${index + 1}`,
    titleEn: title?.en ?? `Point ${index + 1}`,
  };
});

export function getPointByDealId(dealId: string): NarrativePoint | undefined {
  return NARRATIVE_POINTS.find((point) => point.dealId === dealId);
}

export function getPointByPointId(pointId: string): NarrativePoint | undefined {
  return NARRATIVE_POINTS.find((point) => point.pointId === pointId);
}

export function getPointTitleByPointId(
  pointId: string,
  locale: "ru" | "en" | "global",
): string | undefined {
  const point = getPointByPointId(pointId);
  if (!point) {
    return undefined;
  }

  return locale === "ru" ? point.titleRu : point.titleEn;
}

export function getPointTitleByDealId(
  dealId: string,
  locale: "ru" | "en" | "global",
): string | undefined {
  const point = getPointByDealId(dealId);
  if (!point) {
    return undefined;
  }

  return locale === "ru" ? point.titleRu : point.titleEn;
}
