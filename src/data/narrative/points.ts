import type { ChapterId } from "@/data/naming";
import type { NarrativePoint } from "@/data/narrative/types";

const CHAPTER_IDS: ChapterId[] = ["chapter_01", "chapter_02", "chapter_03"];

const REWARD_IDS: string[] = [
  "reward_diary_page_01",
  "reward_expedition_stamp_01",
  "reward_map_piece_01",
  "reward_camp_marker_01",
  "reward_stone_sign_note_01",
  "reward_unknown_item_01",
  "reward_photo_ridge_01",
  "reward_map_variant_01",
  "reward_map_piece_02",
  "reward_chapter_piece_01",
  "reward_diary_page_damaged_01",
  "reward_map_variant_02",
  "reward_levin_note_01",
  "reward_hidden_camp_marker_01",
  "reward_torn_paper_01",
  "reward_anonymous_note_01",
  "reward_false_map_piece_01",
  "reward_artifact_case_01",
  "reward_photo_key_01",
  "reward_chapter_piece_02",
  "reward_map_major_01",
  "reward_diary_page_02",
  "reward_final_camp_scheme_01",
  "reward_personal_item_01",
  "reward_artifact_case_major_01",
  "reward_group_photo_final_01",
  "reward_logistics_note_01",
  "reward_archive_note_01",
  "reward_archive_seal_01",
  "reward_finale_bundle_01",
];

// Каждая точка маршрута имеет:
//  - titleXX  — заголовок (выводится в map-панели и других местах)
//  - descXX   — короткое описание для нижней map-панели; должно
//               целиком помещаться в 3 строки шириной ~32 символа
//               (см. .route-overlay__active-point-description), без
//               троеточия. Тестировщики прямо просили: текст не
//               должен обрезаться. Цель — ≤ ~95 символов на язык.
//
// Имена персонажей: для русского — Воронов / Мирская / Левин / Руденко /
// Климова. Для всех остальных локалей (en/tr/es/pt/de/fr) — единый
// латинский неймпак: Cole / Marlowe / Mercer / Calder / Reed.
const POINT_DATA = [
  {
    ru: "Карта пока не врёт", en: "The Map Isn't Lying Yet", tr: "Harita Henüz Yalan Söylemiyor",
    es: "El mapa aún no miente", pt: "O mapa ainda não mente",
    de: "Die Karte lügt noch nicht", fr: "La carte ne ment pas encore",
    descRu: "Группа выходит молча, и в молчании этом больше готовности, чем в перекличке.",
    descEn: "The team sets out in silence, and the silence holds more than any roll call could.",
    descTr: "Ekip sessizce yola çıkıyor; bu sessizlik her yoklamadan fazlasını söylüyor.",
    descEs: "El equipo parte en silencio, y en ese silencio hay más prontitud que en un pase de lista.",
    descPt: "A equipe parte em silêncio, e nesse silêncio há mais prontidão do que numa chamada.",
    descDe: "Die Mannschaft bricht schweigend auf, und im Schweigen liegt mehr als in jedem Appell.",
    descFr: "L'équipe part en silence, et ce silence dit plus que n'importe quel appel.",
  },
  {
    ru: "Ящик без описи", en: "Crate Without Inventory", tr: "Kayıtsız Sandık",
    es: "Caja sin inventario", pt: "Caixa sem inventário",
    de: "Kiste ohne Verzeichnis", fr: "Caisse sans inventaire",
    descRu: "Ящик весит на четыре кило больше накладной. Заметили это на третьей сотне метров.",
    descEn: "The supply crate is four kilos over the manifest. We noticed at three hundred meters.",
    descTr: "Sandık beyan edilenden dört kilo ağır. Üç yüzüncü metrede fark ettik.",
    descEs: "La caja pesa cuatro kilos más que la guía. Lo notamos a los trescientos metros.",
    descPt: "A caixa pesa quatro quilos a mais do que a guia. Notamos isso aos trezentos metros.",
    descDe: "Die Kiste wiegt vier Kilo mehr als angegeben. Auf den ersten dreihundert Metern fiel es auf.",
    descFr: "La caisse pèse quatre kilos de plus que prévu. On l'a senti au bout de trois cents mètres.",
  },
  {
    ru: "Линия по хребту", en: "Line Along the Ridge", tr: "Sırt Boyunca Çizgi",
    es: "Línea por la cresta", pt: "Linha pelo cume",
    de: "Linie am Kamm entlang", fr: "Ligne le long de la crête",
    descRu: "На карте линия идёт по хребту. Настоящая тропа лежит метров на тридцать ниже.",
    descEn: "On the map the line runs along the ridge. The real path lies thirty meters lower.",
    descTr: "Haritada çizgi sırt boyunca uzanıyor. Gerçek patika otuz metre kadar aşağıda.",
    descEs: "En el mapa la línea va por la cresta. La verdadera senda corre treinta metros más abajo.",
    descPt: "No mapa a linha vai pelo cume. A trilha real passa uns trinta metros abaixo.",
    descDe: "Auf der Karte läuft die Linie am Kamm. Der echte Pfad liegt etwa dreißig Meter tiefer.",
    descFr: "Sur la carte la ligne suit la crête. Le vrai sentier passe trente mètres plus bas.",
  },
  {
    ru: "Стоянка в сумерках", en: "Camp at Dusk", tr: "Alacakaranlıkta Kamp",
    es: "Campamento al anochecer", pt: "Acampamento ao anoitecer",
    de: "Lager in der Dämmerung", fr: "Campement au crépuscule",
    descRu: "Руденко выбирает площадку молча, по приметам, которые никогда не объясняет.",
    descEn: "Calder picks the spot in silence, by signs he never explains to anyone.",
    descTr: "Calder yeri sessizce seçiyor; hiç açıklamadığı işaretlere bakarak.",
    descEs: "Calder escoge el sitio en silencio, por señales que nunca explica.",
    descPt: "Calder escolhe o lugar em silêncio, por sinais que nunca explica.",
    descDe: "Calder wählt den Platz schweigend, nach Zeichen, die er nie erklärt.",
    descFr: "Calder choisit l'emplacement en silence, à des signes qu'il n'explique jamais.",
  },
  {
    ru: "Второй кадр", en: "Second Frame", tr: "İkinci Kare",
    es: "Segundo fotograma", pt: "Segundo quadro",
    de: "Zweites Bild", fr: "Deuxième cliché",
    descRu: "Камень стоит посреди ровной площадки один. Слишком ровно для случайности.",
    descEn: "A stone stands alone in the middle of a flat clearing. Too neat to be accident.",
    descTr: "Düz bir açıklığın ortasında tek bir taş duruyor. Tesadüf için fazla düzgün.",
    descEs: "Una piedra sola en medio de un claro liso. Demasiado prolija para ser casualidad.",
    descPt: "Uma pedra sozinha no meio de uma clareira lisa. Arrumada demais para ser acaso.",
    descDe: "Ein Stein steht allein auf einer ebenen Fläche. Zu genau für einen Zufall.",
    descFr: "Une pierre seule au milieu d'une clairière plane. Trop nette pour un hasard.",
  },
  {
    ru: "Чужая точность", en: "Foreign Precision", tr: "Yabancı Bir Kesinlik",
    es: "Precisión ajena", pt: "Precisão alheia",
    de: "Fremde Präzision", fr: "Précision étrangère",
    descRu: "Левин держит в руке артефакт с такими гранями, что становится не по себе.",
    descEn: "Mercer holds an artifact whose facets are so exact it makes you uneasy.",
    descTr: "Mercer'ın elindeki nesnenin yüzeyleri öyle kesin ki insanı huzursuz ediyor.",
    descEs: "Mercer sostiene un objeto con caras tan exactas que pone la piel de gallina.",
    descPt: "Mercer segura um objeto com faces tão exatas que dá um arrepio.",
    descDe: "Mercer hält ein Objekt mit so genauen Flächen, dass es einem unheimlich wird.",
    descFr: "Mercer tient un objet aux facettes si exactes qu'on en est mal à l'aise.",
  },
  {
    ru: "Отдельно от архива", en: "Separate from the Archive", tr: "Arşivden Ayrı",
    es: "Aparte del archivo", pt: "Separado do arquivo",
    de: "Getrennt vom Archiv", fr: "À part des archives",
    descRu: "Климова откладывает кассету. Воронов сегодня пишет осторожнее обычного.",
    descEn: "Reed sets a roll aside. Cole is writing more carefully today than usual.",
    descTr: "Reed bir kaseti ayırıyor. Cole bugün her zamankinden daha temkinli yazıyor.",
    descEs: "Reed aparta un rollo. Cole escribe hoy con más cautela que de costumbre.",
    descPt: "Reed separa um rolo. Cole escreve hoje com mais cautela que o usual.",
    descDe: "Reed legt eine Rolle beiseite. Cole schreibt heute vorsichtiger als sonst.",
    descFr: "Reed met un rouleau de côté. Cole écrit aujourd'hui plus prudemment que d'habitude.",
  },
  {
    ru: "Цифры не сошлись", en: "The Numbers Don't Match", tr: "Sayılar Tutmuyor",
    es: "Los números no cuadran", pt: "Os números não batem",
    de: "Die Zahlen stimmen nicht", fr: "Les chiffres ne concordent pas",
    descRu: "Расстояния не сошлись ни у одного из нас. Значит, врёт схема, а не мы.",
    descEn: "The distances don't add up for any of us. So the schematic lies, not us.",
    descTr: "Mesafeler hiçbirimizde tutmadı. Demek ki yalan söyleyen biz değil, şema.",
    descEs: "Las distancias no cuadran para ninguno. Entonces miente el esquema, no nosotros.",
    descPt: "As distâncias não batem para nenhum de nós. Então quem mente é o esquema, não nós.",
    descDe: "Die Abstände stimmen bei keinem von uns. Also lügt das Schema, nicht wir.",
    descFr: "Les distances ne tombent juste chez aucun de nous. C'est le schéma qui ment, pas nous.",
  },
  {
    ru: "Странный знак", en: "Strange Marker", tr: "Tuhaf Bir İşaret",
    es: "Marca extraña", pt: "Marco estranho",
    de: "Seltsames Zeichen", fr: "Signe étrange",
    descRu: "Тот же камень, что и два дня назад. Кто-то ставил их по правилу.",
    descEn: "The same stone as two days ago. Someone set them by a rule.",
    descTr: "İki gün önceki taşla aynı. Birisi onları bir kurala göre dizmiş.",
    descEs: "La misma piedra que hace dos días. Alguien las puso siguiendo una regla.",
    descPt: "A mesma pedra de dois dias atrás. Alguém as colocou seguindo uma regra.",
    descDe: "Derselbe Stein wie vor zwei Tagen. Jemand hat sie nach einer Regel gesetzt.",
    descFr: "La même pierre qu'il y a deux jours. Quelqu'un les pose selon une règle.",
  },
  {
    ru: "Два маршрута", en: "Two Routes", tr: "İki Rota",
    es: "Dos rutas", pt: "Duas rotas",
    de: "Zwei Routen", fr: "Deux itinéraires",
    descRu: "В документах проступают два маршрута, и каждый по отдельности выглядит разумно.",
    descEn: "Two routes are showing through the documents, and each one alone looks reasonable.",
    descTr: "Belgelerde iki rota beliriyor, ve her biri tek başına makul görünüyor.",
    descEs: "En los documentos asoman dos rutas, y cada una por separado parece razonable.",
    descPt: "Nos documentos surgem duas rotas, e cada uma por si só parece razoável.",
    descDe: "In den Papieren scheinen zwei Routen durch, jede für sich wirkt vernünftig.",
    descFr: "Deux itinéraires transparaissent dans les documents, chacun semble sensé à part.",
  },
  {
    ru: "Другой дневник", en: "A Different Diary", tr: "Başka Bir Günlük",
    es: "Otro diario", pt: "Outro diário",
    de: "Ein anderes Tagebuch", fr: "Un autre journal",
    descRu: "Воронов вычёркивает абзацы. Раньше оставлял такие для полноты отчёта.",
    descEn: "Cole is cutting paragraphs. He used to leave them in for the sake of the record.",
    descTr: "Cole paragrafları siliyor. Eskiden raporun bütünlüğü için bırakırdı.",
    descEs: "Cole tacha párrafos. Antes los dejaba por la completitud del informe.",
    descPt: "Cole risca parágrafos. Antes os deixava pela completude do relatório.",
    descDe: "Cole streicht Absätze. Früher ließ er sie der Vollständigkeit halber stehen.",
    descFr: "Cole coupe des paragraphes. Avant, il les laissait par souci de complétude.",
  },
  {
    ru: "Полсантиметра южнее", en: "Half a Centimeter South", tr: "Yarım Santim Güney",
    es: "Medio centímetro al sur", pt: "Meio centímetro ao sul",
    de: "Einen halben Zentimeter südlich", fr: "Un demi-centimètre au sud",
    descRu: "Мирская стирает свою же линию и проводит новую полсантиметра южнее.",
    descEn: "Marlowe rubs out her own line and draws a new one half a centimeter south.",
    descTr: "Marlowe kendi çizgisini siliyor ve yarım santim güneye yenisini çekiyor.",
    descEs: "Marlowe borra su propia línea y traza otra medio centímetro más al sur.",
    descPt: "Marlowe apaga a própria linha e traça outra meio centímetro ao sul.",
    descDe: "Marlowe radiert ihre Linie aus und zieht eine neue, einen halben Zentimeter südlicher.",
    descFr: "Marlowe efface sa propre ligne et en trace une autre un demi-centimètre plus au sud.",
  },
  {
    ru: "Последовательность", en: "The Sequence", tr: "Sıra",
    es: "La secuencia", pt: "A sequência",
    de: "Die Abfolge", fr: "La séquence",
    descRu: "Левин раскладывает находки по предполагаемому порядку изготовления, и картина меняется.",
    descEn: "Mercer lays out the finds in their likely order of making, and the picture shifts.",
    descTr: "Mercer buluntuları muhtemel yapım sırasına göre diziyor, ve manzara hemen değişiyor.",
    descEs: "Mercer ordena los hallazgos por el orden probable de fabricación, y el cuadro cambia.",
    descPt: "Mercer organiza os achados pela ordem provável de fabricação, e o quadro muda.",
    descDe: "Mercer legt die Funde nach mutmaßlicher Herstellungsfolge aus, und das Bild verschiebt sich.",
    descFr: "Mercer dispose les trouvailles selon leur ordre de fabrication probable, et l'image change.",
  },
  {
    ru: "Восемьсот метров", en: "Eight Hundred Meters", tr: "Sekiz Yüz Metre",
    es: "Ochocientos metros", pt: "Oitocentos metros",
    de: "Achthundert Meter", fr: "Huit cents mètres",
    descRu: "«Давай встанем там, где нас не ждут», — Воронов сказал это, не глядя на карту.",
    descEn: "\"Let's camp where they don't expect us,\" Cole said it without looking at the map.",
    descTr: "\"Bizi beklemedikleri yerde duralım,\" dedi Cole, haritaya bakmadan.",
    descEs: "«Acampemos donde no nos esperan», dijo Cole sin mirar el mapa.",
    descPt: "«Vamos acampar onde não nos esperam», disse Cole sem olhar para o mapa.",
    descDe: "«Lasst uns da stehen, wo sie uns nicht erwarten,» sagte Cole, ohne auf die Karte zu sehen.",
    descFr: "« Campons là où ils ne nous attendent pas », dit Cole sans regarder la carte.",
  },
  {
    ru: "Решение без слов", en: "Decision Without Words", tr: "Sözsüz Karar",
    es: "Decisión sin palabras", pt: "Decisão sem palavras",
    de: "Entscheidung ohne Worte", fr: "Décision sans mots",
    descRu: "Левин начал с фактов, Мирская со схемы, Руденко ждал. Никто не повышал голоса.",
    descEn: "Mercer started with facts, Marlowe with the schematic, Calder waited. No one raised a voice.",
    descTr: "Mercer gerçeklerle başladı, Marlowe şemayla, Calder bekledi. Kimse sesini yükseltmedi.",
    descEs: "Mercer empezó por los hechos, Marlowe por el esquema, Calder esperó. Nadie alzó la voz.",
    descPt: "Mercer começou pelos fatos, Marlowe pelo esquema, Calder esperou. Ninguém ergueu a voz.",
    descDe: "Mercer fing mit Fakten an, Marlowe mit dem Schema, Calder wartete. Keiner wurde laut.",
    descFr: "Mercer commence par les faits, Marlowe par le schéma. Personne n'élève la voix.",
  },
  {
    ru: "Между страницами", en: "Between the Pages", tr: "Sayfalar Arasında",
    es: "Entre las páginas", pt: "Entre as páginas",
    de: "Zwischen den Seiten", fr: "Entre les pages",
    descRu: "Между страницами реестра лежит лист без подписи, исписанный мелко и ровно.",
    descEn: "A sheet without signature lies between two pages of the inventory, written small and even.",
    descTr: "Envanterin iki sayfası arasında, küçük ve düzgün el yazısıyla, imzasız bir sayfa.",
    descEs: "Entre dos páginas del inventario hay una hoja sin firma, escrita en letra pequeña y pareja.",
    descPt: "Entre duas páginas do inventário há uma folha sem assinatura, escrita miúda e regular.",
    descDe: "Zwischen den Inventarseiten liegt ein unsigniertes Blatt, klein und gleichmäßig beschrieben.",
    descFr: "Entre deux pages de l'inventaire, une feuille sans signature, écrite petit et régulier.",
  },
  {
    ru: "Ложная линия", en: "False Line", tr: "Yanlış Çizgi",
    es: "Línea falsa", pt: "Linha falsa",
    de: "Falsche Linie", fr: "Fausse ligne",
    descRu: "Мирская впервые в жизни рисует карту, по которой пойдут не туда.",
    descEn: "For the first time in her life, Marlowe is drawing a map meant to lead the wrong way.",
    descTr: "Marlowe hayatında ilk kez yanlış yöne götürecek bir harita çiziyor.",
    descEs: "Por primera vez en su vida, Marlowe dibuja un mapa para que vayan por donde no debe.",
    descPt: "Pela primeira vez na vida, Marlowe desenha um mapa para que sigam o caminho errado.",
    descDe: "Zum ersten Mal in ihrem Leben zeichnet Marlowe eine Karte, die in die Irre führen soll.",
    descFr: "Pour la première fois de sa vie, Marlowe trace une carte pour qu'on prenne le mauvais chemin.",
  },
  {
    ru: "Вслух", en: "Out Loud", tr: "Yüksek Sesle",
    es: "En voz alta", pt: "Em voz alta",
    de: "Laut ausgesprochen", fr: "À voix haute",
    descRu: "Воронов потёр переносицу и сказал: «Пока не сдаём. Прячем и ждём.»",
    descEn: "Cole rubbed the bridge of his nose and said: \"We don't hand it in yet. Hide and wait.\"",
    descTr: "Cole burnunun üstünü ovuşturup dedi: \"Henüz teslim etmiyoruz. Saklıyor, bekliyoruz.\"",
    descEs: "Cole se frotó el puente de la nariz y dijo: «Aún no lo entregamos. Esconder y esperar.»",
    descPt: "Cole esfregou a base do nariz e disse: «Ainda não entregamos. Escondemos e esperamos.»",
    descDe: "Cole rieb sich den Nasenrücken und sagte: «Noch nicht abgeben. Verstecken und warten.»",
    descFr: "Cole se frotta l'arête du nez et dit : « On ne remet pas encore. On cache et on attend. »",
  },
  {
    ru: "Послание", en: "The Message", tr: "Mesaj",
    es: "El mensaje", pt: "A mensagem",
    de: "Die Botschaft", fr: "Le message",
    descRu: "Климова меняет на снимках «наш лагерь» и «привал» на координаты и угол солнца.",
    descEn: "Reed changes \"our camp\" and \"morning halt\" on the photos to coordinates and sun angle.",
    descTr: "Reed fotoğraflardaki \"kampımız\" ve \"mola\"yı koordinatlara ve güneş açısına çeviriyor.",
    descEs: "Reed cambia «nuestro campamento» y «alto» en las fotos por coordenadas y ángulo solar.",
    descPt: "Reed troca «nosso acampamento» e «parada» nas fotos por coordenadas e ângulo do sol.",
    descDe: "Reed ersetzt auf den Fotos «unser Lager» und «Rast» durch Koordinaten und Sonnenwinkel.",
    descFr: "Reed remplace « notre camp » et « halte » sur les photos par coordonnées et angle du soleil.",
  },
  {
    ru: "Не могу назвать правильным", en: "Can't Call It Right", tr: "Doğru Diyemem",
    es: "No puedo llamarlo correcto", pt: "Não posso chamá-lo de certo",
    de: "Ich kann es nicht richtig nennen", fr: "Je ne peux pas dire que c'est juste",
    descRu: "Все возражения сказаны, ни одно не перевесило. Молчание стало решением.",
    descEn: "Every objection has been spoken, none tipped the scale. The silence became the decision.",
    descTr: "Tüm itirazlar söylendi, hiçbiri ağır basmadı. Sessizlik kararın kendisi oldu.",
    descEs: "Todas las objeciones se han dicho, ninguna pesó más. El silencio se volvió la decisión.",
    descPt: "Todas as objeções foram ditas, nenhuma pesou mais. O silêncio virou a decisão.",
    descDe: "Alle Einwände sind gesagt, keiner gab den Ausschlag. Das Schweigen wurde zur Entscheidung.",
    descFr: "Toutes les objections sont dites, aucune n'a pesé. Le silence est devenu la décision.",
  },
  {
    ru: "Единодушие маршрута", en: "Unanimous Route", tr: "Oybirliğiyle Rota",
    es: "Ruta unánime", pt: "Rota unânime",
    de: "Einmütige Route", fr: "Itinéraire unanime",
    descRu: "Записи перестали расходиться, и Воронова это не радует.",
    descEn: "The records have stopped diverging, and Cole is not glad about it.",
    descTr: "Kayıtlar ayrışmayı bıraktı, ve Cole bundan memnun değil.",
    descEs: "Las anotaciones dejaron de discrepar, y a Cole eso no le alegra.",
    descPt: "Os registros pararam de divergir, e Cole não fica feliz com isso.",
    descDe: "Die Aufzeichnungen weichen nicht mehr ab, und Cole freut das nicht.",
    descFr: "Les notes ne divergent plus, et Cole n'en est pas heureux.",
  },
  {
    ru: "Слишком точная запись", en: "Too Precise an Entry", tr: "Fazla Kesin Bir Kayıt",
    es: "Una entrada demasiado precisa", pt: "Uma entrada precisa demais",
    de: "Ein zu präziser Eintrag", fr: "Une entrée trop précise",
    descRu: "Воронов вычёркивает полстраницы. Каждое лишнее слово делает запись зацепкой.",
    descEn: "Cole cuts half a page. Every spare word turns the entry into a foothold.",
    descTr: "Cole yarım sayfayı siliyor. Her fazla sözcük kaydı bir tutamağa çeviriyor.",
    descEs: "Cole tacha media página. Cada palabra de más vuelve la nota un asidero.",
    descPt: "Cole risca meia página. Cada palavra a mais transforma a nota num apoio.",
    descDe: "Cole streicht eine halbe Seite. Jedes überflüssige Wort wird zum Ansatzpunkt.",
    descFr: "Cole coupe une demi-page. Chaque mot superflu fait de la note une prise.",
  },
  {
    ru: "Место для тайника", en: "A Place for the Cache", tr: "Zula İçin Bir Yer",
    es: "Un sitio para el escondite", pt: "Um lugar para o esconderijo",
    de: "Ein Ort für das Versteck", fr: "Un lieu pour la cache",
    descRu: "Мирская два дня выбирает место для тайника. Оно должно быть совсем не похоже на тайник.",
    descEn: "Marlowe spends two days picking the cache spot. It must look nothing like a cache.",
    descTr: "Marlowe iki gün boyunca zula yeri seçiyor. Yer hiç zula gibi görünmemeli.",
    descEs: "Marlowe pasa dos días eligiendo el sitio del escondite. No debe parecer un escondite.",
    descPt: "Marlowe passa dois dias escolhendo o local. Não pode parecer um esconderijo.",
    descDe: "Marlowe sucht zwei Tage einen Versteckplatz. Er darf nicht nach Versteck aussehen.",
    descFr: "Marlowe passe deux jours à choisir le lieu de la cache. Il ne doit pas en avoir l'air.",
  },
  {
    ru: "Других не осталось", en: "No Others Left", tr: "Başkası Kalmadı",
    es: "No quedan otros", pt: "Não restam outros",
    de: "Andere gibt es nicht mehr", fr: "Il n'en reste pas d'autres",
    descRu: "«Плохое решение, но других не осталось», — Руденко произнёс это первым.",
    descEn: "\"A bad decision, but no others are left,\" Calder was the first to say it.",
    descTr: "\"Kötü bir karar, ama başkası kalmadı,\" diyen ilk Calder oldu.",
    descEs: "«Mala decisión, pero no quedan otras», Calder fue el primero en decirlo.",
    descPt: "«Decisão ruim, mas não restam outras», Calder foi o primeiro a dizer.",
    descDe: "«Eine schlechte Entscheidung, aber andere sind nicht übrig,» sagt Calder zuerst.",
    descFr: "« Mauvaise décision, mais c'est la seule », c'est Calder qui l'a dit le premier.",
  },
  {
    ru: "Графы не предусмотрено", en: "No Column for That", tr: "Bunun İçin Sütun Yok",
    es: "No hay columna para eso", pt: "Não há coluna para isso",
    de: "Dafür ist keine Spalte vorgesehen", fr: "Aucune colonne prévue pour cela",
    descRu: "Левин кладёт диск в контейнер и думает, что для такого реестр не предусмотрел графы.",
    descEn: "Mercer puts the disc in its container and thinks the registry has no column for this.",
    descTr: "Mercer diski muhafazasına koyuyor ve böyle bir şey için sicilde sütun yok diye düşünüyor.",
    descEs: "Mercer guarda el disco en el contenedor y piensa que el inventario no tiene columna para esto.",
    descPt: "Mercer coloca o disco no contêiner e pensa que o inventário não tem coluna para isso.",
    descDe: "Mercer legt die Scheibe in den Behälter und denkt, das Inventar hat dafür keine Spalte.",
    descFr: "Mercer met le disque dans le conteneur et pense que l'inventaire n'a pas de colonne pour ça.",
  },
  {
    ru: "Групповой снимок", en: "Group Photograph", tr: "Grup Fotoğrafı",
    es: "Fotografía de grupo", pt: "Fotografia de grupo",
    de: "Gruppenfoto", fr: "Photographie de groupe",
    descRu: "Свет низкий и контрастный. Климова всё равно жмёт спуск, и все пятеро в кадре.",
    descEn: "The light is low and harsh. Reed presses the shutter anyway, all five of them in frame.",
    descTr: "Işık alçak ve kontrastlı. Reed yine de deklanşöre basıyor, beş kişi de karede.",
    descEs: "Luz baja y dura. Reed dispara igualmente, los cinco están en el cuadro.",
    descPt: "Luz baixa e dura. Reed dispara mesmo assim, os cinco ficam no quadro.",
    descDe: "Das Licht ist niedrig und hart. Reed löst trotzdem aus, alle fünf im Bild.",
    descFr: "Lumière basse et dure. Reed appuie quand même, les cinq sont dans le cadre.",
  },
  {
    ru: "Цифры сошлись", en: "The Numbers Add Up", tr: "Sayılar Tutuyor",
    es: "Los números cuadran", pt: "Os números batem",
    de: "Die Zahlen stimmen", fr: "Les chiffres concordent",
    descRu: "Руденко пересчитывает воду и рацион ещё раз. На этот раз цифры сходятся.",
    descEn: "Calder counts the water and rations once more. This time the numbers add up.",
    descTr: "Calder suyu ve tayını bir kez daha sayıyor. Bu sefer sayılar tutuyor.",
    descEs: "Calder recuenta agua y ración una vez más. Esta vez los números cuadran.",
    descPt: "Calder reconta água e ração mais uma vez. Desta vez os números batem.",
    descDe: "Calder zählt Wasser und Proviant noch einmal nach. Diesmal stimmen die Zahlen.",
    descFr: "Calder recompte l'eau et les vivres encore une fois. Cette fois les chiffres tombent juste.",
  },
  {
    ru: "Шаг за шагом", en: "Step by Step", tr: "Adım Adım",
    es: "Paso a paso", pt: "Passo a passo",
    de: "Schritt für Schritt", fr: "Pas à pas",
    descRu: "Воронов начинает понимать: исчезновение никогда не бывает мгновенным.",
    descEn: "Cole begins to understand that disappearing is never something that happens at once.",
    descTr: "Cole anlamaya başlıyor: kaybolmak hiçbir zaman bir anda olmaz.",
    descEs: "Cole empieza a entender que desaparecer nunca ocurre de un solo golpe.",
    descPt: "Cole começa a entender que desaparecer nunca acontece de uma vez.",
    descDe: "Cole beginnt zu begreifen, dass Verschwinden nie auf einen Schlag passiert.",
    descFr: "Cole commence à comprendre que disparaître n'arrive jamais d'un seul coup.",
  },
  {
    ru: "По линиям смысла", en: "Along the Lines of Meaning", tr: "Anlamın İzinde",
    es: "Por las líneas del sentido", pt: "Pelas linhas do sentido",
    de: "Entlang der Linien des Sinns", fr: "Le long des lignes du sens",
    descRu: "Карту режут по линиям смысла, а записи раскладывают по привязкам к местности.",
    descEn: "The map gets cut along lines of meaning, the notes laid out by ties to the ground.",
    descTr: "Harita anlam çizgilerine göre kesiliyor, notlar araziye bağlı şekilde diziliyor.",
    descEs: "Cortan el mapa por líneas de sentido, y disponen las notas por sus vínculos con el terreno.",
    descPt: "Cortam o mapa pelas linhas de sentido, e dispõem as notas pelos vínculos com o terreno.",
    descDe: "Die Karte wird nach Sinnlinien zerschnitten, die Notizen nach Geländebezug geordnet.",
    descFr: "On découpe la carte selon les lignes de sens, on range les notes par leurs liens au terrain.",
  },
  {
    ru: "Единственный ключ", en: "The Only Key", tr: "Tek Anahtar",
    es: "La única llave", pt: "A única chave",
    de: "Der einzige Schlüssel", fr: "La seule clé",
    descRu: "Это последний лист дела. Если ты добрался до него, ты понял, как мы спрятали остальное.",
    descEn: "This is the last sheet of the file. If you've reached it, you've seen how we hid the rest.",
    descTr: "Dosyanın son sayfası. Buraya ulaştıysan, gerisini nasıl sakladığımızı anladın demektir.",
    descEs: "Es la última hoja del expediente. Si has llegado, comprendiste cómo escondimos lo demás.",
    descPt: "É a última folha do processo. Se chegou aqui, entendeu como escondemos o resto.",
    descDe: "Das letzte Blatt der Akte. Wer hierher kam, hat begriffen, wie wir den Rest verbargen.",
    descFr: "C'est la dernière feuille du dossier. Si tu y es, tu as compris comment on a caché le reste.",
  },
] as const;

export const NARRATIVE_POINTS: NarrativePoint[] = REWARD_IDS.map((rewardId, index) => {
  const chapterIndex = Math.floor(index / 10);
  const nodeIndex = (index % 10) + 1;
  const serial = String(index + 1).padStart(2, "0");
  const data = POINT_DATA[index];

  return {
    pointId: `pt_${serial}`,
    chapterId: CHAPTER_IDS[chapterIndex] ?? "chapter_01",
    dealId: `c${chapterIndex + 1}n${nodeIndex}`,
    entryId: `entry_${serial}`,
    rewardId,
    titleRu: data?.ru ?? `Точка ${index + 1}`,
    titleEn: data?.en ?? `Point ${index + 1}`,
    titleTr: data?.tr ?? `Nokta ${index + 1}`,
    titleEs: data?.es ?? `Punto ${index + 1}`,
    titlePt: data?.pt ?? `Ponto ${index + 1}`,
    titleDe: data?.de ?? `Punkt ${index + 1}`,
    titleFr: data?.fr ?? `Point ${index + 1}`,
    mapDescriptionRu: data?.descRu ?? "",
    mapDescriptionEn: data?.descEn ?? "",
    mapDescriptionTr: data?.descTr ?? "",
    mapDescriptionEs: data?.descEs ?? "",
    mapDescriptionPt: data?.descPt ?? "",
    mapDescriptionDe: data?.descDe ?? "",
    mapDescriptionFr: data?.descFr ?? "",
  };
});

export function getPointByDealId(dealId: string): NarrativePoint | undefined {
  return NARRATIVE_POINTS.find((point) => point.dealId === dealId);
}

export function getPointByPointId(pointId: string): NarrativePoint | undefined {
  return NARRATIVE_POINTS.find((point) => point.pointId === pointId);
}

// Все поддерживаемые narrative-локали (совпадает с UI-локалями + исторический
// "global" для обратной совместимости — отображается как английский).
type PointLocale = "ru" | "en" | "global" | "tr" | "es" | "pt" | "de" | "fr";

function pickPointTitle(point: NarrativePoint, locale: PointLocale): string {
  if (locale === "ru") return point.titleRu;
  if (locale === "tr") return point.titleTr ?? point.titleEn;
  if (locale === "es") return point.titleEs ?? point.titleEn;
  if (locale === "pt") return point.titlePt ?? point.titleEn;
  if (locale === "de") return point.titleDe ?? point.titleEn;
  if (locale === "fr") return point.titleFr ?? point.titleEn;
  return point.titleEn;
}

function pickPointMapDescription(point: NarrativePoint, locale: PointLocale): string {
  if (locale === "ru") return point.mapDescriptionRu;
  if (locale === "tr") return point.mapDescriptionTr || point.mapDescriptionEn;
  if (locale === "es") return point.mapDescriptionEs || point.mapDescriptionEn;
  if (locale === "pt") return point.mapDescriptionPt || point.mapDescriptionEn;
  if (locale === "de") return point.mapDescriptionDe || point.mapDescriptionEn;
  if (locale === "fr") return point.mapDescriptionFr || point.mapDescriptionEn;
  return point.mapDescriptionEn;
}

export function getPointTitleByPointId(
  pointId: string,
  locale: PointLocale,
): string | undefined {
  const point = getPointByPointId(pointId);
  if (!point) {
    return undefined;
  }

  return pickPointTitle(point, locale);
}

export function getPointTitleByDealId(
  dealId: string,
  locale: PointLocale,
): string | undefined {
  const point = getPointByDealId(dealId);
  if (!point) {
    return undefined;
  }

  return pickPointTitle(point, locale);
}

/**
 * Короткое описание точки для нижней map-панели. Не обрезается —
 * каждое описание гарантированно помещается в 3 строки CSS-клампа.
 */
export function getPointMapDescriptionByDealId(
  dealId: string,
  locale: PointLocale,
): string {
  const point = getPointByDealId(dealId);
  if (!point) {
    return "";
  }

  return pickPointMapDescription(point, locale);
}
