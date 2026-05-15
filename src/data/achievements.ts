import { getNodeById } from "@/data/chapters";
import { getNarrativeEntry } from "@/data/narrative/entries";
import type { ProgressState } from "@/core/game-state/types";

/**
 * GamePush Achievements integration — metadata + compute functions.
 *
 * Поведение reconciler'а (см. AchievementsReconciler):
 * 1. Для max-ачивок (progress) `compute` возвращает число; reconciler
 *    cap'ит по `meta.max`, шлёт `setProgress` если desired > committed.
 * 2. Для one-shot ачивок (без max) `compute` возвращает boolean (или
 *    number > 0 трактуется как true); reconciler шлёт `unlock` ровно
 *    один раз и кэширует факт.
 *
 * Все compute читают только in-memory `state.progress` + опционально
 * `state.lastWin` — никаких I/O или fetch. Безопасно вызывать часто.
 */

export type AchievementMeta = {
  /** Tag для GP achievements dashboard (стабильный, не менять после публикации). */
  tag: string;
  /** Максимум для progress-ачивок. Отсутствует для one-shot. */
  max?: number;
  /** Скрыта ли ачивка до unlock (для эпилогов / mastery). */
  hidden?: boolean;
  /**
   * Возвращает текущее значение ачивки для данного state.
   * - number: текущий progress (для max-ачивок).
   * - boolean: должна быть unlocked (для one-shot ачивок).
   *   Допустимо вернуть `0`/`undefined` если ещё не достигнут порог.
   */
  compute(state: ReconcileState): number | boolean;
};

/**
 * Контекст последней успешной партии — нужен только для mastery
 * (no_undo_win / no_hint_win). Передаётся из GameScene в RewardScene
 * на момент завершения партии. На bootstrap / coins-trigger /
 * share-trigger lastWin отсутствует.
 *
 * Поля минимальны: artifactJustAwarded / entryJustOpened убраны как
 * unused (R2 fix). Если позже понадобятся — добавим точечно.
 */
export type LastWinContext = {
  mode: string;
  dealId: string;
  /** Кол-во undo в финальной партии (из GameState). */
  undoCount: number;
  /** Кол-во подсказок в финальной партии (из GameState; монотонный через undo). */
  hintCount: number;
};

export type ReconcileState = {
  progress: ProgressState;
  lastWin?: LastWinContext;
};

const inChapter = (nodes: string[], n: 1 | 2 | 3): number =>
  nodes.filter((id) => id.startsWith(`c${n}n`)).length;

/**
 * Считает количество узлов, чья запись принадлежит указанному
 * speakerEntityId. Использует "ru" entries как канонический источник
 * (counts одинаковые во всех локалях — глобальные/локализованные
 * entries имеют одинаковый speakerEntityId). Если entry отсутствует
 * (например, мигрированный orphan-id), просто пропускаем.
 */
export const countEntriesByEntity = (nodes: string[], entityId: string): number =>
  nodes.filter((nodeId) => {
    const node = getNodeById(nodeId);
    if (!node?.entryId) return false;
    const entry = getNarrativeEntry(node.entryId, "ru");
    return entry?.speakerEntityId === entityId;
  }).length;

export const ACHIEVEMENTS: AchievementMeta[] = [
  // Progression
  { tag: "first_win", compute: (s) => s.progress.completedNodes.length > 0 },
  { tag: "chapter_1_complete", max: 10, compute: (s) => inChapter(s.progress.completedNodes, 1) },
  { tag: "chapter_2_complete", max: 10, compute: (s) => inChapter(s.progress.completedNodes, 2) },
  { tag: "chapter_3_complete", max: 10, compute: (s) => inChapter(s.progress.completedNodes, 3) },

  // Collection
  { tag: "first_artifact", compute: (s) => s.progress.artifacts.length > 0 },
  { tag: "first_entry", compute: (s) => s.progress.completedNodes.length > 0 },
  { tag: "all_artifacts", max: 9, hidden: true, compute: (s) => s.progress.artifacts.length },

  // Mastery — durable through achievementFacts (R2 fix M2)
  {
    tag: "no_undo_win",
    hidden: true,
    compute: (s) =>
      Boolean(s.progress.achievementFacts?.noUndoWinEver) ||
      Boolean(s.lastWin && s.lastWin.undoCount === 0),
  },
  {
    tag: "no_hint_win",
    hidden: true,
    compute: (s) =>
      Boolean(s.progress.achievementFacts?.noHintWinEver) ||
      Boolean(s.lastWin && s.lastWin.hintCount === 0),
  },

  // Character entries — fixed counts (verified by grep entries.ru.ts)
  { tag: "entries_voronov", max: 13, compute: (s) => countEntriesByEntity(s.progress.completedNodes, "leader") },
  { tag: "entries_levin", max: 6, compute: (s) => countEntriesByEntity(s.progress.completedNodes, "archaeologist") },
  { tag: "entries_mirskaya", max: 4, compute: (s) => countEntriesByEntity(s.progress.completedNodes, "cartographer") },
  { tag: "entries_klimova", max: 4, compute: (s) => countEntriesByEntity(s.progress.completedNodes, "photographer_archivist") },
  { tag: "entries_rudenko", max: 3, compute: (s) => countEntriesByEntity(s.progress.completedNodes, "quartermaster_guide") },

  // Coins — balance milestone, monotonic via cap+skip in reconciler
  { tag: "coins_500", max: 500, compute: (s) => s.progress.coins },
  { tag: "coins_1000", max: 1000, compute: (s) => s.progress.coins },
  { tag: "coins_2000", max: 2000, compute: (s) => s.progress.coins },

  // Social — durable via achievementFacts (R2 fix M2)
  { tag: "first_share", compute: (s) => Boolean(s.progress.achievementFacts?.sharedEver) },
  { tag: "first_community_join", compute: (s) => Boolean(s.progress.achievementFacts?.communityJoinedEver) },

  // Story
  { tag: "epilogue", hidden: true, compute: (s) => s.progress.completedNodes.includes("c3n10") },
];
