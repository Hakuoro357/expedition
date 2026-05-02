import { narrativeEntriesGlobal } from "@/data/narrative/entries.global";
import { narrativeEntriesRu } from "@/data/narrative/entries.ru";
import { narrativeEntriesTr } from "@/data/narrative/entries.tr";
import { narrativeEntriesEs } from "@/data/narrative/entries.es";
import { narrativeEntriesPt } from "@/data/narrative/entries.pt";
import { narrativeEntriesDe } from "@/data/narrative/entries.de";
import { narrativeEntriesFr } from "@/data/narrative/entries.fr";

export type NarrativeEntry = {
  speakerEntityId: string;
  excerpt?: string;
  body: string;
};

// Все поддерживаемые narrative-локали. "global" — исторический ключ
// (английский текст), используется для callers, которые ещё не
// перешли на явный "en".
export type EntryLocale =
  | "ru"
  | "global"
  | "en"
  | "tr"
  | "es"
  | "pt"
  | "de"
  | "fr";

export function getNarrativeEntry(entryId: string, locale: EntryLocale) {
  if (locale === "ru") {
    return narrativeEntriesRu[entryId as keyof typeof narrativeEntriesRu] as NarrativeEntry | undefined;
  }
  if (locale === "tr") {
    return (narrativeEntriesTr[entryId as keyof typeof narrativeEntriesTr] ??
      narrativeEntriesGlobal[entryId as keyof typeof narrativeEntriesGlobal]) as NarrativeEntry | undefined;
  }
  if (locale === "es") {
    return (narrativeEntriesEs[entryId as keyof typeof narrativeEntriesEs] ??
      narrativeEntriesGlobal[entryId as keyof typeof narrativeEntriesGlobal]) as NarrativeEntry | undefined;
  }
  if (locale === "pt") {
    return (narrativeEntriesPt[entryId as keyof typeof narrativeEntriesPt] ??
      narrativeEntriesGlobal[entryId as keyof typeof narrativeEntriesGlobal]) as NarrativeEntry | undefined;
  }
  if (locale === "de") {
    return (narrativeEntriesDe[entryId as keyof typeof narrativeEntriesDe] ??
      narrativeEntriesGlobal[entryId as keyof typeof narrativeEntriesGlobal]) as NarrativeEntry | undefined;
  }
  if (locale === "fr") {
    return (narrativeEntriesFr[entryId as keyof typeof narrativeEntriesFr] ??
      narrativeEntriesGlobal[entryId as keyof typeof narrativeEntriesGlobal]) as NarrativeEntry | undefined;
  }
  return narrativeEntriesGlobal[entryId as keyof typeof narrativeEntriesGlobal] as NarrativeEntry | undefined;
}

function truncateAtWord(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const slice = value.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const trimmed = (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();
  return `${trimmed}…`;
}

export function getNarrativeEntryExcerpt(entryId: string, locale: EntryLocale): string | null {
  const entry = getNarrativeEntry(entryId, locale);
  if (!entry) {
    return null;
  }

  if (entry.excerpt) {
    return entry.excerpt;
  }

  const normalizedBody = entry.body.replace(/\s+/g, " ").trim();
  const firstParagraph = entry.body.split(/\n\s*\n/u)[0]?.replace(/\s+/g, " ").trim() ?? normalizedBody;
  const firstSentenceMatch = firstParagraph.match(/^.+?[.!?…](?=\s|$)/u);
  const base = firstSentenceMatch?.[0] ?? firstParagraph;

  return truncateAtWord(base, 150);
}
