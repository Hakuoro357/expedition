import type { GameMode } from "@/core/game-state/types";

export type RewardPreviewLink = {
  dealId: string;
  label: string;
  url: string;
};

export type DevScenePreview =
  | {
      scene: "reward";
      dealId?: string;
      mode: GameMode;
      preview: true;
    }
  | {
      scene: "reward-list";
      preview: true;
    }
  | {
      scene: "game-end";
      screen: "loss" | "autocomplete" | "win" | "rules" | "leave";
      preview: true;
    }
  | {
      scene: "unlock-all";
      preview: true;
    }
  | {
      scene: "unlock-playable";
      preview: true;
    };

const VALID_MODES = new Set<GameMode>(["adventure", "daily", "quick-play"]);
const DEAL_ID_PATTERN = /^c\d+n\d+$/;

const GAME_END_SCREENS = new Set(["loss", "autocomplete", "win", "rules", "leave"]);

export type DevPreviewLink = {
  label: string;
  url: string;
};

export function getRewardPreviewLinks(baseUrl: string): RewardPreviewLink[] {
  return [
    {
      dealId: "c1n3",
      label: "c1n3 — запись + карта",
      url: `${baseUrl}/?preview=reward&dealId=c1n3&mode=adventure`,
    },
    {
      dealId: "c2n6",
      label: "c2n6 — запись + артефакт",
      url: `${baseUrl}/?preview=reward&dealId=c2n6&mode=adventure`,
    },
    {
      dealId: "c3n1",
      label: "c3n1 — запись + карта",
      url: `${baseUrl}/?preview=reward&dealId=c3n1&mode=adventure`,
    },
  ];
}

export function getDevActionLinks(baseUrl: string): DevPreviewLink[] {
  return [
    { label: "Разблокировать всё", url: `${baseUrl}/?preview=unlock-all` },
    { label: "Все точки играбельны", url: `${baseUrl}/?preview=unlock-playable` },
  ];
}

export function getGameEndPreviewLinks(baseUrl: string): DevPreviewLink[] {
  return [
    { label: "Поражение (нет ходов)", url: `${baseUrl}/?preview=game-end&screen=loss` },
    { label: "Авто-завершение", url: `${baseUrl}/?preview=game-end&screen=autocomplete` },
    { label: "Победа → Награда", url: `${baseUrl}/?preview=game-end&screen=win` },
    { label: "Правила", url: `${baseUrl}/?preview=game-end&screen=rules` },
    { label: "Покинуть игру", url: `${baseUrl}/?preview=game-end&screen=leave` },
  ];
}

export function getDevScenePreview(
  search: string,
  isDev: boolean
): DevScenePreview | null {
  if (!isDev) {
    return null;
  }

  const params = new URLSearchParams(search);
  const preview = params.get("preview");

  if (preview === "reward-list") {
    return {
      scene: "reward-list",
      preview: true,
    };
  }

  if (preview === "unlock-all") {
    return {
      scene: "unlock-all",
      preview: true,
    };
  }

  if (preview === "unlock-playable") {
    return {
      scene: "unlock-playable",
      preview: true,
    };
  }

  if (preview === "game-end") {
    const screen = params.get("screen") ?? "";
    if (GAME_END_SCREENS.has(screen)) {
      return {
        scene: "game-end",
        screen: screen as "loss" | "autocomplete" | "win" | "rules" | "leave",
        preview: true,
      };
    }
    return null;
  }

  if (preview !== "reward") {
    return null;
  }

  const rawMode = params.get("mode");
  const normalizedMode = rawMode === "quick" ? "quick-play" : rawMode;
  const mode = normalizedMode && VALID_MODES.has(normalizedMode as GameMode)
    ? (normalizedMode as GameMode)
    : "quick-play";

  const dealId = params.get("dealId") ?? undefined;
  const validDealId = dealId && DEAL_ID_PATTERN.test(dealId) ? dealId : undefined;

  return {
    scene: "reward",
    dealId: validDealId,
    mode: validDealId ? mode : "quick-play",
    preview: true,
  };
}
