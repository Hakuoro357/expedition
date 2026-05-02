import type { ProgressState } from "@/core/game-state/types";
import { CHAPTERS } from "@/data/chapters";

export type RouteSheetPointState = "passed" | "current" | "future";

export type RouteSheet = {
  page: number;
  dealIds: string[];
  titleRu: string;
  titleEn: string;
  titleTr: string;
  titleEs: string;
  titlePt: string;
  titleDe: string;
  titleFr: string;
  summaryRu: string;
  summaryEn: string;
  summaryTr: string;
  summaryEs: string;
  summaryPt: string;
  summaryDe: string;
  summaryFr: string;
  background: {
    topColor: number;
    bottomColor: number;
    glowColor: number;
  };
};

const ALL_DEAL_IDS = CHAPTERS.flatMap((chapter) => chapter.nodes.map((node) => node.id));
const ROUTE_SHEET_SIZES = [8, 8, 7, 7] as const;

function buildRouteSheets(): RouteSheet[] {
  let cursor = 0;
  const titles = [
    {
      ru: "Начало пути", en: "Journey Start", tr: "Yolun Başlangıcı",
      es: "Inicio del viaje", pt: "Início da jornada", de: "Beginn der Reise", fr: "Début du voyage",
      summaryRu: "Маршрут восстановлен. Первые записи дневника указывают на систему ориентиров, которой нет на официальной карте.",
      summaryEn: "The route is restored. Early diary entries point to a marker system absent from the official map.",
      summaryTr: "Rota yeniden kuruldu. İlk günlük sayfaları, resmi haritada bulunmayan bir işaret sistemine işaret ediyor.",
      summaryEs: "La ruta está restaurada. Las primeras entradas del diario apuntan a un sistema de señales ausente en el mapa oficial.",
      summaryPt: "A rota foi restaurada. As primeiras entradas do diário apontam para um sistema de marcos ausente no mapa oficial.",
      summaryDe: "Die Route ist rekonstruiert. Die ersten Tagebuchseiten weisen auf ein Zeichensystem hin, das in der offiziellen Karte fehlt.",
      summaryFr: "L'itinéraire est reconstitué. Les premières pages du journal évoquent un système de repères absent de la carte officielle.",
    },
    {
      ru: "Каменная гряда", en: "Stone Ridge", tr: "Taş Sırtı",
      es: "Cresta de piedra", pt: "Cume de pedra", de: "Steinkamm", fr: "Crête de pierre",
      summaryRu: "Два маршрута становятся видимыми. Записи осторожнее, а карта всё дальше расходится с отчётом.",
      summaryEn: "Two routes become visible. The notes grow cautious as the map diverges further from the report.",
      summaryTr: "İki rota görünür hale geliyor. Notlar temkinleşiyor, harita ise rapordan giderek uzaklaşıyor.",
      summaryEs: "Se hacen visibles dos rutas. Las anotaciones se vuelven prudentes y el mapa se aleja cada vez más del informe.",
      summaryPt: "Duas rotas se tornam visíveis. As anotações ficam cautelosas e o mapa se afasta cada vez mais do relatório.",
      summaryDe: "Zwei Routen werden sichtbar. Die Einträge werden vorsichtiger, die Karte entfernt sich immer weiter vom Bericht.",
      summaryFr: "Deux itinéraires deviennent visibles. Les notes se font prudentes et la carte s'éloigne de plus en plus du rapport.",
    },
    {
      ru: "Разорванный маршрут", en: "Broken Route", tr: "Kopmuş Rota",
      es: "Ruta rota", pt: "Rota interrompida", de: "Zerbrochene Route", fr: "Itinéraire rompu",
      summaryRu: "Сокрытие маршрута — уже факт. Фальшивые фрагменты и ключевая фотография меняют всё.",
      summaryEn: "The concealment of the route is now proven. False fragments and a key photograph change everything.",
      summaryTr: "Rotanın gizlendiği artık kanıtlanmış durumda. Sahte parçalar ve önemli bir fotoğraf her şeyi değiştiriyor.",
      summaryEs: "El ocultamiento de la ruta es ya un hecho. Los fragmentos falsos y una fotografía clave lo cambian todo.",
      summaryPt: "O ocultamento da rota já é um fato. Fragmentos falsos e uma fotografia-chave mudam tudo.",
      summaryDe: "Das Verbergen der Route ist jetzt belegt. Falsche Fragmente und ein Schlüsselfoto verändern alles.",
      summaryFr: "La dissimulation de l'itinéraire est désormais avérée. De faux fragments et une photographie clé changent tout.",
    },
    {
      ru: "Последняя стоянка", en: "Last Camp", tr: "Son Kamp",
      es: "Último campamento", pt: "Último acampamento", de: "Letztes Lager", fr: "Dernier campement",
      summaryRu: "Архив собран. Настоящий путь, тайник и судьба экспедиции — восстановлены полностью.",
      summaryEn: "The archive is complete. The true route, the cache, and the expedition's fate — fully restored.",
      summaryTr: "Arşiv tamamlandı. Gerçek yol, zula ve seferin kaderi — tamamen yeniden kuruldu.",
      summaryEs: "El archivo está completo. El camino verdadero, el escondite y el destino de la expedición — totalmente recuperados.",
      summaryPt: "O arquivo está completo. O caminho verdadeiro, o esconderijo e o destino da expedição — totalmente restaurados.",
      summaryDe: "Das Archiv ist vollständig. Der wahre Weg, das Versteck und das Schicksal der Expedition — ganz wiederhergestellt.",
      summaryFr: "Les archives sont au complet. Le vrai chemin, la cache et le sort de l'expédition — entièrement reconstitués.",
    },
  ] as const;
  const backgrounds = [
    { topColor: 0x264744, bottomColor: 0x172a28, glowColor: 0x3f6a62 },
    { topColor: 0x31463f, bottomColor: 0x1b2824, glowColor: 0x59684c },
    { topColor: 0x2d3f4d, bottomColor: 0x18232d, glowColor: 0x52657f },
    { topColor: 0x3f3730, bottomColor: 0x201a17, glowColor: 0x705642 },
  ] as const;

  return ROUTE_SHEET_SIZES.map((size, index) => {
    const dealIds = ALL_DEAL_IDS.slice(cursor, cursor + size);
    cursor += size;
    const title = titles[index];

    return {
      page: index + 1,
      dealIds,
      titleRu: title?.ru ?? `Лист ${index + 1}`,
      titleEn: title?.en ?? `Sheet ${index + 1}`,
      titleTr: title?.tr ?? `Sayfa ${index + 1}`,
      titleEs: title?.es ?? `Hoja ${index + 1}`,
      titlePt: title?.pt ?? `Folha ${index + 1}`,
      titleDe: title?.de ?? `Blatt ${index + 1}`,
      titleFr: title?.fr ?? `Feuille ${index + 1}`,
      summaryRu: title?.summaryRu ?? "",
      summaryEn: title?.summaryEn ?? "",
      summaryTr: title?.summaryTr ?? "",
      summaryEs: title?.summaryEs ?? "",
      summaryPt: title?.summaryPt ?? "",
      summaryDe: title?.summaryDe ?? "",
      summaryFr: title?.summaryFr ?? "",
      background: backgrounds[index] ?? backgrounds[0],
    };
  });
}

export const ROUTE_SHEETS: RouteSheet[] = buildRouteSheets();

export function getRouteSheetByPage(page: number): RouteSheet | undefined {
  return ROUTE_SHEETS.find((sheet) => sheet.page === page);
}

export function getRouteSheetByDealId(dealId: string): RouteSheet | undefined {
  return ROUTE_SHEETS.find((sheet) => sheet.dealIds.includes(dealId));
}

// Широкий union — все поддерживаемые UI-локали.
type AnyLocale = "ru" | "en" | "tr" | "es" | "pt" | "de" | "fr";

export function getRouteSheetTitle(page: number, locale: AnyLocale): string {
  const sheet = getRouteSheetByPage(page);
  if (!sheet) {
    if (locale === "ru") return `Лист ${page}`;
    if (locale === "tr") return `Sayfa ${page}`;
    if (locale === "es") return `Hoja ${page}`;
    if (locale === "pt") return `Folha ${page}`;
    if (locale === "de") return `Blatt ${page}`;
    if (locale === "fr") return `Feuille ${page}`;
    return `Sheet ${page}`;
  }

  if (locale === "ru") return sheet.titleRu;
  if (locale === "tr") return sheet.titleTr;
  if (locale === "es") return sheet.titleEs;
  if (locale === "pt") return sheet.titlePt;
  if (locale === "de") return sheet.titleDe;
  if (locale === "fr") return sheet.titleFr;
  return sheet.titleEn;
}

export function getRouteSheetSummary(page: number, locale: AnyLocale): string {
  const sheet = getRouteSheetByPage(page);
  if (!sheet) return "";
  if (locale === "ru") return sheet.summaryRu;
  if (locale === "tr") return sheet.summaryTr;
  if (locale === "es") return sheet.summaryEs;
  if (locale === "pt") return sheet.summaryPt;
  if (locale === "de") return sheet.summaryDe;
  if (locale === "fr") return sheet.summaryFr;
  return sheet.summaryEn;
}

export function getNextPlayableDealId(progress: ProgressState): string | null {
  return (
    ALL_DEAL_IDS.find((dealId) => !progress.completedNodes.includes(dealId)) ?? null
  );
}

export function isRouteSheetUnlocked(page: number, progress: ProgressState): boolean {
  if (progress.devAllPlayable) {
    return getRouteSheetByPage(page) != null;
  }

  const sheet = getRouteSheetByPage(page);
  if (!sheet) {
    return false;
  }

  if (page === 1) {
    return true;
  }

  const nextPlayableDealId = getNextPlayableDealId(progress);
  if (!nextPlayableDealId) {
    return true;
  }

  const unlockedSheet = getRouteSheetByDealId(nextPlayableDealId);
  return (unlockedSheet?.page ?? 0) >= page;
}

export function getCurrentRoutePointState(
  dealId: string,
  progress: ProgressState,
): RouteSheetPointState {
  if (progress.completedNodes.includes(dealId)) {
    return "passed";
  }

  if (progress.devAllPlayable) {
    return "current";
  }

  return getNextPlayableDealId(progress) === dealId ? "current" : "future";
}
