export type ChapterId = "chapter_01" | "chapter_02" | "chapter_03";

export type NamingEntityId =
  | ChapterId
  | "expedition_name"
  | "artifact_main";

export type NamingEntity = {
  id: NamingEntityId;
  ru: string;
  global: string;
  tr: string;
};

const NAMING: Record<NamingEntityId, NamingEntity> = {
  chapter_01: {
    id: "chapter_01",
    ru: "Начало маршрута",
    global: "Trailhead",
    tr: "Yolun Başlangıcı",
  },
  chapter_02: {
    id: "chapter_02",
    ru: "Следы и расхождения",
    global: "False Trail",
    tr: "İzler ve Sapmalar",
  },
  chapter_03: {
    id: "chapter_03",
    ru: "Последняя стоянка",
    global: "Last Camp",
    tr: "Son Kamp",
  },
  expedition_name: {
    id: "expedition_name",
    ru: 'Экспедиция "Перевал"',
    global: "The Pass Expedition",
    tr: "Geçit Seferi",
  },
  artifact_main: {
    id: "artifact_main",
    ru: "Навигационный диск",
    global: "Wayfinder Disc",
    tr: "Yön Bulma Diski",
  },
};

export function getNamingValue(entityId: NamingEntityId, locale: string): string {
  const entity = NAMING[entityId];
  if (locale === "ru") return entity.ru;
  if (locale === "tr") return entity.tr;
  return entity.global;
}

export function getChapterTitle(chapterId: ChapterId, locale: string): string {
  return getNamingValue(chapterId, locale);
}
