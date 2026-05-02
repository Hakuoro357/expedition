// Narrative-локали для speaker profile: исторический "global" = английский
// (Latin names Adrian Cole, Tessa Marlowe, etc.) используется для en/es/pt/de/fr —
// у этих европейских локалей по конвенции проекта общий международный
// именной пакет. ru/tr имеют свои локальные именные паки.
export type NarrativeSpeakerLocale = "ru" | "global" | "tr" | "en" | "es" | "pt" | "de" | "fr";

export type NarrativeSpeakerProfile = {
  entityId: string;
  fullName: string;
  shortName: string;
  initials: string;
  accent: string;
  portraitKey: string;
};

const SPEAKER_PROFILES: Record<"ru" | "global" | "tr", Record<string, NarrativeSpeakerProfile>> = {
  ru: {
    leader: {
      entityId: "leader",
      fullName: "Алексей Воронов",
      shortName: "Воронов",
      initials: "АВ",
      accent: "#7c9f8f",
      portraitKey: "voronov",
    },
    cartographer: {
      entityId: "cartographer",
      fullName: "Елена Мирская",
      shortName: "Мирская",
      initials: "ЕМ",
      accent: "#8f8abb",
      portraitKey: "mirskaya",
    },
    archaeologist: {
      entityId: "archaeologist",
      fullName: "Георгий Левин",
      shortName: "Левин",
      initials: "ГЛ",
      accent: "#b28b62",
      portraitKey: "levin",
    },
    quartermaster_guide: {
      entityId: "quartermaster_guide",
      fullName: "Михаил Руденко",
      shortName: "Руденко",
      initials: "МР",
      accent: "#7f9c68",
      portraitKey: "rudenko",
    },
    photographer_archivist: {
      entityId: "photographer_archivist",
      fullName: "Софья Климова",
      shortName: "Климова",
      initials: "СК",
      accent: "#a06f7f",
      portraitKey: "klimova",
    },
  },
  global: {
    leader: {
      entityId: "leader",
      fullName: "Adrian Cole",
      shortName: "Cole",
      initials: "AC",
      accent: "#7c9f8f",
      portraitKey: "voronov",
    },
    cartographer: {
      entityId: "cartographer",
      fullName: "Tessa Marlowe",
      shortName: "Marlowe",
      initials: "TM",
      accent: "#8f8abb",
      portraitKey: "mirskaya",
    },
    archaeologist: {
      entityId: "archaeologist",
      fullName: "Julian Mercer",
      shortName: "Mercer",
      initials: "JM",
      accent: "#b28b62",
      portraitKey: "levin",
    },
    quartermaster_guide: {
      entityId: "quartermaster_guide",
      fullName: "Simon Calder",
      shortName: "Calder",
      initials: "SC",
      accent: "#7f9c68",
      portraitKey: "rudenko",
    },
    photographer_archivist: {
      entityId: "photographer_archivist",
      fullName: "Clara Reed",
      shortName: "Reed",
      initials: "CR",
      accent: "#a06f7f",
      portraitKey: "klimova",
    },
  },
  // Турецкая локаль использует те же латинские имена персонажей,
  // что и глобальная (см. LOCALIZATION_PLAN.md — Variant B).
  tr: {
    leader: {
      entityId: "leader",
      fullName: "Adrian Cole",
      shortName: "Cole",
      initials: "AC",
      accent: "#7c9f8f",
      portraitKey: "voronov",
    },
    cartographer: {
      entityId: "cartographer",
      fullName: "Tessa Marlowe",
      shortName: "Marlowe",
      initials: "TM",
      accent: "#8f8abb",
      portraitKey: "mirskaya",
    },
    archaeologist: {
      entityId: "archaeologist",
      fullName: "Julian Mercer",
      shortName: "Mercer",
      initials: "JM",
      accent: "#b28b62",
      portraitKey: "levin",
    },
    quartermaster_guide: {
      entityId: "quartermaster_guide",
      fullName: "Simon Calder",
      shortName: "Calder",
      initials: "SC",
      accent: "#7f9c68",
      portraitKey: "rudenko",
    },
    photographer_archivist: {
      entityId: "photographer_archivist",
      fullName: "Clara Reed",
      shortName: "Reed",
      initials: "CR",
      accent: "#a06f7f",
      portraitKey: "klimova",
    },
  },
};

/**
 * Резолвит narrative-локаль в пакет профилей:
 *   ru → русские имена;
 *   tr → латинские имена (по конвенции проекта);
 *   en/es/pt/de/fr/global → латинские имена (global pack).
 */
function resolveProfilePack(
  locale: NarrativeSpeakerLocale,
): Record<string, NarrativeSpeakerProfile> {
  if (locale === "ru") return SPEAKER_PROFILES.ru;
  if (locale === "tr") return SPEAKER_PROFILES.tr;
  return SPEAKER_PROFILES.global;
}

export function getNarrativeSpeakerProfile(
  speakerEntityId: string,
  locale: NarrativeSpeakerLocale
): NarrativeSpeakerProfile {
  const pack = resolveProfilePack(locale);
  return pack[speakerEntityId] ?? {
    entityId: speakerEntityId,
    fullName: speakerEntityId,
    shortName: speakerEntityId,
    initials: speakerEntityId.slice(0, 2).toUpperCase(),
    accent: "#8f8570",
    portraitKey: "voronov",
  };
}
