import { getNamingValue } from "@/data/naming";

export type Artifact = {
  id: string;
  chapter: number;
  imageKey: string;
  largeImageKey: string;
  titleRu: string;
  titleEn: string;
  titleTr?: string;
  descriptionRu: string;
  descriptionEn: string;
  descriptionTr?: string;
  /** Unicode icon displayed in the diary */
  icon: string;
};

const expeditionNameEn = getNamingValue("expedition_name", "en");
const artifactMainEn = getNamingValue("artifact_main", "en");
const expeditionNameTr = getNamingValue("expedition_name", "tr");
const artifactMainTr = getNamingValue("artifact_main", "tr");

export const ARTIFACTS: Artifact[] = [
  // ── Chapter 1: Начало маршрута ──────────────────────────────────────────
  {
    id: "compass",
    chapter: 1,
    imageKey: "artifact_stamp_grid",
    largeImageKey: "artifact_stamp_large",
    titleRu: "Штамп экспедиции",
    titleEn: "Expedition Stamp",
    titleTr: "Sefer Mührü",
    descriptionRu: "Канцелярский штамп дела «Перевал». То, что он вообще сохранился, — уже странность.",
    descriptionEn: `The working stamp of ${expeditionNameEn}. The first sign that the archive survived for a reason.`,
    descriptionTr: `${expeditionNameTr} dosyasının çalışma mührü. Arşivin bir nedenle hayatta kaldığının ilk işareti.`,
    icon: "🧭",
  },
  {
    id: "old-map",
    chapter: 1,
    imageKey: "artifact_map_fragment_01_grid",
    largeImageKey: "artifact_map_fragment_01_large",
    titleRu: "Первый фрагмент карты",
    titleEn: "First Map Fragment",
    titleTr: "İlk Harita Parçası",
    descriptionRu: "Клочок маршрута, жёлтый и ломкий. С него путь начинает собираться заново.",
    descriptionEn: "A yellowed route fragment from which the real path starts assembling again.",
    descriptionTr: "Gerçek yolun yeniden birleşmeye başladığı sararmış bir rota parçası.",
    icon: "🗺️",
  },
  {
    id: "explorer-badge",
    chapter: 1,
    imageKey: "artifact_unidentified_object_grid",
    largeImageKey: "artifact_unidentified_object_large",
    titleRu: "Неописанный предмет",
    titleEn: "Unlisted Object",
    titleTr: "Kayıtsız Nesne",
    descriptionRu: "В описи его нет. Кто-то решил, что этой находки не было — но вот она, в руках.",
    descriptionEn: `A fragment absent from the official record. Later it becomes clear that it belongs to the ${artifactMainEn}.`,
    descriptionTr: `Resmi kayıtta bulunmayan bir parça. Sonradan bunun ${artifactMainTr}'ne ait olduğu anlaşılır.`,
    icon: "🔖",
  },

  // ── Chapter 2: Следы и расхождения ───────────────────────────────────────
  {
    id: "pickaxe",
    chapter: 2,
    imageKey: "artifact_levin_note_grid",
    largeImageKey: "artifact_levin_note_large",
    titleRu: "Заметка Левина",
    titleEn: "Mercer's Note",
    titleTr: "Mercer'ın Notu",
    descriptionRu: "Левин пишет без обычных оговорок. Похоже, к этому месту у него кончилось терпение.",
    descriptionEn: "The first note where the scale of the discovery is stated plainly, without archaeological caution.",
    descriptionTr: "Buluntunun büyüklüğünün arkeolojik ihtiyat bırakılarak ilk kez açıkça ifade edildiği not.",
    icon: "📓",
  },
  {
    id: "field-journal",
    chapter: 2,
    imageKey: "artifact_unsigned_note_grid",
    largeImageKey: "artifact_unsigned_note_large",
    titleRu: "Записка без подписи",
    titleEn: "Unsigned Note",
    titleTr: "İmzasız Not",
    descriptionRu: "Ни имени, ни даты. Кто-то проговорил вслух то, о чём экспедиция молчала.",
    descriptionEn: "A sheet with no name and no date. The expedition's internal choice is stated fully for the first time.",
    descriptionTr: "İsimsiz, tarihsiz bir sayfa. Seferin içsel seçimi ilk kez eksiksiz olarak dile getiriliyor.",
    icon: "✉️",
  },
  {
    id: "lantern",
    chapter: 2,
    imageKey: "artifact_case_grid",
    largeImageKey: "artifact_case_large",
    titleRu: "Футляр от артефакта",
    titleEn: "Artifact Case",
    titleTr: "Eser Kutusu",
    descriptionRu: "Пустой, но сделан на совесть. Главную находку отделили от архива и берегли иначе.",
    descriptionEn: "An empty case showing that the main discovery had already been separated from the rest of the archive.",
    descriptionTr: "Ana buluntunun arşivin geri kalanından çoktan ayrıldığını gösteren boş bir kutu.",
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
    titleTr: "Gizli Haritanın Büyük Parçası",
    descriptionRu: "Подлинный маршрут, не вошедший в отчёт. Без него последняя часть пути не складывается.",
    descriptionEn: "A major piece of the true route, without which the expedition's final stretch cannot be restored.",
    descriptionTr: "Rapora girmeyen gerçek rotanın büyük bir parçası. O olmadan seferin son kısmı yeniden kurulamaz.",
    icon: "🗺️",
  },
  {
    id: "fishing-rod",
    chapter: 3,
    imageKey: "artifact_disc_container_grid",
    largeImageKey: "artifact_disc_container_large",
    titleRu: "Контейнер диска",
    titleEn: "Disc Container",
    titleTr: "Disk Kutusu",
    descriptionRu: "Жёсткий, тяжёлый, сделан под точный размер. Здесь находка впервые становится вещью.",
    descriptionEn: `A rigid container for the ${artifactMainEn}. Here the discovery stops being a theory and becomes an object again.`,
    descriptionTr: `${artifactMainTr} için sert bir muhafaza. Burada buluntu bir teori olmaktan çıkıp yeniden bir nesneye dönüşür.`,
    icon: "🧳",
  },
  {
    id: "camp-kettle",
    chapter: 3,
    imageKey: "artifact_archive_seal_grid",
    largeImageKey: "artifact_archive_seal_large",
    titleRu: "Печать архива",
    titleEn: "Archive Seal",
    titleTr: "Arşiv Mührü",
    descriptionRu: "Сургуч и оттиск. Кто-то запечатал дело «Перевал» так, чтобы оно не открылось само.",
    descriptionEn: `The final sign that the materials of ${expeditionNameEn} were sealed deliberately rather than lost.`,
    descriptionTr: `${expeditionNameTr} malzemelerinin kaybolmadığını, bilinçli olarak mühürlendiğini gösteren son işaret.`,
    icon: "📜",
  },
];

export function getArtifactById(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export function getChapterArtifacts(chapter: number): Artifact[] {
  return ARTIFACTS.filter((a) => a.chapter === chapter);
}
