import type { Locale, TranslationKey } from "@/services/i18n/locales";
import { locales } from "@/services/i18n/locales";

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

  getNarrativeLocale(): "ru" | "global" {
    return this.locale === "ru" ? "ru" : "global";
  }

  t(key: TranslationKey): string {
    return locales[this.locale][key];
  }
}
