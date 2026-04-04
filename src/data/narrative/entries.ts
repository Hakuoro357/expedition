import { narrativeEntriesGlobal } from "@/data/narrative/entries.global";
import { narrativeEntriesRu } from "@/data/narrative/entries.ru";

export type NarrativeEntry = {
  speakerEntityId: string;
  body: string;
};

export function getNarrativeEntry(entryId: string, locale: "ru" | "global") {
  return (locale === "ru"
    ? narrativeEntriesRu[entryId as keyof typeof narrativeEntriesRu]
    : narrativeEntriesGlobal[entryId as keyof typeof narrativeEntriesGlobal]) as
    | NarrativeEntry
    | undefined;
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

export function getNarrativeEntryExcerpt(entryId: string, locale: "ru" | "global"): string | null {
  const entry = getNarrativeEntry(entryId, locale);
  if (!entry) {
    return null;
  }

  const normalizedBody = entry.body.replace(/\s+/g, " ").trim();
  const firstParagraph = entry.body.split(/\n\s*\n/u)[0]?.replace(/\s+/g, " ").trim() ?? normalizedBody;
  const firstSentenceMatch = firstParagraph.match(/^.+?[.!?…](?=\s|$)/u);
  const base = firstSentenceMatch?.[0] ?? firstParagraph;

  return truncateAtWord(base, 150);
}
