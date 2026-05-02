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
  es: string;
  pt: string;
  de: string;
  fr: string;
};

const NAMING: Record<NamingEntityId, NamingEntity> = {
  chapter_01: {
    id: "chapter_01",
    ru: "Начало маршрута",
    global: "Trailhead",
    tr: "Yolun Başlangıcı",
    es: "Inicio del sendero",
    pt: "Início da trilha",
    de: "Am Anfang des Weges",
    fr: "Début du sentier",
  },
  chapter_02: {
    id: "chapter_02",
    ru: "Следы и расхождения",
    global: "False Trail",
    tr: "İzler ve Sapmalar",
    es: "Rastros y divergencias",
    pt: "Rastros e divergências",
    de: "Spuren und Abweichungen",
    fr: "Traces et divergences",
  },
  chapter_03: {
    id: "chapter_03",
    ru: "Последняя стоянка",
    global: "Last Camp",
    tr: "Son Kamp",
    es: "Último campamento",
    pt: "Último acampamento",
    de: "Letztes Lager",
    fr: "Dernier campement",
  },
  expedition_name: {
    id: "expedition_name",
    ru: 'Экспедиция "Перевал"',
    global: "The Pass Expedition",
    tr: "Geçit Seferi",
    es: "La Expedición del Paso",
    pt: "A Expedição do Passo",
    de: "Die Pass-Expedition",
    fr: "L'Expédition du Col",
  },
  artifact_main: {
    id: "artifact_main",
    ru: "Навигационный диск",
    global: "Wayfinder Disc",
    tr: "Yön Bulma Diski",
    es: "Disco de orientación",
    pt: "Disco de orientação",
    de: "Wegfinder-Scheibe",
    fr: "Disque d'orientation",
  },
};

export function getNamingValue(entityId: NamingEntityId, locale: string): string {
  const entity = NAMING[entityId];
  if (locale === "ru") return entity.ru;
  if (locale === "tr") return entity.tr;
  if (locale === "es") return entity.es;
  if (locale === "pt") return entity.pt;
  if (locale === "de") return entity.de;
  if (locale === "fr") return entity.fr;
  return entity.global;
}

export function getChapterTitle(chapterId: ChapterId, locale: string): string {
  return getNamingValue(chapterId, locale);
}
