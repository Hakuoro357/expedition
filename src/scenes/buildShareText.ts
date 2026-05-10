import { getPointTitleByDealId } from "@/data/narrative/points";
import type { I18nService, NarrativeLocale } from "@/services/i18n/I18nService";

/**
 * Контекстный текст для gp.socials.share после победы. Использует
 * имя только что пройденной точки маршрута (уже локализовано в
 * `points.ts`) внутри шаблона `shareWinText`. Если по какой-то причине
 * имя точки не нашлось — возвращаем сам шаблон без подстановки
 * (i18n.t оставит `{pointTitle}` как есть, что заметно в логах и
 * подсказывает где починить).
 *
 * Используется только в RewardScene при клике на share-кнопку. Если в
 * будущем добавим share с других экранов — этот же helper можно
 * переиспользовать или ввести параллельные builders для других
 * контекстов (напр. shareChapterCompleteText).
 */
export function buildShareWinText(
  dealId: string,
  narrativeLocale: NarrativeLocale,
  i18n: I18nService,
): string {
  const pointTitle = getPointTitleByDealId(dealId, narrativeLocale) ?? "";
  return i18n.t("shareWinText", { pointTitle });
}
