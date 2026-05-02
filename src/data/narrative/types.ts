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
  titleTr?: string;
  titleEs?: string;
  titlePt?: string;
  titleDe?: string;
  titleFr?: string;
  /**
   * Краткое описание точки, которое целиком помещается в нижнюю
   * map-панель (CSS `.route-overlay__active-point-description`,
   * 3 строки × ~32 символа = ~95 символов max). Раньше использовался
   * `getNarrativeEntryExcerpt`, который обрезал длинный текст с «…»;
   * тестировщики попросили не делать этого. Теперь у каждой точки
   * заведено своё короткое описание во всех 7 локалях.
   */
  mapDescriptionRu: string;
  mapDescriptionEn: string;
  mapDescriptionTr: string;
  mapDescriptionEs: string;
  mapDescriptionPt: string;
  mapDescriptionDe: string;
  mapDescriptionFr: string;
};
