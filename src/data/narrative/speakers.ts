export type NarrativeSpeakerLocale = "ru" | "global" | "tr";

export type NarrativeSpeakerProfile = {
  entityId: string;
  fullName: string;
  shortName: string;
  initials: string;
  accent: string;
  portraitKey: string;
};

const SPEAKER_PROFILES: Record<NarrativeSpeakerLocale, Record<string, NarrativeSpeakerProfile>> = {
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

export function getNarrativeSpeakerProfile(
  speakerEntityId: string,
  locale: NarrativeSpeakerLocale
): NarrativeSpeakerProfile {
  return SPEAKER_PROFILES[locale][speakerEntityId] ?? {
    entityId: speakerEntityId,
    fullName: speakerEntityId,
    shortName: speakerEntityId,
    initials: speakerEntityId.slice(0, 2).toUpperCase(),
    accent: "#8f8570",
    portraitKey: "voronov",
  };
}
