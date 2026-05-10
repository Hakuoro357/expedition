import { describe, expect, it } from "vitest";
import { I18nService } from "@/services/i18n/I18nService";

describe("I18nService.t() substitution", () => {
  it("returns raw string when no params provided", () => {
    const i18n = new I18nService();
    i18n.setLocale("ru");
    expect(i18n.t("share")).toBe("Поделиться");
  });

  it("substitutes {pointTitle} placeholder in shareWinText (ru)", () => {
    const i18n = new I18nService();
    i18n.setLocale("ru");
    const result = i18n.t("shareWinText", { pointTitle: "Карта пока не врёт" });
    expect(result).toBe(
      "«Карта пока не врёт» — пройдено в Косынка: Экспедиция",
    );
  });

  it("substitutes across all 7 locales", () => {
    const cases: Array<{ locale: "ru" | "en" | "tr" | "es" | "pt" | "de" | "fr"; needle: string }> = [
      { locale: "ru", needle: "пройдено" },
      { locale: "en", needle: "cleared" },
      { locale: "tr", needle: "tamamlandı" },
      { locale: "es", needle: "completado" },
      { locale: "pt", needle: "concluído" },
      { locale: "de", needle: "geschafft" },
      { locale: "fr", needle: "terminé" },
    ];
    for (const { locale, needle } of cases) {
      const i18n = new I18nService();
      i18n.setLocale(locale);
      const result = i18n.t("shareWinText", { pointTitle: "X" });
      expect(result).toContain(needle);
      expect(result).toContain("X"); // подстановка сработала
    }
  });

  it("leaves unknown placeholders intact for visibility", () => {
    const i18n = new I18nService();
    i18n.setLocale("en");
    // Если params не содержит ключа — placeholder оставляется в строке как
    // есть; помогает в dev заметить, что ожидался param.
    const result = i18n.t("shareWinText", { unrelated: "Y" });
    expect(result).toContain("{pointTitle}");
  });
});
