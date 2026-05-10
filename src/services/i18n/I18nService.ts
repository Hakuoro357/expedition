import type { Locale, TranslationKey } from "@/services/i18n/locales";
import { locales } from "@/services/i18n/locales";

/**
 * Narrative-локаль. Совпадает с UI Locale + исторический "global" —
 * остался как fallback-ключ для английского нарратива (речь идёт
 * о lookup-функциях entries/rewards/speakers/points, написанных до
 * расширения на 7 локалей). UI-слой всегда получает конкретную локаль
 * через currentLocale(), а "global" применяется только внутри узких
 * lookup-веток как способ выразить «ни ru, ни tr, ни новая локаль».
 */
export type NarrativeLocale = Locale | "global";

export class I18nService {
  private locale: Locale = "ru";

  setLocale(locale: Locale): void {
    this.locale = locale;
    // Guard для test-env (vitest без jsdom): document может не существовать.
    // В браузере и в playwright всегда есть.
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }

  getLocale(): Locale {
    return this.locale;
  }

  /** Alias for getLocale() used in scenes */
  currentLocale(): Locale {
    return this.locale;
  }

  /**
   * Возвращает narrative-локаль для lookup-функций. Для ru/tr/es/pt/de/fr —
   * одноимённые ключи; для en — исторический "global" (совместимость
   * с существующими entries.global/rewardTexts.global).
   */
  getNarrativeLocale(): NarrativeLocale {
    if (this.locale === "en") return "global";
    return this.locale;
  }

  /**
   * Возвращает локализованную строку. С v0.3.51 поддерживает простой
   * substitution: значения для placeholder'ов вида `{name}` берутся из
   * params. Если key не найден или params не задан — поведение
   * идентично старой версии (просто строка из locales).
   *
   * Пример:
   *   t("shareWinText", { pointTitle: "Карта пока не врёт" })
   *   → "«Карта пока не врёт» — пройдено в Косынка: Экспедиция"
   *
   * Безопасность XSS: подставляются сырые значения, а вызывающий код
   * (overlay-генераторы) обязан пропускать результат через escapeHtml
   * перед вставкой в HTML — это уже делается во всех overlay'ах.
   */
  t(key: TranslationKey, params?: Record<string, string>): string {
    const raw = locales[this.locale][key];
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (match, k) => params[k] ?? match);
  }
}
