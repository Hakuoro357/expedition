/**
 * Prologue text — shown once on first launch.
 * Sets up the framing: who the archivist is, what the expedition was, why we follow them.
 *
 * Voice: practical, methodical archivist. No AI patterns (triads, choppy fragments,
 * abstract personifications). No name, no rank, no year — only "seventeen years ago".
 */

export type PrologueParagraphs = string[];

export type PrologueText = {
  ru: PrologueParagraphs;
  en: PrologueParagraphs;
};

export const PROLOGUE_TEXT: PrologueText = {
  ru: [
    "На столе папка с делом № 47/3. Семнадцать лет назад экспедиция Воронова ушла на северо-восток и не вернулась. Поисковые партии искали два сезона и вернулись ни с чем. Дело закрыли «без вести».",
    "Месяц назад охотник принёс в районный архив жестяную коробку — нашёл в развалинах старого зимовья. Внутри — тетради и пачка отдельных листов. Дневник Воронова, полевые заметки картографа Мирской, страницы Руденко, Левина и Климовой. Многое отсырело, листы перепутаны, часть просто отсутствует. Иногда только по почерку понятно, кто писал.",
    "Папку передали мне со словами: посмотри, что можно собрать. Раскладываю листы по датам и стоянкам — идёт медленно, потому что записи короткие, а между ними пробелы. На каждой точке маршрута после экспедиции остался какой-то один след: страница из дневника, набросок, фотокарточка. Этого слишком мало, чтобы понять, что с ними случилось, но достаточно, чтобы пойти за ними.",
  ],
  en: [
    "Case file № 47/3 sits on the desk. Seventeen years ago Voronov's expedition headed northeast and never came back. Search parties combed the area for two seasons and returned with nothing. The case was closed: missing without trace.",
    "A month ago a hunter brought a tin box to the district archive — he had found it in the ruins of an old winter cabin. Inside were notebooks and a stack of loose pages. Voronov's journal, the cartographer Mirskaya's field notes, scattered pages from Rudenko, Levin, and Klimova. Much of it had soaked through, the leaves were jumbled, parts were simply missing. Sometimes only the handwriting tells you who wrote what.",
    "The folder was passed to me with one instruction: see what you can put together. I lay out the pages by date and campsite — it goes slowly, because the entries are short and there are gaps between them. At every stop on the route the expedition left behind a single trace: a journal page, a sketch, a photograph. Too little to know what happened to them, but enough to follow where they went.",
  ],
};
