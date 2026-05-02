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
    document.documentElement.lang = locale;
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

  t(key: TranslationKey): string {
    return locales[this.locale][key];
  }
}
