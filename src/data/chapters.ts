import { ECONOMY } from "@/app/config/economy";
import type { Difficulty } from "@/core/klondike/dealSolver";

export type ChapterNode = {
  /** Unique deal ID used throughout the system, e.g. "c1n1" */
  id: string;
  chapter: number;
  nodeIndex: number; // 0-based within chapter
  /** Seed for createShuffledDeck — pre-verified solvable */
  seed: number;
  /** Difficulty tier based on solver step count */
  difficulty: Difficulty;
  /** ID of artifact dropped on this node, if any */
  artifactId?: string;
};

export type ChapterDef = {
  id: number;
  titleRu: string;
  titleEn: string;
  nodes: ChapterNode[];
};

/**
 * Seeds pre-verified as solvable by the greedy solver (scripts/findSeeds.ts).
 * Difficulty grows across chapters:
 *   Chapter 1 — easy (solver steps < 116)
 *   Chapter 2 — medium (steps 116–122)
 *   Chapter 3 — hard (steps ≥ 123)
 */
const CHAPTER_SEEDS: number[][] = [
  // Chapter 1 — easy: 20,38,48,72,118,121,139,180,200,265
  [20, 38, 48, 72, 118, 121, 139, 180, 200, 265],
  // Chapter 2 — medium: 21,31,56,80,97,108,124,151,183,188
  [21, 31, 56, 80, 97, 108, 124, 151, 183, 188],
  // Chapter 3 — hard: 3,14,23,35,73,141,178,205,229,269
  [3, 14, 23, 35, 73, 141, 178, 205, 229, 269],
];

const CHAPTER_DIFFICULTY: Difficulty[] = ["easy", "medium", "hard"];

/** Artifact IDs per chapter in drop order */
const CHAPTER_ARTIFACT_IDS: string[][] = [
  ["compass", "old-map", "explorer-badge"],
  ["pickaxe", "field-journal", "lantern"],
  ["canoe-paddle", "fishing-rod", "camp-kettle"],
];

function buildChapterNodes(chapterIdx: number): ChapterNode[] {
  const seeds = CHAPTER_SEEDS[chapterIdx] ?? [];
  const artifactIds = CHAPTER_ARTIFACT_IDS[chapterIdx] ?? [];
  const dropNodes = ECONOMY.artifactDropNodes;
  const difficulty = CHAPTER_DIFFICULTY[chapterIdx] ?? "medium";

  return seeds.map((seed, nodeIndex) => {
    const artifactDropIdx = dropNodes.indexOf(nodeIndex);
    const artifactId =
      artifactDropIdx !== -1 ? artifactIds[artifactDropIdx] : undefined;

    return {
      id: `c${chapterIdx + 1}n${nodeIndex + 1}`,
      chapter: chapterIdx + 1,
      nodeIndex,
      seed,
      difficulty,
      artifactId,
    };
  });
}

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    titleRu: "Северный маршрут",
    titleEn: "Northern Route",
    nodes: buildChapterNodes(0),
  },
  {
    id: 2,
    titleRu: "Горный перевал",
    titleEn: "Mountain Pass",
    nodes: buildChapterNodes(1),
  },
  {
    id: 3,
    titleRu: "Речной лагерь",
    titleEn: "River Camp",
    nodes: buildChapterNodes(2),
  },
];

/** All nodes flattened for quick lookup */
const ALL_NODES: ChapterNode[] = CHAPTERS.flatMap((c) => c.nodes);

export function getNodeById(id: string): ChapterNode | undefined {
  return ALL_NODES.find((n) => n.id === id);
}

export function getNextNodeId(currentId: string): string | null {
  const idx = ALL_NODES.findIndex((n) => n.id === currentId);
  if (idx === -1 || idx === ALL_NODES.length - 1) {
    return null;
  }
  return ALL_NODES[idx + 1]?.id ?? null;
}

export function isLastNodeInChapter(nodeId: string): boolean {
  const node = getNodeById(nodeId);
  if (!node) {
    return false;
  }
  return node.nodeIndex === ECONOMY.nodesPerChapter - 1;
}

export function getFirstNodeOfChapter(chapterId: number): ChapterNode | undefined {
  return CHAPTERS.find((c) => c.id === chapterId)?.nodes[0];
}
