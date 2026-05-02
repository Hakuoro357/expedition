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
  tr: PrologueParagraphs;
  es: PrologueParagraphs;
  pt: PrologueParagraphs;
  de: PrologueParagraphs;
  fr: PrologueParagraphs;
};

export const PROLOGUE_TEXT: PrologueText = {
  ru: [
    "На столе папка с делом № 47/3. Семнадцать лет назад экспедиция Воронова ушла на северо-восток и не вернулась. Поисковые партии искали два сезона и вернулись ни с чем. Дело закрыли «без вести».",
    "Месяц назад охотник принёс в районный архив жестяную коробку — нашёл в развалинах старого зимовья. Внутри — тетради и пачка отдельных листов. Дневник Воронова, полевые заметки картографа Мирской, страницы Руденко, Левина и Климовой. Многое отсырело, листы перепутаны, часть просто отсутствует. Иногда только по почерку понятно, кто писал.",
    "Папку передали мне со словами: посмотри, что можно собрать. Раскладываю листы по датам и стоянкам — идёт медленно, потому что записи короткие, а между ними пробелы. На каждой точке маршрута после экспедиции остался какой-то один след: страница из дневника, набросок, фотокарточка. Этого слишком мало, чтобы понять, что с ними случилось, но достаточно, чтобы пойти за ними.",
  ],
  en: [
    "Case file № 47/3 sits on the desk. Seventeen years ago Cole's expedition headed northeast and never came back. Search parties combed the area for two seasons and returned with nothing. The case was closed: missing without trace.",
    "A month ago a hunter brought a tin box to the district archive — he had found it in the ruins of an old winter cabin. Inside were notebooks and a stack of loose pages. Cole's journal, the cartographer Marlowe's field notes, scattered pages from Calder, Mercer, and Reed. Much of it had soaked through, the leaves were jumbled, parts were simply missing. Sometimes only the handwriting tells you who wrote what.",
    "The folder was passed to me with one instruction: see what you can put together. I lay out the pages by date and campsite — it goes slowly, because the entries are short and there are gaps between them. At every stop on the route the expedition left behind a single trace: a journal page, a sketch, a photograph. Too little to know what happened to them, but enough to follow where they went.",
  ],
  tr: [
    "Masada 47/3 numaralı dosya duruyor. On yedi yıl önce Cole'un seferi kuzeydoğuya yöneldi ve bir daha geri dönmedi. Arama ekipleri bölgeyi iki sezon boyunca taradı ve elleri boş döndü. Dosya kapatıldı: iz bırakmadan kayıp.",
    "Bir ay önce bir avcı ilçe arşivine teneke bir kutu getirdi — onu eski bir kış barınağının harabelerinde bulmuştu. İçinde defterler ve bir tomar serbest sayfa vardı. Cole'un günlüğü, haritacı Marlowe'un saha notları, Calder, Mercer ve Reed'den dağınık sayfalar. Çoğu ıslanmıştı, yapraklar karışmıştı, bir kısmı tamamen eksikti. Bazen kimin yazdığını yalnızca el yazısından anlıyorsun.",
    "Dosya bana tek bir talimatla verildi: ne toparlayabileceğine bak. Sayfaları tarih ve konaklama yerine göre diziyorum — kayıtlar kısa ve aralarında boşluklar olduğu için yavaş ilerliyor. Rotadaki her durakta sefer geride tek bir iz bırakmış: bir günlük sayfası, bir eskiz, bir fotoğraf. Onlara ne olduğunu bilmek için fazla az, ama nereye gittiklerini takip etmek için yeter.",
  ],
  es: [
    "Sobre el escritorio está el expediente № 47/3. Hace diecisiete años la expedición de Cole partió hacia el noreste y nunca regresó. Las partidas de búsqueda rastrearon la zona durante dos temporadas y volvieron con las manos vacías. El caso se cerró: desaparecidos sin dejar rastro.",
    "Hace un mes un cazador trajo al archivo comarcal una caja de hojalata — la había encontrado en las ruinas de una vieja cabaña de invernada. Dentro había cuadernos y un fajo de hojas sueltas. El diario de Cole, las notas de campo de la cartógrafa Marlowe, páginas dispersas de Calder, Mercer y Reed. Gran parte estaba empapada, las hojas revueltas, algunas simplemente faltaban. A veces solo la letra te dice quién escribió qué.",
    "Me entregaron la carpeta con una sola instrucción: mira qué puedes armar. Coloco las páginas por fecha y campamento — avanza despacio, porque las anotaciones son breves y hay huecos entre ellas. En cada parada de la ruta la expedición dejó un solo rastro: una página de diario, un boceto, una fotografía. Muy poco para saber qué les pasó, pero suficiente para seguir su camino.",
  ],
  pt: [
    "Sobre a mesa está o processo № 47/3. Há dezessete anos a expedição de Cole seguiu para o nordeste e nunca mais voltou. As equipes de busca vasculharam a região por duas temporadas e retornaram de mãos vazias. O caso foi encerrado: desaparecidos sem deixar rastro.",
    "Há um mês um caçador trouxe ao arquivo distrital uma caixa de lata — tinha encontrado nas ruínas de uma velha cabana de inverno. Dentro havia cadernos e um maço de folhas soltas. O diário de Cole, as notas de campo da cartógrafa Marlowe, páginas dispersas de Calder, Mercer e Reed. Muito estava encharcado, as folhas embaralhadas, algumas simplesmente faltavam. Às vezes só a caligrafia diz quem escreveu o quê.",
    "Entregaram-me a pasta com uma única instrução: veja o que consegue juntar. Organizo as páginas por data e acampamento — avança devagar, porque os registros são curtos e há lacunas entre eles. Em cada parada da rota a expedição deixou um único vestígio: uma página de diário, um esboço, uma fotografia. Pouco demais para saber o que aconteceu com eles, mas o bastante para seguir aonde foram.",
  ],
  de: [
    "Auf dem Tisch liegt die Akte Nr. 47/3. Vor siebzehn Jahren zog Coles Expedition nach Nordosten und kehrte nie zurück. Suchtrupps kämmten das Gebiet zwei Saisons lang durch und kamen mit leeren Händen zurück. Der Fall wurde geschlossen: spurlos verschwunden.",
    "Vor einem Monat brachte ein Jäger eine Blechkiste ins Bezirksarchiv — er hatte sie in den Ruinen einer alten Winterhütte gefunden. Darin lagen Notizbücher und ein Stapel loser Blätter. Coles Tagebuch, die Feldnotizen der Kartografin Marlowe, verstreute Seiten von Calder, Mercer und Reed. Vieles war durchweicht, die Blätter durcheinander, manches fehlte einfach. Manchmal weiß man nur an der Handschrift, wer was geschrieben hat.",
    "Die Mappe wurde mir mit einer einzigen Anweisung übergeben: sieh, was du zusammenfügen kannst. Ich ordne die Seiten nach Datum und Lagerplatz — es geht langsam, denn die Einträge sind kurz und dazwischen klaffen Lücken. An jeder Station der Route hinterließ die Expedition eine einzige Spur: eine Tagebuchseite, eine Skizze, ein Foto. Zu wenig, um zu wissen, was ihnen zustieß, aber genug, um ihnen zu folgen.",
  ],
  fr: [
    "Sur le bureau, le dossier № 47/3. Il y a dix-sept ans, l'expédition de Cole est partie vers le nord-est et n'est jamais revenue. Les équipes de recherche ont ratissé la zone pendant deux saisons et sont revenues les mains vides. Le dossier a été classé : disparus sans laisser de trace.",
    "Il y a un mois, un chasseur a apporté aux archives du district une boîte en fer-blanc — il l'avait trouvée dans les ruines d'un vieux refuge d'hiver. À l'intérieur, des carnets et une liasse de feuilles éparses. Le journal de Cole, les notes de terrain de la cartographe Marlowe, des pages dispersées de Calder, Mercer et Reed. Beaucoup étaient détrempées, les feuillets mélangés, certains tout simplement absents. Parfois seule l'écriture dit qui a écrit quoi.",
    "On m'a remis le dossier avec une seule consigne : vois ce que tu peux rassembler. Je range les pages par date et par campement — cela avance lentement, parce que les entrées sont courtes et qu'il y a des vides entre elles. À chaque étape de l'itinéraire, l'expédition n'a laissé qu'une trace unique : une page de journal, un croquis, une photographie. Trop peu pour savoir ce qui leur est arrivé, mais assez pour suivre leur chemin.",
  ],
};
