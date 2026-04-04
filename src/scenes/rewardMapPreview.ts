import { CHAPTERS, getNodeById } from "@/data/chapters";
import { buildRoutePoints } from "@/scenes/mapSceneLayout";

export type RewardMapPreviewPoint = {
  x: number;
  y: number;
  state: "completed" | "current" | "upcoming";
};

export type RewardMapPreviewData = {
  chapterId: number;
  currentIndex: number;
  points: RewardMapPreviewPoint[];
};

export function getRewardMapPreviewData(dealId: string): RewardMapPreviewData | null {
  const node = getNodeById(dealId);
  if (!node) {
    return null;
  }

  const chapter = CHAPTERS.find((item) => item.id === node.chapter);
  if (!chapter) {
    return null;
  }

  const routePoints = buildRoutePoints(chapter.nodes.length, {
    left: 42,
    right: 258,
    top: 56,
    bottom: 158,
    waveAmplitude: 18,
  });

  return {
    chapterId: chapter.id,
    currentIndex: node.nodeIndex,
    points: routePoints.map((point, index) => ({
      x: point.x,
      y: point.y,
      state:
        index < node.nodeIndex
          ? "completed"
          : index === node.nodeIndex
            ? "current"
            : "upcoming",
    })),
  };
}
