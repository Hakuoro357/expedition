import type { Rank } from "@/core/cards/types";
import type { Locale } from "@/services/i18n/locales";

const FACE_CARDS_BY_LOCALE: Record<Locale, Record<number, string>> = {
  en: { 1: "A", 11: "J", 12: "Q", 13: "K" },
  ru: { 1: "Т", 11: "В", 12: "Д", 13: "К" },
  tr: { 1: "A", 11: "V", 12: "K", 13: "P" },
};

export function getRankLabel(rank: Rank, locale: Locale): string {
  const map = FACE_CARDS_BY_LOCALE[locale] ?? FACE_CARDS_BY_LOCALE.en;
  return map[rank] ?? String(rank);
}
