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
  { ru: "Выход в шесть двенадцать", en: "Departure at Six Twelve" },
  { ru: "Смещённые отметки", en: "Shifted Markers" },
  { ru: "Ложный гребень", en: "False Ridge" },
  { ru: "Камень у стоянки", en: "Stone by the Camp" },
  { ru: "Сменённая плёнка", en: "Changed Film" },
  { ru: "Знак на повторе", en: "Repeated Marker" },
  { ru: "Конверт отдельно", en: "Envelope Set Aside" },
  { ru: "Дуга маршрута", en: "Route Arc" },
  { ru: "Тождественный знак", en: "Identical Marker" },
  { ru: "Ниже линии ветра", en: "Below the Wind Line" },
  { ru: "Пересчёт ночью", en: "Recount at Night" },
  { ru: "Лишний обход", en: "Unneeded Detour" },
  { ru: "Заметка Левина", en: "Levin's Note" },
  { ru: "Проход ниже гребня", en: "Pass Below the Ridge" },
  { ru: "Лист без даты", en: "Undated Sheet" },
  { ru: "Решение вслух", en: "Decision Spoken Aloud" },
  { ru: "Ложная карта", en: "False Map" },
  { ru: "Пустой футляр", en: "Empty Case" },
  { ru: "Тропа к стоянке", en: "Path to the Camp" },
  { ru: "Следы сокрытия", en: "Traces of Concealment" },
  { ru: "Скрытый маршрут", en: "Hidden Route" },
  { ru: "Вторая запись", en: "Second Entry" },
  { ru: "Схема стоянки", en: "Camp Layout" },
  { ru: "Оставленная вещь", en: "Left-Behind Item" },
  { ru: "Контейнер диска", en: "Disc Container" },
  { ru: "Групповой снимок", en: "Group Photograph" },
  { ru: "Порядок ухода", en: "Order of Departure" },
  { ru: "Архивная помета", en: "Archive Note" },
  { ru: "Печать дела", en: "Seal on the File" },
  { ru: "Последний лист", en: "Final Page" },
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
