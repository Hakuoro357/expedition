import { getNamingValue } from "@/data/naming";

const expeditionNamePt = getNamingValue("expedition_name", "pt");
const artifactMainPt = getNamingValue("artifact_main", "pt");

export const rewardTextsPt = {
  reward_diary_page_01: { title: "Primeira página do diário", description: "A primeira voz da expedição e o início da reconstrução da rota." },
  reward_expedition_stamp_01: { title: "Carimbo da expedição", description: `Prova de que o caso da ${expeditionNamePt} realmente existiu.` },
  reward_map_piece_01: { title: "Primeiro fragmento do mapa", description: "A rota começa a ganhar forma visualmente." },
  reward_camp_marker_01: { title: "Marco de acampamento", description: "Mais um ponto fixo do caminho real." },
  reward_stone_sign_note_01: { title: "Anotação junto ao marco de pedra", description: "O primeiro traço silencioso do sistema de marcos." },
  reward_unknown_item_01: { title: "Objeto sem registro", description: "Um achado ausente do inventário oficial." },
  reward_photo_ridge_01: { title: "Foto do acesso ao cume", description: "Prova visual guardada para um leitor futuro." },
  reward_map_variant_01: { title: "Esquema com divergências", description: "O primeiro sinal claro de uma rota dividida." },
  reward_map_piece_02: { title: "Fragmento adicional do mapa", description: "A linha oficial parece cada vez menos com a verdade." },
  reward_chapter_piece_01: { title: "Fragmento-chave do capítulo", description: "A camada oculta do primeiro trecho começa a se revelar." },
  reward_diary_page_damaged_01: { title: "Página danificada do diário", description: "O tom das anotações fica mais cauteloso e mais sombrio." },
  reward_map_variant_02: { title: "Mapa de linha dupla", description: "Duas versões do caminho tornam-se visíveis ao mesmo tempo." },
  reward_levin_note_01: { title: "Nota de Mercer", description: "A escala do achado começa a ficar clara." },
  reward_hidden_camp_marker_01: { title: "Marco do acampamento oculto", description: "Confirma-se um deslocamento deliberado da rota." },
  reward_torn_paper_01: { title: "Folha de trabalho rasgada", description: "Os registros deixam de se comportar como um todo." },
  reward_anonymous_note_01: { title: "Bilhete sem assinatura", description: "Uma voz interna surge dentro do arquivo." },
  reward_false_map_piece_01: { title: "Fragmento falso do mapa", description: "A rota-engodo se torna matéria." },
  reward_artifact_case_01: { title: "Estojo do artefato", description: `O achado principal começa a ganhar peso em torno do ${artifactMainPt}.` },
  reward_photo_key_01: { title: "Fotografia-chave", description: "Uma imagem feita já pensando em uma leitura futura." },
  reward_chapter_piece_02: { title: "Fragmento de encerramento do capítulo", description: "O ocultamento já não está em dúvida." },
  reward_map_major_01: { title: "Fragmento maior do mapa oculto", description: "A rota verdadeira volta a se montar." },
  reward_diary_page_02: { title: "Última entrada curta", description: "O diário se reduz à pura precisão." },
  reward_final_camp_scheme_01: { title: "Esquema do último acampamento", description: "Preparação para o esconderijo e o desfecho." },
  reward_personal_item_01: { title: "Objeto pessoal", description: "Um lembrete das pessoas dentro da decisão." },
  reward_artifact_case_major_01: { title: "Contêiner do disco", description: `O ${artifactMainPt} ganha contexto físico.` },
  reward_group_photo_final_01: { title: "Foto final do grupo", description: "Memória da equipe, não apenas do resultado." },
  reward_logistics_note_01: { title: "Anotação de logística", description: "Prova de que a saída escolhida era de fato viável." },
  reward_archive_note_01: { title: "Anotação de arquivo", description: "O desaparecimento mostra-se como um processo, não um instante." },
  reward_archive_seal_01: { title: "Selo do arquivo", description: `A autorização final para encerrar o caso da ${expeditionNamePt}.` },
  reward_finale_bundle_01: { title: "Arquivo completo", description: `O ${artifactMainPt}, o mapa inteiro e a história restaurada.` },
} as const;
