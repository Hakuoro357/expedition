/**
 * Pure view-model builder for AchievementsScene.
 *
 * **Design contract (v0.3.58 plan):**
 *   - compute is PRIMARY — synchronous, offline-capable. The VM renders
 *     immediately on scene.create() with compute() + persisted data.
 *   - SDK confirmation is PROGRESSIVE ENHANCEMENT — passed as
 *     `sdkUnlockedTags` + `sdkProgressByTag` and merged in on re-render
 *     after `sdk.fetchAchievements()` resolves.
 *   - `effectiveProgress = max(compute, sdk, persisted)` — monotonic
 *     display, ignores regressions (e.g. coins spent below peak).
 *   - Hidden + not unlocked → full anonymization (locked-generic icon,
 *     "???" title, empty description, no progress).
 *   - Non-hidden + locked → real icon with `opacity: 0.5` + lock badge.
 *
 * @see plans/achievements-ui-final.md
 */
import { ACHIEVEMENTS, type ReconcileState } from "@/data/achievements";
import { ACHIEVEMENT_GROUPS, ACHIEVEMENT_UI_META, type GroupTag } from "@/data/achievementUiMeta";
import type { ProgressState } from "@/core/game-state/types";

/** Single achievement render-row. */
export type AchievementCardVm = {
  tag: string;
  /** Filename basename for safeAchievementIconUrl (e.g. "first_win.png" or "locked-generic.png"). */
  iconBasename: string;
  /** Localized title, or "???" if hidden+locked. */
  title: string;
  /** Localized description, or empty string if hidden+locked. */
  description: string;
  unlocked: boolean;
  /** True only for hidden achievements that remain locked. UI fully anonymizes them. */
  visuallyLocked: boolean;
  /** Defined only for max-achievements that should show a progress bar. */
  displayProgress?: number;
  /** Same as displayProgress / max × 100, 0..100. */
  displayPct?: number;
  /** The achievement's `max` (for `aria-valuemax`). Mirrors displayProgress presence. */
  max?: number;
};

export type AchievementsGroupVm = {
  tag: GroupTag;
  title: string;
  items: AchievementCardVm[];
};

export type AchievementsViewModel = {
  groups: AchievementsGroupVm[];
};

/** Numeric-safety helper (R6 codex): NaN/undefined/non-finite → 0. */
const readProgress = (value: unknown): number =>
  Number.isFinite(value) ? Math.max(0, Number(value)) : 0;

/**
 * Build the view-model for AchievementsScene.
 *
 * @param progress player save state (provides `ACHIEVEMENTS.compute`)
 * @param sdkUnlockedTags GP-confirmed unlocked tags (Set may be empty before fetch)
 * @param sdkProgressByTag GP-side progress per tag (Map may be empty before fetch)
 * @param persistedUnlocked `progress.achievementUnlocked` from save
 * @param persistedProgress `progress.achievementProgress` from save
 * @param translate i18n lookup `i18n.t(key)` — injected for testability
 * @param hiddenTitlePlaceholder string to show for hidden+locked achievements (e.g. "???")
 */
export function buildAchievementsViewModel(input: {
  progress: ProgressState;
  sdkUnlockedTags: Set<string>;
  sdkProgressByTag: Map<string, number>;
  persistedUnlocked: Record<string, true>;
  persistedProgress: Record<string, number>;
  translate: (key: string) => string;
  hiddenTitlePlaceholder: string;
}): AchievementsViewModel {
  const {
    progress,
    sdkUnlockedTags,
    sdkProgressByTag,
    persistedUnlocked,
    persistedProgress,
    translate,
    hiddenTitlePlaceholder,
  } = input;

  const state: ReconcileState = { progress };
  const computeByTag = new Map<string, number | boolean>();
  for (const meta of ACHIEVEMENTS) {
    computeByTag.set(meta.tag, meta.compute(state));
  }

  // Group → sorted achievement cards.
  const groups: AchievementsGroupVm[] = ACHIEVEMENT_GROUPS.map((group) => {
    const items = ACHIEVEMENT_UI_META
      .filter((ui) => ui.groupTag === group.tag)
      .sort((a, b) => a.order - b.order)
      .map((ui): AchievementCardVm => {
        const computeMeta = ACHIEVEMENTS.find((m) => m.tag === ui.tag);
        // If compute-meta is missing (caught by parity test) — render as locked stub.
        if (!computeMeta) {
          return {
            tag: ui.tag,
            iconBasename: "locked-generic.png",
            title: hiddenTitlePlaceholder,
            description: "",
            unlocked: false,
            visuallyLocked: true,
          };
        }

        const compute = computeByTag.get(ui.tag);
        const computeUnlockedBool = compute === true;
        const rawCompute = typeof compute === "number" ? compute : 0;
        const sdkProgress = readProgress(sdkProgressByTag.get(ui.tag));
        const persistedProg = readProgress(persistedProgress?.[ui.tag]);

        const hasMax = typeof computeMeta.max === "number";
        const effectiveProgress = hasMax
          ? Math.max(rawCompute, sdkProgress, persistedProg)
          : 0;

        // R4 codex-M2: unified unlock rule across max + one-shot.
        const isUnlocked =
          computeUnlockedBool ||
          sdkUnlockedTags.has(ui.tag) ||
          persistedUnlocked?.[ui.tag] === true ||
          (hasMax && effectiveProgress >= (computeMeta.max as number));

        const hidden = computeMeta.hidden === true;
        const visuallyLocked = hidden && !isUnlocked;

        // Anonymize hidden+locked.
        if (visuallyLocked) {
          return {
            tag: ui.tag,
            iconBasename: "locked-generic.png",
            title: hiddenTitlePlaceholder,
            description: "",
            unlocked: false,
            visuallyLocked: true,
          };
        }

        const card: AchievementCardVm = {
          tag: ui.tag,
          iconBasename: `${ui.tag}.png`,
          title: translate(ui.titleKey),
          description: translate(ui.descriptionKey),
          unlocked: isUnlocked,
          visuallyLocked: false,
        };

        if (hasMax) {
          const max = computeMeta.max as number;
          // R2 clamp: unlocked → display = max (avoid "✓ + 3/10" broken look).
          const displayProgress = isUnlocked
            ? max
            : Math.min(effectiveProgress, max);
          card.displayProgress = displayProgress;
          card.displayPct = (displayProgress / max) * 100;
          card.max = max;
        }
        return card;
      });

    return {
      tag: group.tag,
      title: translate(group.titleKey),
      items,
    };
  });

  return { groups };
}
