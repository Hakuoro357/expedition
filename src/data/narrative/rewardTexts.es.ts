import { getNamingValue } from "@/data/naming";

const expeditionNameEs = getNamingValue("expedition_name", "es");
const artifactMainEs = getNamingValue("artifact_main", "es");

export const rewardTextsEs = {
  reward_diary_page_01: { title: "Primera página del diario", description: "La primera voz de la expedición y el inicio de la reconstrucción de la ruta." },
  reward_expedition_stamp_01: { title: "Sello de la expedición", description: `Prueba de que el caso de ${expeditionNameEs} existió realmente.` },
  reward_map_piece_01: { title: "Primer fragmento del mapa", description: "La ruta empieza a tomar forma visualmente." },
  reward_camp_marker_01: { title: "Señal de campamento", description: "Otro punto fijo del camino real." },
  reward_stone_sign_note_01: { title: "Nota junto al mojón", description: "La primera huella silenciosa del sistema de señales." },
  reward_unknown_item_01: { title: "Objeto sin registrar", description: "Un hallazgo ausente del inventario oficial." },
  reward_photo_ridge_01: { title: "Foto del acceso a la cresta", description: "Evidencia visual conservada para un lector futuro." },
  reward_map_variant_01: { title: "Esquema con divergencias", description: "La primera señal clara de una ruta dividida." },
  reward_map_piece_02: { title: "Fragmento adicional del mapa", description: "La línea oficial se parece cada vez menos a la verdad." },
  reward_chapter_piece_01: { title: "Fragmento clave del capítulo", description: "La capa oculta del primer tramo empieza a revelarse." },
  reward_diary_page_damaged_01: { title: "Página dañada del diario", description: "El tono de las anotaciones cambia: más cauteloso, más oscuro." },
  reward_map_variant_02: { title: "Mapa de doble línea", description: "Las dos versiones del camino se vuelven visibles a la vez." },
  reward_levin_note_01: { title: "Nota de Mercer", description: "La escala del hallazgo empieza a aclararse." },
  reward_hidden_camp_marker_01: { title: "Señal del campamento oculto", description: "Se confirma el desplazamiento deliberado de la ruta." },
  reward_torn_paper_01: { title: "Hoja de trabajo rasgada", description: "Los registros dejan de comportarse como un conjunto." },
  reward_anonymous_note_01: { title: "Nota sin firma", description: "Una voz interna aparece dentro del archivo." },
  reward_false_map_piece_01: { title: "Fragmento falso del mapa", description: "La ruta señuelo se convierte en materia." },
  reward_artifact_case_01: { title: "Estuche del artefacto", description: `El hallazgo principal empieza a ganar peso alrededor del ${artifactMainEs}.` },
  reward_photo_key_01: { title: "Fotografía clave", description: "Una imagen tomada ya pensando en una lectura futura." },
  reward_chapter_piece_02: { title: "Fragmento de cierre del capítulo", description: "Ya no hay duda del ocultamiento." },
  reward_map_major_01: { title: "Fragmento mayor del mapa oculto", description: "La ruta verdadera vuelve a armarse." },
  reward_diary_page_02: { title: "Última anotación breve", description: "El diario se reduce a pura precisión." },
  reward_final_camp_scheme_01: { title: "Esquema del último campamento", description: "Preparación para el escondite y el desenlace." },
  reward_personal_item_01: { title: "Objeto personal", description: "Un recordatorio de las personas dentro de la decisión." },
  reward_artifact_case_major_01: { title: "Contenedor del disco", description: `El ${artifactMainEs} gana contexto físico.` },
  reward_group_photo_final_01: { title: "Foto de grupo final", description: "Memoria del equipo, no solo del resultado." },
  reward_logistics_note_01: { title: "Nota de logística", description: "Prueba de que la salida elegida era realmente posible." },
  reward_archive_note_01: { title: "Anotación de archivo", description: "La desaparición se revela como un proceso, no un instante." },
  reward_archive_seal_01: { title: "Sello del archivo", description: `La autorización final para cerrar el caso de ${expeditionNameEs}.` },
  reward_finale_bundle_01: { title: "Archivo completo", description: `El ${artifactMainEs}, el mapa entero y la historia restaurada.` },
} as const;
