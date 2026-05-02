import type { Rank } from "@/core/cards/types";
import type { Locale } from "@/services/i18n/locales";

// Европейские локали (es/pt/de/fr) используют те же латинские обозначения
// карт, что и английская — это индустриальный стандарт для колод в
// романских/германских странах. Отдельных национальных кодов (как у
// России «Т/В/Д/К» или Турции «V/K/P») эти локали не имеют.
const FACE_CARDS_BY_LOCALE: Record<Locale, Record<number, string>> = {
  en: { 1: "A", 11: "J", 12: "Q", 13: "K" },
  ru: { 1: "Т", 11: "В", 12: "Д", 13: "К" },
  tr: { 1: "A", 11: "V", 12: "K", 13: "P" },
  es: { 1: "A", 11: "J", 12: "Q", 13: "K" },
  pt: { 1: "A", 11: "J", 12: "Q", 13: "K" },
  de: { 1: "A", 11: "J", 12: "Q", 13: "K" },
  fr: { 1: "A", 11: "J", 12: "Q", 13: "K" },
};

export function getRankLabel(rank: Rank, locale: Locale): string {
  const map = FACE_CARDS_BY_LOCALE[locale] ?? FACE_CARDS_BY_LOCALE.en;
  return map[rank] ?? String(rank);
}
