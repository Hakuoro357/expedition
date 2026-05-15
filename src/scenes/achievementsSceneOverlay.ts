import { escapeHtml } from "@/ui/escapeHtml";
import { safeAchievementIconUrl } from "@/ui/safeUrl";
import type { AchievementsViewModel, AchievementsGroupVm, AchievementCardVm } from "@/data/buildAchievementsViewModel";

/**
 * HTML builder for AchievementsScene (v0.3.58).
 *
 * Layout:
 *   .achievements-overlay__backdrop  ← full-screen modal, pointer-events: auto
 *     .achievements-overlay
 *       header: title + back button
 *       .achievements-overlay__scroll  ← bounded overflow-y, list of group sections
 *         .achievements-section[]      ← per group
 *           .achievement-card[]        ← per achievement
 *
 * View-model is built by `buildAchievementsViewModel` — overlay is pure
 * rendering, no business logic. See plan/achievements-ui-final.md.
 */

export type AchievementsSceneOverlayParams = {
  title: string;
  backLabel: string;
  groups: AchievementsViewModel["groups"];
  /** Inline aria-label для скрытых ачивок (e.g. "Скрытое достижение"). */
  hiddenLabel: string;
};

function renderCard(card: AchievementCardVm, hiddenLabel: string): string {
  const cardClasses = [
    "achievement-card",
    card.unlocked ? "achievement-card--unlocked" : "achievement-card--locked",
    card.visuallyLocked ? "achievement-card--hidden" : "",
  ].filter(Boolean).join(" ");

  // ARIA label: hidden → fixed string. Else: title + (если есть progress) "<progress>/<max>".
  const ariaLabel = card.visuallyLocked
    ? hiddenLabel
    : card.displayProgress != null && card.max != null
      ? `${card.title}: ${card.displayProgress}/${card.max}`
      : card.title;

  const iconSrc = safeAchievementIconUrl(card.iconBasename);

  // Progress bar only for max-ачивок (one-shot skipped per R3 codex-M4).
  // Bar и label — siblings внутри wrapper, чтобы label не обрезался overflow:hidden бара.
  const progressBarHtml = card.displayProgress != null && card.max != null
    ? [
        '        <div class="achievement-card__progress">',
        '          <div class="achievement-card__progress-track" role="progressbar"',
        `               aria-valuenow="${card.displayProgress}"`,
        `               aria-valuemin="0"`,
        `               aria-valuemax="${card.max}"`,
        `               aria-label="${escapeHtml(`${card.title}: ${card.displayProgress}/${card.max}`)}">`,
        `            <div class="achievement-card__progress-fill" style="width: ${card.displayPct ?? 0}%"></div>`,
        '          </div>',
        `          <span class="achievement-card__progress-label">${card.displayProgress} / ${card.max}</span>`,
        '        </div>',
      ].join("\n")
    : "";

  // Lock badge для non-hidden locked (visible but не unlocked).
  // hidden+locked card имеет visuallyLocked=true и уже использует locked-generic icon;
  // non-hidden+locked показывает реальную иконку с opacity 0.5 + brass lock-badge.
  const showLockBadge = !card.unlocked && !card.visuallyLocked;
  // SVG лок — стабильное центрирование (emoji 🔒 имеет неконсистентный baseline
  // на разных платформах: Windows/Android/iOS рендерят его с разным offset'ом).
  const lockBadgeHtml = showLockBadge
    ? '        <span class="achievement-card__lock-badge" aria-hidden="true"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></span>'
    : "";

  // Check mark для unlocked.
  const checkHtml = card.unlocked
    ? '        <span class="achievement-card__check" aria-hidden="true">✓</span>'
    : "";

  return [
    `    <article class="${cardClasses}" role="listitem" aria-label="${escapeHtml(ariaLabel)}">`,
    '      <div class="achievement-card__icon-wrap">',
    `        <img class="achievement-card__icon" src="${escapeHtml(iconSrc)}" alt="" />`,
    lockBadgeHtml,
    checkHtml,
    '      </div>',
    '      <div class="achievement-card__copy">',
    `        <h3 class="achievement-card__title">${escapeHtml(card.title)}</h3>`,
    card.description
      ? `        <p class="achievement-card__description">${escapeHtml(card.description)}</p>`
      : "",
    progressBarHtml,
    '      </div>',
    '    </article>',
  ].filter(Boolean).join("\n");
}

function renderGroup(group: AchievementsGroupVm, hiddenLabel: string): string {
  return [
    `  <section class="achievements-section" data-group-tag="${escapeHtml(group.tag)}">`,
    `    <h2 class="achievements-section__title">${escapeHtml(group.title)}</h2>`,
    '    <div class="achievements-section__list" role="list">',
    ...group.items.map((card) => renderCard(card, hiddenLabel)),
    '    </div>',
    '  </section>',
  ].join("\n");
}

export function createAchievementsSceneOverlayHtml(params: AchievementsSceneOverlayParams): string {
  const { title, backLabel, groups, hiddenLabel } = params;

  return [
    '<div class="achievements-overlay__backdrop">',
    '  <div class="achievements-overlay">',
    '    <header class="achievements-overlay__header">',
    `      <button class="achievements-overlay__back" type="button" data-achievements-action="back" aria-label="${escapeHtml(backLabel)}">`,
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
    `        <span>${escapeHtml(backLabel)}</span>`,
    '      </button>',
    `      <h1 class="achievements-overlay__title">${escapeHtml(title)}</h1>`,
    '    </header>',
    '    <div class="achievements-overlay__scroll">',
    ...groups.map((g) => renderGroup(g, hiddenLabel)),
    '    </div>',
    '  </div>',
    '</div>',
  ].join("\n");
}
