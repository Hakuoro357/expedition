import { getNamingValue } from "@/data/naming";

const expeditionNameDe = getNamingValue("expedition_name", "de");
const artifactMainDe = getNamingValue("artifact_main", "de");

export const rewardTextsDe = {
  reward_diary_page_01: { title: "Erste Tagebuchseite", description: "Die erste Stimme der Expedition und der Beginn der Rekonstruktion der Route." },
  reward_expedition_stamp_01: { title: "Expeditionsstempel", description: `Beweis, dass die Akte von ${expeditionNameDe} tatsächlich existierte.` },
  reward_map_piece_01: { title: "Erstes Kartenfragment", description: "Die Route beginnt sichtbar Gestalt anzunehmen." },
  reward_camp_marker_01: { title: "Lagerzeichen", description: "Ein weiterer fester Punkt des tatsächlichen Weges." },
  reward_stone_sign_note_01: { title: "Notiz am Steinzeichen", description: "Die erste leise Spur des Markierungssystems." },
  reward_unknown_item_01: { title: "Nicht verzeichnetes Objekt", description: "Ein Fund, der im offiziellen Verzeichnis fehlt." },
  reward_photo_ridge_01: { title: "Foto vom Zugang zum Kamm", description: "Visueller Beleg, aufbewahrt für einen späteren Leser." },
  reward_map_variant_01: { title: "Schema mit Abweichungen", description: "Das erste klare Zeichen für eine geteilte Route." },
  reward_map_piece_02: { title: "Zusätzliches Kartenfragment", description: "Die offizielle Linie ähnelt immer weniger der Wahrheit." },
  reward_chapter_piece_01: { title: "Schlüsselfragment des Kapitels", description: "Die verborgene Schicht des ersten Abschnitts öffnet sich." },
  reward_diary_page_damaged_01: { title: "Beschädigte Tagebuchseite", description: "Der Ton der Einträge wird vorsichtiger und dunkler." },
  reward_map_variant_02: { title: "Karte mit doppelter Linie", description: "Zwei Versionen des Weges werden gleichzeitig sichtbar." },
  reward_levin_note_01: { title: "Mercers Notiz", description: "Das Ausmaß des Fundes wird allmählich greifbar." },
  reward_hidden_camp_marker_01: { title: "Zeichen des versteckten Lagers", description: "Eine bewusste Verlagerung der Route ist bestätigt." },
  reward_torn_paper_01: { title: "Zerrissenes Arbeitsblatt", description: "Die Aufzeichnungen verhalten sich nicht mehr wie ein Ganzes." },
  reward_anonymous_note_01: { title: "Unsignierte Notiz", description: "Eine innere Stimme erscheint im Archiv." },
  reward_false_map_piece_01: { title: "Falsches Kartenfragment", description: "Die Ablenkungsroute wird zu Material." },
  reward_artifact_case_01: { title: "Artefakt-Etui", description: `Der Hauptfund gewinnt Gewicht rund um die ${artifactMainDe}.` },
  reward_photo_key_01: { title: "Schlüsselfotografie", description: "Ein Bild, das bereits mit Blick auf spätere Leser gemacht wurde." },
  reward_chapter_piece_02: { title: "Abschlussfragment des Kapitels", description: "An der Verheimlichung gibt es keinen Zweifel mehr." },
  reward_map_major_01: { title: "Großes Teil der verborgenen Karte", description: "Die wahre Route fügt sich wieder zusammen." },
  reward_diary_page_02: { title: "Letzter kurzer Eintrag", description: "Das Tagebuch verengt sich zu reiner Präzision." },
  reward_final_camp_scheme_01: { title: "Schema des letzten Lagers", description: "Vorbereitung auf das Versteck und den Abschluss." },
  reward_personal_item_01: { title: "Persönlicher Gegenstand", description: "Eine Erinnerung an die Menschen hinter der Entscheidung." },
  reward_artifact_case_major_01: { title: "Scheibenbehälter", description: `Die ${artifactMainDe} gewinnt physischen Kontext.` },
  reward_group_photo_final_01: { title: "Abschließendes Gruppenfoto", description: "Erinnerung an das Team, nicht nur an das Ergebnis." },
  reward_logistics_note_01: { title: "Logistiknotiz", description: "Beleg dafür, dass der gewählte Ausgang tatsächlich machbar war." },
  reward_archive_note_01: { title: "Archivnotiz", description: "Das Verschwinden offenbart sich als Prozess, nicht als Moment." },
  reward_archive_seal_01: { title: "Archivsiegel", description: `Die endgültige Freigabe, die Akte von ${expeditionNameDe} zu schließen.` },
  reward_finale_bundle_01: { title: "Abgeschlossenes Archiv", description: `Die ${artifactMainDe}, die vollständige Karte und die wiederhergestellte Geschichte.` },
} as const;
