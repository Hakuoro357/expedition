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
    };

const VALID_MODES = new Set<GameMode>(["adventure", "daily", "quick-play"]);
const DEAL_ID_PATTERN = /^c\d+n\d+$/;

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
