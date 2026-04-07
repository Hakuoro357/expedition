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
  { ru: "Карта пока не врёт", en: "The Map Isn't Lying Yet", tr: "Harita Henüz Yalan Söylemiyor" },
  { ru: "Ящик без описи", en: "Crate Without Inventory", tr: "Kayıtsız Sandık" },
  { ru: "Линия по хребту", en: "Line Along the Ridge", tr: "Sırt Boyunca Çizgi" },
  { ru: "Стоянка в сумерках", en: "Camp at Dusk", tr: "Alacakaranlıkta Kamp" },
  { ru: "Второй кадр", en: "Second Frame", tr: "İkinci Kare" },
  { ru: "Чужая точность", en: "Foreign Precision", tr: "Yabancı Bir Kesinlik" },
  { ru: "Отдельно от архива", en: "Separate from the Archive", tr: "Arşivden Ayrı" },
  { ru: "Цифры не сошлись", en: "The Numbers Don't Match", tr: "Sayılar Tutmuyor" },
  { ru: "Странный знак", en: "Strange Marker", tr: "Tuhaf Bir İşaret" },
  { ru: "Два маршрута", en: "Two Routes", tr: "İki Rota" },
  { ru: "Другой дневник", en: "A Different Diary", tr: "Başka Bir Günlük" },
  { ru: "Полсантиметра южнее", en: "Half a Centimeter South", tr: "Yarım Santim Güney" },
  { ru: "Последовательность", en: "The Sequence", tr: "Sıra" },
  { ru: "Восемьсот метров", en: "Eight Hundred Meters", tr: "Sekiz Yüz Metre" },
  { ru: "Решение без слов", en: "Decision Without Words", tr: "Sözsüz Karar" },
  { ru: "Между страницами", en: "Between the Pages", tr: "Sayfalar Arasında" },
  { ru: "Ложная линия", en: "False Line", tr: "Yanlış Çizgi" },
  { ru: "Вслух", en: "Out Loud", tr: "Yüksek Sesle" },
  { ru: "Послание", en: "The Message", tr: "Mesaj" },
  { ru: "Не могу назвать правильным", en: "Can't Call It Right", tr: "Doğru Diyemem" },
  { ru: "Единодушие маршрута", en: "Unanimous Route", tr: "Oybirliğiyle Rota" },
  { ru: "Слишком точная запись", en: "Too Precise an Entry", tr: "Fazla Kesin Bir Kayıt" },
  { ru: "Место для тайника", en: "A Place for the Cache", tr: "Zula İçin Bir Yer" },
  { ru: "Других не осталось", en: "No Others Left", tr: "Başkası Kalmadı" },
  { ru: "Графы не предусмотрено", en: "No Column for That", tr: "Bunun İçin Sütun Yok" },
  { ru: "Групповой снимок", en: "Group Photograph", tr: "Grup Fotoğrafı" },
  { ru: "Цифры сошлись", en: "The Numbers Add Up", tr: "Sayılar Tutuyor" },
  { ru: "Шаг за шагом", en: "Step by Step", tr: "Adım Adım" },
  { ru: "По линиям смысла", en: "Along the Lines of Meaning", tr: "Anlamın İzinde" },
  { ru: "Единственный ключ", en: "The Only Key", tr: "Tek Anahtar" },
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
    titleTr: title?.tr ?? `Nokta ${index + 1}`,
  };
});

export function getPointByDealId(dealId: string): NarrativePoint | undefined {
  return NARRATIVE_POINTS.find((point) => point.dealId === dealId);
}

export function getPointByPointId(pointId: string): NarrativePoint | undefined {
  return NARRATIVE_POINTS.find((point) => point.pointId === pointId);
}

type PointLocale = "ru" | "en" | "global" | "tr";

function pickPointTitle(point: NarrativePoint, locale: PointLocale): string {
  if (locale === "ru") return point.titleRu;
  if (locale === "tr") return point.titleTr ?? point.titleEn;
  return point.titleEn;
}

export function getPointTitleByPointId(
  pointId: string,
  locale: PointLocale,
): string | undefined {
  const point = getPointByPointId(pointId);
  if (!point) {
    return undefined;
  }

  return pickPointTitle(point, locale);
}

export function getPointTitleByDealId(
  dealId: string,
  locale: PointLocale,
): string | undefined {
  const point = getPointByDealId(dealId);
  if (!point) {
    return undefined;
  }

  return pickPointTitle(point, locale);
}
