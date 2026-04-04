import { getNamingValue } from "@/data/naming";

export type Artifact = {
  id: string;
  chapter: number;
  imageKey: string;
  largeImageKey: string;
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  /** Unicode icon displayed in the diary */
  icon: string;
};

const expeditionNameEn = getNamingValue("expedition_name", "en");
const artifactMainEn = getNamingValue("artifact_main", "en");

export const ARTIFACTS: Artifact[] = [
  // ── Chapter 1: Начало маршрута ──────────────────────────────────────────
  {
    id: "compass",
    chapter: 1,
    imageKey: "artifact_stamp_grid",
    largeImageKey: "artifact_stamp_large",
    titleRu: "Штамп экспедиции",
    titleEn: "Expedition Stamp",
    descriptionRu: "Канцелярский штамп дела «Перевал». То, что он вообще сохранился, — уже странность.",
    descriptionEn: `The working stamp of ${expeditionNameEn}. The first sign that the archive survived for a reason.`,
    icon: "🧭",
  },
  {
    id: "old-map",
    chapter: 1,
    imageKey: "artifact_map_fragment_01_grid",
    largeImageKey: "artifact_map_fragment_01_large",
    titleRu: "Первый фрагмент карты",
    titleEn: "First Map Fragment",
    descriptionRu: "Клочок маршрута, жёлтый и ломкий. С него путь начинает собираться заново.",
    descriptionEn: "A yellowed route fragment from which the real path starts assembling again.",
    icon: "🗺️",
  },
  {
    id: "explorer-badge",
    chapter: 1,
    imageKey: "artifact_unidentified_object_grid",
    largeImageKey: "artifact_unidentified_object_large",
    titleRu: "Неописанный предмет",
    titleEn: "Unlisted Object",
    descriptionRu: "В описи его нет. Кто-то решил, что этой находки не было — но вот она, в руках.",
    descriptionEn: `A fragment absent from the official record. Later it becomes clear that it belongs to the ${artifactMainEn}.`,
    icon: "🔖",
  },

  // ── Chapter 2: Следы и расхождения ───────────────────────────────────────
  {
    id: "pickaxe",
    chapter: 2,
    imageKey: "artifact_levin_note_grid",
    largeImageKey: "artifact_levin_note_large",
    titleRu: "Заметка Левина",
    titleEn: "Levin's Note",
    descriptionRu: "Левин пишет без обычных оговорок. Похоже, к этому месту у него кончилось терпение.",
    descriptionEn: "The first note where the scale of the discovery is stated plainly, without archaeological caution.",
    icon: "📓",
  },
  {
    id: "field-journal",
    chapter: 2,
    imageKey: "artifact_unsigned_note_grid",
    largeImageKey: "artifact_unsigned_note_large",
    titleRu: "Записка без подписи",
    titleEn: "Unsigned Note",
    descriptionRu: "Ни имени, ни даты. Кто-то проговорил вслух то, о чём экспедиция молчала.",
    descriptionEn: "A sheet with no name and no date. The expedition's internal choice is stated fully for the first time.",
    icon: "✉️",
  },
  {
    id: "lantern",
    chapter: 2,
    imageKey: "artifact_case_grid",
    largeImageKey: "artifact_case_large",
    titleRu: "Футляр от артефакта",
    titleEn: "Artifact Case",
    descriptionRu: "Пустой, но сделан на совесть. Главную находку отделили от архива и берегли иначе.",
    descriptionEn: "An empty case showing that the main discovery had already been separated from the rest of the archive.",
    icon: "📦",
  },

  // ── Chapter 3: Последняя стоянка ─────────────────────────────────────────
  {
    id: "canoe-paddle",
    chapter: 3,
    imageKey: "artifact_hidden_map_large_grid",
    largeImageKey: "artifact_hidden_map_large",
    titleRu: "Крупный фрагмент скрытой карты",
    titleEn: "Major Hidden Map Piece",
    descriptionRu: "Подлинный маршрут, не вошедший в отчёт. Без него последняя часть пути не складывается.",
    descriptionEn: "A major piece of the true route, without which the expedition's final stretch cannot be restored.",
    icon: "🗺️",
  },
  {
    id: "fishing-rod",
    chapter: 3,
    imageKey: "artifact_disc_container_grid",
    largeImageKey: "artifact_disc_container_large",
    titleRu: "Контейнер диска",
    titleEn: "Disc Container",
    descriptionRu: "Жёсткий, тяжёлый, сделан под точный размер. Здесь находка впервые становится вещью.",
    descriptionEn: `A rigid container for the ${artifactMainEn}. Here the discovery stops being a theory and becomes an object again.`,
    icon: "🧳",
  },
  {
    id: "camp-kettle",
    chapter: 3,
    imageKey: "artifact_archive_seal_grid",
    largeImageKey: "artifact_archive_seal_large",
    titleRu: "Печать архива",
    titleEn: "Archive Seal",
    descriptionRu: "Сургуч и оттиск. Кто-то запечатал дело «Перевал» так, чтобы оно не открылось само.",
    descriptionEn: `The final sign that the materials of ${expeditionNameEn} were sealed deliberately rather than lost.`,
    icon: "📜",
  },
];

export function getArtifactById(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export function getChapterArtifacts(chapter: number): Artifact[] {
  return ARTIFACTS.filter((a) => a.chapter === chapter);
}
