import { getNamingValue } from "@/data/naming";

const expeditionNameFr = getNamingValue("expedition_name", "fr");
const artifactMainFr = getNamingValue("artifact_main", "fr");

export const rewardTextsFr = {
  reward_diary_page_01: { title: "Première page du journal", description: "La première voix de l'expédition et le début de la reconstitution de l'itinéraire." },
  reward_expedition_stamp_01: { title: "Tampon de l'expédition", description: `Preuve que le dossier de ${expeditionNameFr} a bel et bien existé.` },
  reward_map_piece_01: { title: "Premier fragment de carte", description: "L'itinéraire commence à prendre forme visuellement." },
  reward_camp_marker_01: { title: "Marque de campement", description: "Un autre point fixe du vrai chemin." },
  reward_stone_sign_note_01: { title: "Note près du repère de pierre", description: "La première trace silencieuse du système de repères." },
  reward_unknown_item_01: { title: "Objet non répertorié", description: "Une découverte absente de l'inventaire officiel." },
  reward_photo_ridge_01: { title: "Photo de l'approche de la crête", description: "Un témoignage visuel conservé pour un lecteur futur." },
  reward_map_variant_01: { title: "Schéma avec divergences", description: "Le premier signe clair d'un itinéraire double." },
  reward_map_piece_02: { title: "Fragment supplémentaire de la carte", description: "La ligne officielle ressemble de moins en moins à la vérité." },
  reward_chapter_piece_01: { title: "Fragment clé du chapitre", description: "La couche cachée du premier tronçon commence à s'ouvrir." },
  reward_diary_page_damaged_01: { title: "Page endommagée du journal", description: "Le ton des notes devient plus prudent, plus sombre." },
  reward_map_variant_02: { title: "Carte à double trait", description: "Deux versions du chemin deviennent visibles en même temps." },
  reward_levin_note_01: { title: "Note de Mercer", description: "L'ampleur de la découverte commence à se préciser." },
  reward_hidden_camp_marker_01: { title: "Marque du camp caché", description: "Un déplacement volontaire de l'itinéraire est confirmé." },
  reward_torn_paper_01: { title: "Feuille de travail déchirée", description: "Les documents cessent de se comporter comme un tout." },
  reward_anonymous_note_01: { title: "Note sans signature", description: "Une voix intérieure apparaît au sein des archives." },
  reward_false_map_piece_01: { title: "Fragment factice de la carte", description: "L'itinéraire-leurre prend forme matérielle." },
  reward_artifact_case_01: { title: "Étui de l'artéfact", description: `La découverte principale prend du poids autour du ${artifactMainFr}.` },
  reward_photo_key_01: { title: "Photographie clé", description: "Un cliché déjà pris en pensant à une lecture future." },
  reward_chapter_piece_02: { title: "Fragment de clôture du chapitre", description: "La dissimulation ne fait plus de doute." },
  reward_map_major_01: { title: "Grand fragment de la carte cachée", description: "Le vrai parcours recommence à se recomposer." },
  reward_diary_page_02: { title: "Dernière note brève", description: "Le journal se réduit à une précision pure." },
  reward_final_camp_scheme_01: { title: "Plan du dernier campement", description: "Préparation de la cache et du dénouement." },
  reward_personal_item_01: { title: "Effet personnel", description: "Un rappel des personnes à l'intérieur de la décision." },
  reward_artifact_case_major_01: { title: "Conteneur du disque", description: `Le ${artifactMainFr} gagne un contexte physique.` },
  reward_group_photo_final_01: { title: "Photographie de groupe finale", description: "Mémoire de l'équipe, pas seulement du résultat." },
  reward_logistics_note_01: { title: "Note de logistique", description: "Preuve que la sortie choisie était bel et bien réalisable." },
  reward_archive_note_01: { title: "Note d'archives", description: "La disparition apparaît comme un processus, non un instant." },
  reward_archive_seal_01: { title: "Sceau des archives", description: `L'autorisation finale pour clore le dossier de ${expeditionNameFr}.` },
  reward_finale_bundle_01: { title: "Archives complètes", description: `Le ${artifactMainFr}, la carte entière et l'histoire restaurée.` },
} as const;
