import { getNamingValue } from "@/data/naming";

export type Artifact = {
  id: string;
  chapter: number;
  imageKey: string;
  largeImageKey: string;
  titleRu: string;
  titleEn: string;
  titleTr?: string;
  titleEs?: string;
  titlePt?: string;
  titleDe?: string;
  titleFr?: string;
  descriptionRu: string;
  descriptionEn: string;
  descriptionTr?: string;
  descriptionEs?: string;
  descriptionPt?: string;
  descriptionDe?: string;
  descriptionFr?: string;
  /** Unicode icon displayed in the diary */
  icon: string;
};

const expeditionNameEn = getNamingValue("expedition_name", "en");
const artifactMainEn = getNamingValue("artifact_main", "en");
const expeditionNameTr = getNamingValue("expedition_name", "tr");
const artifactMainTr = getNamingValue("artifact_main", "tr");
const expeditionNameEs = getNamingValue("expedition_name", "es");
const artifactMainEs = getNamingValue("artifact_main", "es");
const expeditionNamePt = getNamingValue("expedition_name", "pt");
const artifactMainPt = getNamingValue("artifact_main", "pt");
const expeditionNameDe = getNamingValue("expedition_name", "de");
const artifactMainDe = getNamingValue("artifact_main", "de");
const expeditionNameFr = getNamingValue("expedition_name", "fr");
const artifactMainFr = getNamingValue("artifact_main", "fr");

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
    titleEs: "Sello de la expedición",
    titlePt: "Carimbo da expedição",
    titleDe: "Expeditionsstempel",
    titleFr: "Tampon de l'expédition",
    descriptionRu: "Канцелярский штамп дела «Перевал». То, что он вообще сохранился, — уже странность.",
    descriptionEn: `The working stamp of ${expeditionNameEn}. The first sign that the archive survived for a reason.`,
    descriptionTr: `${expeditionNameTr} dosyasının çalışma mührü. Arşivin bir nedenle hayatta kaldığının ilk işareti.`,
    descriptionEs: `El sello de trabajo de ${expeditionNameEs}. La primera señal de que el archivo se conservó por una razón.`,
    descriptionPt: `O carimbo de trabalho da ${expeditionNamePt}. O primeiro sinal de que o arquivo sobreviveu por algum motivo.`,
    descriptionDe: `Der Dienststempel von ${expeditionNameDe}. Das erste Zeichen, dass das Archiv aus einem Grund erhalten blieb.`,
    descriptionFr: `Le tampon de service de ${expeditionNameFr}. Le premier signe que les archives ont survécu pour une raison.`,
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
    titleEs: "Primer fragmento del mapa",
    titlePt: "Primeiro fragmento do mapa",
    titleDe: "Erstes Kartenfragment",
    titleFr: "Premier fragment de carte",
    descriptionRu: "Клочок маршрута, жёлтый и ломкий. С него путь начинает собираться заново.",
    descriptionEn: "A yellowed route fragment from which the real path starts assembling again.",
    descriptionTr: "Gerçek yolun yeniden birleşmeye başladığı sararmış bir rota parçası.",
    descriptionEs: "Un pedazo de ruta, amarillento y quebradizo. A partir de él, el camino verdadero vuelve a armarse.",
    descriptionPt: "Um retalho da rota, amarelado e quebradiço. A partir dele, o caminho verdadeiro começa a se montar de novo.",
    descriptionDe: "Ein vergilbtes Stück der Route, spröde. Von hier aus beginnt sich der wahre Weg neu zusammenzufügen.",
    descriptionFr: "Un lambeau d'itinéraire, jauni et cassant. C'est à partir de lui que le vrai chemin se recompose.",
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
    titleEs: "Objeto sin registrar",
    titlePt: "Objeto sem registro",
    titleDe: "Nicht verzeichnetes Objekt",
    titleFr: "Objet non répertorié",
    descriptionRu: "В описи его нет. Кто-то решил, что этой находки не было — но вот она, в руках.",
    descriptionEn: `A fragment absent from the official record. Later it becomes clear that it belongs to the ${artifactMainEn}.`,
    descriptionTr: `Resmi kayıtta bulunmayan bir parça. Sonradan bunun ${artifactMainTr}'ne ait olduğu anlaşılır.`,
    descriptionEs: `Un fragmento ausente del registro oficial. Más tarde queda claro que pertenece al ${artifactMainEs}.`,
    descriptionPt: `Um fragmento ausente do registro oficial. Mais tarde fica claro que pertence ao ${artifactMainPt}.`,
    descriptionDe: `Ein Fragment, das im offiziellen Verzeichnis fehlt. Später wird klar, dass es zur ${artifactMainDe} gehört.`,
    descriptionFr: `Un fragment absent du registre officiel. Plus tard, il devient évident qu'il appartient au ${artifactMainFr}.`,
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
    titleEs: "Nota de Mercer",
    titlePt: "Nota de Mercer",
    titleDe: "Mercers Notiz",
    titleFr: "Note de Mercer",
    descriptionRu: "Левин пишет без обычных оговорок. Похоже, к этому месту у него кончилось терпение.",
    descriptionEn: "The first note where the scale of the discovery is stated plainly, without archaeological caution.",
    descriptionTr: "Buluntunun büyüklüğünün arkeolojik ihtiyat bırakılarak ilk kez açıkça ifade edildiği not.",
    descriptionEs: "La primera nota en la que la magnitud del hallazgo se expresa sin la cautela habitual del arqueólogo.",
    descriptionPt: "A primeira nota em que a magnitude do achado é dita sem a cautela habitual do arqueólogo.",
    descriptionDe: "Die erste Notiz, in der das Ausmaß des Fundes ohne die übliche archäologische Vorsicht klar benannt wird.",
    descriptionFr: "La première note où l'ampleur de la découverte est exprimée sans la prudence archéologique habituelle.",
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
    titleEs: "Nota sin firma",
    titlePt: "Bilhete sem assinatura",
    titleDe: "Unsignierte Notiz",
    titleFr: "Note sans signature",
    descriptionRu: "Ни имени, ни даты. Кто-то проговорил вслух то, о чём экспедиция молчала.",
    descriptionEn: "A sheet with no name and no date. The expedition's internal choice is stated fully for the first time.",
    descriptionTr: "İsimsiz, tarihsiz bir sayfa. Seferin içsel seçimi ilk kez eksiksiz olarak dile getiriliyor.",
    descriptionEs: "Una hoja sin nombre y sin fecha. Por primera vez, la decisión interna de la expedición queda dicha por completo.",
    descriptionPt: "Uma folha sem nome e sem data. Pela primeira vez, a escolha interna da expedição é dita por inteiro.",
    descriptionDe: "Ein Blatt ohne Namen und ohne Datum. Zum ersten Mal wird die innere Entscheidung der Expedition vollständig ausgesprochen.",
    descriptionFr: "Une feuille sans nom ni date. Pour la première fois, le choix intérieur de l'expédition est énoncé tout entier.",
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
    titleEs: "Estuche del artefacto",
    titlePt: "Estojo do artefato",
    titleDe: "Artefakt-Etui",
    titleFr: "Étui de l'artéfact",
    descriptionRu: "Пустой, но сделан на совесть. Главную находку отделили от архива и берегли иначе.",
    descriptionEn: "An empty case showing that the main discovery had already been separated from the rest of the archive.",
    descriptionTr: "Ana buluntunun arşivin geri kalanından çoktan ayrıldığını gösteren boş bir kutu.",
    descriptionEs: "Un estuche vacío que muestra que el hallazgo principal ya había sido separado del resto del archivo.",
    descriptionPt: "Um estojo vazio que mostra que o achado principal já havia sido separado do resto do arquivo.",
    descriptionDe: "Ein leeres Etui, das zeigt, dass der Hauptfund bereits vom Rest des Archivs getrennt worden war.",
    descriptionFr: "Un étui vide qui montre que la découverte principale avait déjà été séparée du reste des archives.",
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
    titleEs: "Fragmento mayor del mapa oculto",
    titlePt: "Fragmento maior do mapa oculto",
    titleDe: "Großes Teil der verborgenen Karte",
    titleFr: "Grand fragment de la carte cachée",
    descriptionRu: "Подлинный маршрут, не вошедший в отчёт. Без него последняя часть пути не складывается.",
    descriptionEn: "A major piece of the true route, without which the expedition's final stretch cannot be restored.",
    descriptionTr: "Rapora girmeyen gerçek rotanın büyük bir parçası. O olmadan seferin son kısmı yeniden kurulamaz.",
    descriptionEs: "Una pieza grande de la ruta real, sin la cual el tramo final de la expedición no puede reconstruirse.",
    descriptionPt: "Uma peça grande da rota verdadeira, sem a qual o trecho final da expedição não pode ser reconstruído.",
    descriptionDe: "Ein großes Stück der wahren Route — ohne es lässt sich die letzte Strecke der Expedition nicht wiederherstellen.",
    descriptionFr: "Un grand morceau du vrai parcours, sans lequel la dernière étape de l'expédition ne peut être reconstituée.",
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
    titleEs: "Contenedor del disco",
    titlePt: "Contêiner do disco",
    titleDe: "Scheibenbehälter",
    titleFr: "Conteneur du disque",
    descriptionRu: "Жёсткий, тяжёлый, сделан под точный размер. Здесь находка впервые становится вещью.",
    descriptionEn: `A rigid container for the ${artifactMainEn}. Here the discovery stops being a theory and becomes an object again.`,
    descriptionTr: `${artifactMainTr} için sert bir muhafaza. Burada buluntu bir teori olmaktan çıkıp yeniden bir nesneye dönüşür.`,
    descriptionEs: `Un contenedor rígido para el ${artifactMainEs}. Aquí el hallazgo deja de ser una teoría y vuelve a ser un objeto.`,
    descriptionPt: `Um contêiner rígido para o ${artifactMainPt}. Aqui o achado deixa de ser uma teoria e volta a ser um objeto.`,
    descriptionDe: `Ein starres Behältnis für die ${artifactMainDe}. Hier hört der Fund auf, eine Theorie zu sein, und wird wieder zum Gegenstand.`,
    descriptionFr: `Un contenant rigide pour le ${artifactMainFr}. Ici la découverte cesse d'être une théorie et redevient un objet.`,
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
    titleEs: "Sello del archivo",
    titlePt: "Selo do arquivo",
    titleDe: "Archivsiegel",
    titleFr: "Sceau des archives",
    descriptionRu: "Сургуч и оттиск. Кто-то запечатал дело «Перевал» так, чтобы оно не открылось само.",
    descriptionEn: `The final sign that the materials of ${expeditionNameEn} were sealed deliberately rather than lost.`,
    descriptionTr: `${expeditionNameTr} malzemelerinin kaybolmadığını, bilinçli olarak mühürlendiğini gösteren son işaret.`,
    descriptionEs: `La última señal de que los materiales de ${expeditionNameEs} fueron sellados a propósito, no perdidos.`,
    descriptionPt: `O último sinal de que os materiais da ${expeditionNamePt} foram selados de propósito, não perdidos.`,
    descriptionDe: `Das letzte Zeichen dafür, dass die Unterlagen von ${expeditionNameDe} absichtlich versiegelt und nicht verloren wurden.`,
    descriptionFr: `Le dernier signe que les documents de ${expeditionNameFr} ont été scellés délibérément, non perdus.`,
    icon: "📜",
  },
];

export function getArtifactById(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export function getChapterArtifacts(chapter: number): Artifact[] {
  return ARTIFACTS.filter((a) => a.chapter === chapter);
}
