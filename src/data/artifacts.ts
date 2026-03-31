export type Artifact = {
  id: string;
  chapter: number;
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  /** Unicode icon displayed in the diary */
  icon: string;
};

export const ARTIFACTS: Artifact[] = [
  // ── Chapter 1: Северный маршрут ──────────────────────────────────────────
  {
    id: "compass",
    chapter: 1,
    titleRu: "Компас экспедиции",
    titleEn: "Expedition Compass",
    descriptionRu: "Старый медный компас. Стрелка до сих пор указывает на север.",
    descriptionEn: "An old brass compass. The needle still points true north.",
    icon: "🧭",
  },
  {
    id: "old-map",
    chapter: 1,
    titleRu: "Фрагмент карты",
    titleEn: "Map Fragment",
    descriptionRu: "Пожелтевший кусок карты с пометками карандашом.",
    descriptionEn: "A yellowed map scrap with pencil annotations.",
    icon: "🗺️",
  },
  {
    id: "explorer-badge",
    chapter: 1,
    titleRu: "Жетон исследователя",
    titleEn: "Explorer's Badge",
    descriptionRu: "Металлический жетон с гравировкой — знак участника экспедиции.",
    descriptionEn: "An engraved metal tag — a mark of the expedition team.",
    icon: "🔖",
  },

  // ── Chapter 2: Горный перевал ─────────────────────────────────────────────
  {
    id: "pickaxe",
    chapter: 2,
    titleRu: "Походный кирк",
    titleEn: "Field Pickaxe",
    descriptionRu: "Небольшой кирк для раскопок. Рукоятка потёрта от долгой работы.",
    descriptionEn: "A compact digging pick, its handle worn smooth from use.",
    icon: "⛏️",
  },
  {
    id: "field-journal",
    chapter: 2,
    titleRu: "Полевой дневник",
    titleEn: "Field Journal",
    descriptionRu: "Потрёпанный блокнот с записями о маршруте и зарисовками.",
    descriptionEn: "A worn notebook filled with route notes and quick sketches.",
    icon: "📓",
  },
  {
    id: "lantern",
    chapter: 2,
    titleRu: "Карманный фонарь",
    titleEn: "Pocket Lantern",
    descriptionRu: "Небольшой латунный фонарь. В горах без него не обойтись.",
    descriptionEn: "A small brass lantern — indispensable in the mountain passes.",
    icon: "🏮",
  },

  // ── Chapter 3: Речной лагерь ──────────────────────────────────────────────
  {
    id: "canoe-paddle",
    chapter: 3,
    titleRu: "Весло лодочника",
    titleEn: "Canoe Paddle",
    descriptionRu: "Короткое деревянное весло с выцветшим орнаментом.",
    descriptionEn: "A short wooden paddle with a faded painted pattern.",
    icon: "🛶",
  },
  {
    id: "fishing-rod",
    chapter: 3,
    titleRu: "Удочка",
    titleEn: "Fishing Rod",
    descriptionRu: "Бамбуковая удочка — лучший способ провести вечер у реки.",
    descriptionEn: "A bamboo rod — the best way to spend an evening by the river.",
    icon: "🎣",
  },
  {
    id: "camp-kettle",
    chapter: 3,
    titleRu: "Лагерный котелок",
    titleEn: "Camp Kettle",
    descriptionRu: "Закопчённый котелок. Сварил не одну кружку крепкого чая.",
    descriptionEn: "A soot-blackened kettle. Brewed many a strong cup of tea.",
    icon: "🫖",
  },
];

export function getArtifactById(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export function getChapterArtifacts(chapter: number): Artifact[] {
  return ARTIFACTS.filter((a) => a.chapter === chapter);
}
