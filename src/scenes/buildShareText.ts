import { getPointTitleByDealId } from "@/data/narrative/points";
import type { I18nService, NarrativeLocale } from "@/services/i18n/I18nService";

/**
 * Контекстный текст для gp.socials.share после победы. Использует
 * имя только что пройденной точки маршрута (уже локализовано в
 * `points.ts`) внутри шаблона `shareWinText`.
 *
 * Используется в RewardScene при клике на share-кнопку.
 */
export function buildShareWinText(
  dealId: string,
  narrativeLocale: NarrativeLocale,
  i18n: I18nService,
): string {
  const pointTitle = getPointTitleByDealId(dealId, narrativeLocale) ?? "";
  return i18n.t("shareWinText", { pointTitle });
}

/**
 * v0.3.55: share-текст для записи в DetailScene. Использует имя
 * точки маршрута, к которой эта запись относится (тот же
 * `getPointTitleByDealId`). Шаблон `shareEntryText` в локалях.
 */
export function buildShareEntryText(
  dealId: string,
  narrativeLocale: NarrativeLocale,
  i18n: I18nService,
): string {
  const pointTitle = getPointTitleByDealId(dealId, narrativeLocale) ?? "";
  return i18n.t("shareEntryText", { pointTitle });
}

/**
 * v0.3.55: share-текст для артефакта в DetailScene. Использует
 * локализованное название артефакта (передаётся вызывающим, потому
 * что artifact-локализация делается в DetailScene по особой схеме —
 * artifact.titleRu / titleEn / titleTr — без узла поиска по dealId).
 */
export function buildShareArtifactText(
  artifactTitle: string,
  i18n: I18nService,
): string {
  return i18n.t("shareArtifactText", { artifactTitle });
}
