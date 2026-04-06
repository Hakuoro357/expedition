import type { ProgressState } from "@/core/game-state/types";
import { CHAPTERS } from "@/data/chapters";

export type RouteSheetPointState = "passed" | "current" | "future";

export type RouteSheet = {
  page: number;
  dealIds: string[];
  titleRu: string;
  titleEn: string;
  summaryRu: string;
  summaryEn: string;
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
      ru: "Начало пути", en: "Journey Start",
      summaryRu: "Маршрут восстановлен. Первые записи дневника указывают на систему ориентиров, которой нет на официальной карте.",
      summaryEn: "The route is restored. Early diary entries point to a marker system absent from the official map.",
    },
    {
      ru: "Каменная гряда", en: "Stone Ridge",
      summaryRu: "Два маршрута становятся видимыми. Записи осторожнее, а карта всё дальше расходится с отчётом.",
      summaryEn: "Two routes become visible. The notes grow cautious as the map diverges further from the report.",
    },
    {
      ru: "Разорванный маршрут", en: "Broken Route",
      summaryRu: "Сокрытие маршрута — уже факт. Фальшивые фрагменты и ключевая фотография меняют всё.",
      summaryEn: "The concealment of the route is now proven. False fragments and a key photograph change everything.",
    },
    {
      ru: "Последняя стоянка", en: "Last Camp",
      summaryRu: "Архив собран. Настоящий путь, тайник и судьба экспедиции — восстановлены полностью.",
      summaryEn: "The archive is complete. The true route, the cache, and the expedition's fate — fully restored.",
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
      summaryRu: title?.summaryRu ?? "",
      summaryEn: title?.summaryEn ?? "",
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

export function getRouteSheetTitle(page: number, locale: "ru" | "en"): string {
  const sheet = getRouteSheetByPage(page);
  if (!sheet) {
    return locale === "ru" ? `Лист ${page}` : `Sheet ${page}`;
  }

  return locale === "ru" ? sheet.titleRu : sheet.titleEn;
}

export function getRouteSheetSummary(page: number, locale: "ru" | "en"): string {
  const sheet = getRouteSheetByPage(page);
  if (!sheet) return "";
  return locale === "ru" ? sheet.summaryRu : sheet.summaryEn;
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
