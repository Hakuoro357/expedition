import { narrativeEntriesGlobal } from "@/data/narrative/entries.global";
import { narrativeEntriesRu } from "@/data/narrative/entries.ru";

export function getNarrativeEntry(entryId: string, locale: "ru" | "global") {
  return locale === "ru"
    ? narrativeEntriesRu[entryId as keyof typeof narrativeEntriesRu]
    : narrativeEntriesGlobal[entryId as keyof typeof narrativeEntriesGlobal];
}
